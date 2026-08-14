import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Observable, switchMap, map, throwError, catchError, from, forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../shared/models/api-response.model';
import { IMedia } from '../../shared/models/facility.model';
import { MediaScope, PresignRequest, PresignResponse } from '../../shared/models/media.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';
import { extensionFor, fileStem, processImageForUpload } from '../../shared/utils/image.util';

/**
 * Hard ceiling on an upload (10 MiB), mirroring the S3 POST policy's
 * `content-length-range`. Enforced client-side so an oversize file is rejected
 * before the presign round-trip instead of by S3's opaque XML `EntityTooLarge`.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Ceiling on the ORIGINAL file handed to {@link MediaService.uploadImage}
 * (25 MiB). The original never reaches S3 — it is downscaled/re-encoded to
 * webp in the browser first — so it may exceed {@link MAX_UPLOAD_BYTES}; this
 * cap only guards the browser against decoding absurdly large sources.
 */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

/**
 * Raised when the backend reports the media bucket is not configured (503 from
 * the local/unconfigured environment). Consumers surface a clean Georgian alert
 * instead of the generic error toast.
 */
export class MediaUnconfiguredError extends Error {
  constructor() {
    super('Media bucket not configured');
    this.name = 'MediaUnconfiguredError';
  }
}

/**
 * Raised when a file exceeds {@link MAX_UPLOAD_BYTES} — either caught by the
 * client-side pre-check (before presigning) or reported by S3 as an
 * `EntityTooLarge` 4xx on the multipart POST. Consumers surface a clean Georgian
 * "file too large" alert instead of the generic upload error.
 */
export class MediaFileTooLargeError extends Error {
  constructor() {
    super('File exceeds the 10MB upload limit');
    this.name = 'MediaFileTooLargeError';
  }
}

/**
 * Two-step upload: presign against the API, then multipart-POST the file
 * directly to S3 (presigned POST). The S3 request carries NO Authorization
 * header — the auth interceptor already skips non-`apiUrl` hosts, and S3 rejects
 * unexpected auth headers. Its Content-Type is left unset so the browser stamps
 * the multipart boundary itself.
 */
@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private readonly http = inject(HttpClient);
  private readonly presignUrl = `${environment.apiUrl}/media/presign`;

  /**
   * The image-upload pipeline (docs/22): downscale + re-encode to webp in the
   * browser, in TWO renditions (web ≤1600px, thumb ≤480px), then upload both
   * via presigned POST in parallel. Resolves to ONE `IMedia` carrying both
   * URLs (`url` = web, `thumbUrl` = thumb) plus their S3 keys — the API's
   * usage tracker needs the keys to manage cleanup.
   *
   * If decoding/encoding fails (exotic format, canvas limits), falls back to
   * {@link upload} of the untouched original — a facility photo beats no photo.
   * Typed errors ({@link MediaFileTooLargeError}, {@link MediaUnconfiguredError})
   * and HTTP failures are NOT swallowed by the fallback.
   */
  uploadImage(file: File, scope: MediaScope): Observable<IMedia> {
    if (file.size > MAX_SOURCE_BYTES) {
      return throwError(() => new MediaFileTooLargeError());
    }

    return from(processImageForUpload(file)).pipe(
      switchMap((processed) => {
        const stem = fileStem(file.name);
        const ext = extensionFor(processed.type);
        return forkJoin([
          this.uploadBlob(processed.web.blob, `${stem}-web.${ext}`, processed.type, scope),
          this.uploadBlob(processed.thumb.blob, `${stem}-thumb.${ext}`, processed.type, scope),
        ]).pipe(
          map(
            ([web, thumb]): IMedia => ({
              url: web.publicUrl,
              thumbUrl: thumb.publicUrl,
              key: web.key,
              thumbKey: thumb.key,
              type: processed.type,
              size: processed.web.blob.size,
            }),
          ),
        );
      }),
      catchError((error: unknown) => {
        const isTypedOrHttp =
          error instanceof MediaFileTooLargeError ||
          error instanceof MediaUnconfiguredError ||
          error instanceof HttpErrorResponse;
        if (isTypedOrHttp) {
          return throwError(() => error);
        }
        // Processing failed before any network call — upload the original.
        return this.upload(file, scope);
      }),
    );
  }

  /**
   * Raw single-object upload (no processing) — the fallback path, and the one
   * non-image flows would use. Resolves to an `IMedia` carrying the persisted
   * `publicUrl`. Sequencing: (pre-check size) → POST /media/presign → multipart
   * POST uploadUrl. Error mapping:
   *  - oversize file (pre-check or S3 4xx) → {@link MediaFileTooLargeError};
   *  - 503 from presign → {@link MediaUnconfiguredError}.
   */
  upload(file: File, scope: MediaScope): Observable<IMedia> {
    return this.uploadBlob(file, file.name, file.type, scope).pipe(
      map(
        (presign): IMedia => ({
          url: presign.publicUrl,
          type: file.type,
          size: file.size,
        }),
      ),
    );
  }

  /**
   * Presigns and POSTs one blob to S3; resolves with the presign so callers
   * can read `publicUrl`/`key`. Shared by both upload paths.
   */
  private uploadBlob(
    blob: Blob,
    fileName: string,
    contentType: string,
    scope: MediaScope,
  ): Observable<PresignResponse> {
    // Client-side guard: skip the presign round-trip for a body S3 would only
    // bounce with an opaque XML EntityTooLarge. Consumers show a clean message.
    if (blob.size > MAX_UPLOAD_BYTES) {
      return throwError(() => new MediaFileTooLargeError());
    }

    const body: PresignRequest = {
      fileName,
      contentType,
      scope,
    };

    // Opt this request out of the generic error toast: a 503 is surfaced as our
    // own clean Georgian alert by the consumer, so the interceptor must stay quiet.
    const context = new HttpContext().set(SKIP_ERROR_TOAST, true);

    return this.http.post<ApiResponse<PresignResponse>>(this.presignUrl, body, { context }).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 503) {
          return throwError(() => new MediaUnconfiguredError());
        }
        return throwError(() => error);
      }),
      map((res) => res.result.data),
      switchMap((presign) => this.postToS3(presign, blob).pipe(map(() => presign))),
    );
  }

  /**
   * Multipart `POST` to the presigned S3 url. Every entry of `presign.fields` is
   * appended FIRST (S3 ignores form parts that arrive after `file`), then the
   * file LAST under the name `file`. No `Content-Type` header is set — the
   * browser adds it together with the multipart boundary. No auth header (the
   * auth interceptor skips non-`apiUrl` hosts). S3 answers 204 on success and a
   * 4xx (`EntityTooLarge`) when the file breaches the policy's size range.
   */
  private postToS3(presign: PresignResponse, blob: Blob): Observable<void> {
    const formData = new FormData();
    for (const [key, value] of Object.entries(presign.fields)) {
      formData.append(key, value);
    }
    // The file MUST be the last field of the multipart body.
    formData.append('file', blob);

    // Suppress the interceptor's generic toast so an EntityTooLarge (4xx) can be
    // surfaced as our own typed error → consumer's Georgian "file too large" alert.
    const context = new HttpContext().set(SKIP_ERROR_TOAST, true);

    return this.http.post<void>(presign.uploadUrl, formData, { context }).pipe(
      catchError((error: HttpErrorResponse) => {
        // S3 returns 400 (EntityTooLarge, policy content-length-range) or 413.
        if (error.status === 400 || error.status === 413) {
          return throwError(() => new MediaFileTooLargeError());
        }
        return throwError(() => error);
      }),
    );
  }
}
