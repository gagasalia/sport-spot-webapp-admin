import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { MediaService, MediaUnconfiguredError } from './media.service';
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
const S3_URL = 'https://s3.example.com/bucket/academy-logo/aca-1/uuid-logo.png?signature=abc';
const PUBLIC_URL = 'https://cdn.example.com/academy-logo/aca-1/uuid-logo.png';

const presignResponse: PresignResponse = {
  uploadUrl: S3_URL,
  key: 'academy-logo/aca-1/uuid-logo.png',
  publicUrl: PUBLIC_URL,
};

function makeFile(): File {
  return new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' });
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

    // Then the S3 PUT follows.
    httpMock.expectOne(S3_URL).flush(null);
  });

  it('sequences presign → PUT and resolves to IMedia with the publicUrl', () => {
    let emitted: IMedia | undefined;
    service.upload(makeFile(), 'academy-logo').subscribe((m) => (emitted = m));

    // Before presign resolves, no S3 request should exist yet.
    httpMock.expectNone(S3_URL);

    const presignReq = httpMock.expectOne(presignUrl);
    presignReq.flush(wrapInApiResponse(presignResponse));

    const putReq = httpMock.expectOne(S3_URL);
    expect(putReq.request.method).toBe('PUT');
    putReq.flush(null);

    expect(emitted).toEqual({ url: PUBLIC_URL, type: 'image/png', size: 3 });
  });

  it('PUTs the raw File body with the correct Content-Type', () => {
    const file = makeFile();
    service.upload(file, 'facility-media').subscribe();

    httpMock.expectOne(presignUrl).flush(wrapInApiResponse(presignResponse));

    const putReq = httpMock.expectOne(S3_URL);
    expect(putReq.request.body).toBe(file);
    expect(putReq.request.headers.get('Content-Type')).toBe('image/png');
    putReq.flush(null);
  });

  it('does NOT attach an Authorization header to the S3 PUT', () => {
    service.upload(makeFile(), 'academy-logo').subscribe();

    // The presign request IS authenticated (apiUrl host).
    const presignReq = httpMock.expectOne(presignUrl);
    expect(presignReq.request.headers.get('Authorization')).toBe('Bearer test-token');
    presignReq.flush(wrapInApiResponse(presignResponse));

    // The S3 request (non-apiUrl host) must NOT carry auth.
    const putReq = httpMock.expectOne(S3_URL);
    expect(putReq.request.headers.has('Authorization')).toBeFalse();
    putReq.flush(null);
  });

  it('sets SKIP_ERROR_TOAST on the presign request so the interceptor stays quiet', () => {
    service.upload(makeFile(), 'academy-logo').subscribe({ error: () => {} });

    const presignReq = httpMock.expectOne(presignUrl);
    expect(presignReq.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    presignReq.flush(wrapInApiResponse(presignResponse));

    httpMock.expectOne(S3_URL).flush(null);
  });

  it('maps a 503 from presign to MediaUnconfiguredError and never PUTs to S3', () => {
    let error: unknown;
    service.upload(makeFile(), 'academy-logo').subscribe({ error: (e) => (error = e) });

    httpMock
      .expectOne(presignUrl)
      .flush({ errors: [{ statusCode: 503, message: 'not configured' }] }, {
        status: 503,
        statusText: 'Service Unavailable',
      });

    expect(error).toBeInstanceOf(MediaUnconfiguredError);
    httpMock.expectNone(S3_URL);
  });
});
