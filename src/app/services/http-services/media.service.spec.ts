import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import {
  MAX_UPLOAD_BYTES,
  MediaFileTooLargeError,
  MediaService,
  MediaUnconfiguredError,
} from './media.service';
import { authInterceptor } from '../../shared/interceptors/auth.interceptor';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';
import { AuthService } from '../../shared/services/auth.service';
import { IMedia } from '../../shared/models/facility.model';
import { PresignResponse } from '../../shared/models/media.model';
import { environment } from '../../../environments/environment';

function wrapInApiResponse<T>(data: T) {
  return { result: { data }, errors: [] };
}

const presignUrl = `${environment.apiUrl}/media/presign`;
// Presigned POST targets the bucket endpoint itself (no query signature).
const S3_URL = 'https://s3.example.com/bucket';
const PUBLIC_URL = 'https://cdn.example.com/academy-logo/aca-1/uuid-logo.png';

// A realistic presigned-POST payload. `fields` order matters: it is the exact
// order the entries must be appended to the multipart body, before the file.
const presignResponse: PresignResponse = {
  uploadUrl: S3_URL,
  fields: {
    key: 'academy-logo/aca-1/uuid-logo.png',
    'Content-Type': 'image/png',
    policy: 'base64EncodedPolicy==',
    'x-amz-algorithm': 'AWS4-HMAC-SHA256',
    'x-amz-credential': 'AKIAEXAMPLE/20260703/eu-central-1/s3/aws4_request',
    'x-amz-date': '20260703T000000Z',
    'x-amz-signature': 'deadbeefsignature',
  },
  key: 'academy-logo/aca-1/uuid-logo.png',
  publicUrl: PUBLIC_URL,
};

function makeFile(): File {
  return new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' });
}

/** A File whose reported `size` breaches {@link MAX_UPLOAD_BYTES} without allocating it. */
function makeOversizeFile(): File {
  const file = new File([new Uint8Array([1, 2, 3])], 'huge.png', { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: MAX_UPLOAD_BYTES + 1, configurable: true });
  return file;
}

describe('MediaService', () => {
  let service: MediaService;
  let httpMock: HttpTestingController;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['getToken']);
    authSpy.getToken.and.returnValue('test-token');

    TestBed.configureTestingModule({
      providers: [
        MediaService,
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
      ],
    });

    service = TestBed.inject(MediaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('POSTs the presign request with fileName, contentType and scope', () => {
    service.upload(makeFile(), 'academy-logo').subscribe();

    const presignReq = httpMock.expectOne(presignUrl);
    expect(presignReq.request.method).toBe('POST');
    expect(presignReq.request.body).toEqual({
      fileName: 'logo.png',
      contentType: 'image/png',
      scope: 'academy-logo',
    });
    presignReq.flush(wrapInApiResponse(presignResponse));

    // Then the S3 multipart POST follows (204 = success).
    httpMock.expectOne(S3_URL).flush(null, { status: 204, statusText: 'No Content' });
  });

  it('sequences presign → multipart POST and resolves to IMedia with the publicUrl', () => {
    let emitted: IMedia | undefined;
    service.upload(makeFile(), 'academy-logo').subscribe((m) => (emitted = m));

    // Before presign resolves, no S3 request should exist yet.
    httpMock.expectNone(S3_URL);

    const presignReq = httpMock.expectOne(presignUrl);
    presignReq.flush(wrapInApiResponse(presignResponse));

    const postReq = httpMock.expectOne(S3_URL);
    expect(postReq.request.method).toBe('POST');
    postReq.flush(null, { status: 204, statusText: 'No Content' });

    expect(emitted).toEqual({ url: PUBLIC_URL, type: 'image/png', size: 3 });
  });

  it('builds a multipart body with every field FIRST (in order) and the file LAST', () => {
    const file = makeFile();
    service.upload(file, 'facility-media').subscribe();

    httpMock.expectOne(presignUrl).flush(wrapInApiResponse(presignResponse));

    const postReq = httpMock.expectOne(S3_URL);
    const body = postReq.request.body as FormData;
    expect(body instanceof FormData).toBeTrue();

    // Entry order must be: all presign fields (in their given order) then `file`.
    const keys = Array.from(body.keys());
    expect(keys).toEqual([...Object.keys(presignResponse.fields), 'file']);

    // Field values are carried through verbatim.
    expect(body.get('key')).toBe(presignResponse.fields['key']);
    expect(body.get('policy')).toBe(presignResponse.fields['policy']);
    expect(body.get('x-amz-signature')).toBe(presignResponse.fields['x-amz-signature']);

    // The file is appended last, under the name `file`, unchanged.
    const uploaded = body.get('file');
    expect(uploaded instanceof File).toBeTrue();
    expect((uploaded as File).name).toBe('logo.png');
    expect((uploaded as File).type).toBe('image/png');
    expect((uploaded as File).size).toBe(3);

    postReq.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('does NOT set a manual Content-Type on the S3 POST (browser adds the boundary)', () => {
    service.upload(makeFile(), 'facility-media').subscribe();

    httpMock.expectOne(presignUrl).flush(wrapInApiResponse(presignResponse));

    const postReq = httpMock.expectOne(S3_URL);
    // Leaving Content-Type unset lets the browser stamp `multipart/form-data;
    // boundary=…`. A manually-set header would clobber the boundary.
    expect(postReq.request.headers.has('Content-Type')).toBeFalse();
    postReq.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('does NOT attach an Authorization header to the S3 POST', () => {
    service.upload(makeFile(), 'academy-logo').subscribe();

    // The presign request IS authenticated (apiUrl host) — proving the auth
    // interceptor adds the token to apiUrl requests…
    const presignReq = httpMock.expectOne(presignUrl);
    expect(presignReq.request.headers.get('Authorization')).toBe('Bearer test-token');
    presignReq.flush(wrapInApiResponse(presignResponse));

    // …but the S3 request (non-apiUrl host) must NOT carry auth: the interceptor
    // skips every request whose url does not start with environment.apiUrl.
    const postReq = httpMock.expectOne(S3_URL);
    expect(postReq.request.headers.has('Authorization')).toBeFalse();
    postReq.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('sets SKIP_ERROR_TOAST on the presign request so the interceptor stays quiet', () => {
    service.upload(makeFile(), 'academy-logo').subscribe({ error: () => {} });

    const presignReq = httpMock.expectOne(presignUrl);
    expect(presignReq.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    presignReq.flush(wrapInApiResponse(presignResponse));

    httpMock.expectOne(S3_URL).flush(null, { status: 204, statusText: 'No Content' });
  });

  it('sets SKIP_ERROR_TOAST on the S3 POST so the interceptor does not double-toast', () => {
    service.upload(makeFile(), 'academy-logo').subscribe({ error: () => {} });

    httpMock.expectOne(presignUrl).flush(wrapInApiResponse(presignResponse));

    const postReq = httpMock.expectOne(S3_URL);
    expect(postReq.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    postReq.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('maps a 503 from presign to MediaUnconfiguredError and never POSTs to S3', () => {
    let error: unknown;
    service.upload(makeFile(), 'academy-logo').subscribe({ error: (e) => (error = e) });

    httpMock.expectOne(presignUrl).flush(
      { errors: [{ statusCode: 503, message: 'not configured' }] },
      { status: 503, statusText: 'Service Unavailable' },
    );

    expect(error).toBeInstanceOf(MediaUnconfiguredError);
    httpMock.expectNone(S3_URL);
  });

  it('rejects an oversize file with MediaFileTooLargeError BEFORE presigning (client pre-check)', () => {
    let error: unknown;
    service.upload(makeOversizeFile(), 'academy-logo').subscribe({ error: (e) => (error = e) });

    // The pre-check short-circuits synchronously: no presign round-trip at all.
    expect(error).toBeInstanceOf(MediaFileTooLargeError);
    httpMock.expectNone(presignUrl);
    httpMock.expectNone(S3_URL);
  });

  it('presigns a file exactly at the size limit (boundary is inclusive)', () => {
    const file = makeFile();
    Object.defineProperty(file, 'size', { value: MAX_UPLOAD_BYTES, configurable: true });

    service.upload(file, 'academy-logo').subscribe();

    // At exactly the limit the pre-check passes → presign proceeds.
    httpMock.expectOne(presignUrl).flush(wrapInApiResponse(presignResponse));
    httpMock.expectOne(S3_URL).flush(null, { status: 204, statusText: 'No Content' });
  });

  it('maps a 400 EntityTooLarge from the S3 POST to MediaFileTooLargeError', () => {
    let error: unknown;
    service.upload(makeFile(), 'facility-media').subscribe({ error: (e) => (error = e) });

    httpMock.expectOne(presignUrl).flush(wrapInApiResponse(presignResponse));
    httpMock.expectOne(S3_URL).flush(
      '<Error><Code>EntityTooLarge</Code></Error>',
      { status: 400, statusText: 'Bad Request' },
    );

    expect(error).toBeInstanceOf(MediaFileTooLargeError);
  });

  it('maps a 413 from the S3 POST to MediaFileTooLargeError', () => {
    let error: unknown;
    service.upload(makeFile(), 'facility-media').subscribe({ error: (e) => (error = e) });

    httpMock.expectOne(presignUrl).flush(wrapInApiResponse(presignResponse));
    httpMock.expectOne(S3_URL).flush(
      '<Error><Code>EntityTooLarge</Code></Error>',
      { status: 413, statusText: 'Payload Too Large' },
    );

    expect(error).toBeInstanceOf(MediaFileTooLargeError);
  });

  it('propagates a non-size S3 failure (500) as-is, not as MediaFileTooLargeError', () => {
    let error: unknown;
    service.upload(makeFile(), 'facility-media').subscribe({ error: (e) => (error = e) });

    httpMock.expectOne(presignUrl).flush(wrapInApiResponse(presignResponse));
    httpMock
      .expectOne(S3_URL)
      .flush('<Error/>', { status: 500, statusText: 'Internal Server Error' });

    expect(error).not.toBeInstanceOf(MediaFileTooLargeError);
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(500);
  });
});
