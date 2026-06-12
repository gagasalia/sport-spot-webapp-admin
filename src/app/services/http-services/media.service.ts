import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, switchMap, map, throwError, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../shared/models/api-response.model';
import { IMedia } from '../../shared/models/facility.model';
import { MediaScope, PresignRequest, PresignResponse } from '../../shared/models/media.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';

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
 * Two-step upload: presign against the API, then PUT the raw file directly to
 * S3. The S3 request carries NO Authorization header — the auth interceptor
 * already skips non-`apiUrl` hosts, and S3 rejects unexpected auth headers.
 */
@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private readonly http = inject(HttpClient);
  private readonly presignUrl = `${environment.apiUrl}/media/presign`;

  /**
   * Uploads `file` and resolves to an `IMedia` carrying the persisted
   * `publicUrl`. Sequencing: POST /media/presign → PUT uploadUrl (raw File).
   * A 503 from presign maps to {@link MediaUnconfiguredError}.
   */
  upload(file: File, scope: MediaScope): Observable<IMedia> {
    const body: PresignRequest = {
      fileName: file.name,
      contentType: file.type,
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
      switchMap((presign) =>
        this.putToS3(presign.uploadUrl, file).pipe(
          map(
            (): IMedia => ({
              url: presign.publicUrl,
              type: file.type,
              size: file.size,
            }),
          ),
        ),
      ),
    );
  }

  /** Direct PUT to the presigned S3 url with the raw File body. No auth header. */
  private putToS3(uploadUrl: string, file: File): Observable<void> {
    const headers = new HttpHeaders({ 'Content-Type': file.type });
    return this.http.put<void>(uploadUrl, file, { headers });
  }
}
