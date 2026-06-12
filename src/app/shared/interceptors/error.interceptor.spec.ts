import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpContext,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { TuiAlertService } from '@taiga-ui/core';

import { errorInterceptor, SKIP_ERROR_TOAST } from './error.interceptor';
import { AuthService } from '../services/auth.service';
import { TenantService } from '../services/tenant.service';
import { environment } from '../../../environments/environment';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let alertsSpy: jasmine.SpyObj<TuiAlertService>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let tenantSpy: jasmine.SpyObj<TenantService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const base = environment.apiUrl;

  beforeEach(() => {
    alertsSpy = jasmine.createSpyObj<TuiAlertService>('TuiAlertService', ['open']);
    alertsSpy.open.and.returnValue(of(undefined) as any);
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['logout']);
    tenantSpy = jasmine.createSpyObj<TenantService>('TenantService', ['clear']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/configuration/academy' });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: TuiAlertService, useValue: alertsSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: TenantService, useValue: tenantSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function flush401(url: string) {
    httpMock
      .expectOne(url)
      .flush({ errors: [{ statusCode: 401 }] }, { status: 401, statusText: 'Unauthorized' });
  }

  it('should clear auth + tenant and redirect to /login on a 401 (non-login request)', () => {
    http.get(`${base}/academy`).subscribe({ error: () => {} });
    flush401(`${base}/academy`);

    expect(authSpy.logout).toHaveBeenCalled();
    expect(tenantSpy.clear).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/configuration/academy' },
    });
  });

  it('should NOT show the generic toast on a 401', () => {
    http.get(`${base}/academy`).subscribe({ error: () => {} });
    flush401(`${base}/academy`);

    expect(alertsSpy.open).not.toHaveBeenCalled();
  });

  it('should NOT clear/redirect on a 401 from the login request itself', () => {
    http.post(`${base}/auth/login`, {}).subscribe({ error: () => {} });
    flush401(`${base}/auth/login`);

    expect(authSpy.logout).not.toHaveBeenCalled();
    expect(tenantSpy.clear).not.toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('should NOT toast a 401 from the login request (handled inline by the page)', () => {
    http.post(`${base}/auth/login`, {}).subscribe({ error: () => {} });
    flush401(`${base}/auth/login`);

    expect(alertsSpy.open).not.toHaveBeenCalled();
  });

  it('should show the generic Georgian toast on a non-401 error', () => {
    http.get(`${base}/academy`).subscribe({ error: () => {} });
    httpMock
      .expectOne(`${base}/academy`)
      .flush({ errors: [] }, { status: 500, statusText: 'Server Error' });

    expect(alertsSpy.open).toHaveBeenCalledWith('მოხდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით.', {
      appearance: 'error',
    });
    expect(authSpy.logout).not.toHaveBeenCalled();
  });

  it('should NOT show the generic toast when SKIP_ERROR_TOAST is set (presign 503)', () => {
    // Mirrors MediaService's presign request: the caller surfaces its own alert,
    // so the interceptor must stay quiet to avoid double-toasting.
    const context = new HttpContext().set(SKIP_ERROR_TOAST, true);
    http.post(`${base}/media/presign`, {}, { context }).subscribe({ error: () => {} });
    httpMock
      .expectOne(`${base}/media/presign`)
      .flush(
        { errors: [{ statusCode: 503, message: 'not configured' }] },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(alertsSpy.open).not.toHaveBeenCalled();
  });

  it('should still toast a normal request error when SKIP_ERROR_TOAST is NOT set', () => {
    http.get(`${base}/academy`).subscribe({ error: () => {} });
    httpMock
      .expectOne(`${base}/academy`)
      .flush({ errors: [] }, { status: 503, statusText: 'Service Unavailable' });

    expect(alertsSpy.open).toHaveBeenCalledWith('მოხდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით.', {
      appearance: 'error',
    });
  });
});
