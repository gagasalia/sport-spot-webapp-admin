import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authSpy: jasmine.SpyObj<AuthService>;

  const base = environment.apiUrl;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['getToken']);
    authSpy.getToken.and.returnValue('test-token');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should attach a Bearer header to API requests', () => {
    http.get(`${base}/academy`).subscribe();

    const req = httpMock.expectOne(`${base}/academy`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush({});
  });

  it('should NOT attach a header to the login request', () => {
    http.post(`${base}/auth/login`, {}).subscribe();

    const req = httpMock.expectOne(`${base}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should NOT call getToken for the login request', () => {
    http.post(`${base}/auth/login`, {}).subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({});
    expect(authSpy.getToken).not.toHaveBeenCalled();
  });

  it('should NOT attach a header to non-API (external) requests', () => {
    http.get('https://maps.googleapis.com/x').subscribe();

    const req = httpMock.expectOne('https://maps.googleapis.com/x');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should pass the request through unchanged when there is no token', () => {
    authSpy.getToken.and.returnValue(null);
    http.get(`${base}/academy`).subscribe();

    const req = httpMock.expectOne(`${base}/academy`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should attach the header to a nested API path', () => {
    http.get(`${base}/facilities/academy/ac-1`).subscribe();

    const req = httpMock.expectOne(`${base}/facilities/academy/ac-1`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush({});
  });
});
