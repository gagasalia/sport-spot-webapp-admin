import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AuthService, TOKEN_STORAGE_KEY } from './auth.service';
import { UserType } from '../models/user.model';
import { environment } from '../../../environments/environment';

/** Builds a (signature-free) JWT from a claims object using base64url, UTF-8 safe. */
function makeJwt(payload: Record<string, unknown>): string {
  const enc = (obj: unknown) => {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.signature`;
}

const adminClaims = {
  sub: 'user-1',
  email: 'admin@example.com',
  userType: [UserType.ADMIN],
  academies: ['ac-1'],
};

const superAdminClaims = {
  sub: 'user-2',
  email: 'super@example.com',
  userType: [UserType.SUPERADMIN],
  academies: [],
};

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const base = environment.apiUrl;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should POST credentials to /auth/login', () => {
      service.login('admin@example.com', 'secret').subscribe();

      const req = httpMock.expectOne(`${base}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'admin@example.com', password: 'secret' });
      req.flush({ result: { data: { accessToken: makeJwt(adminClaims), user: {} } }, errors: [] });
    });

    it('should persist the token in localStorage under ss_token', () => {
      const token = makeJwt(adminClaims);
      service.login('admin@example.com', 'secret').subscribe();

      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: token, user: {} } }, errors: [] });

      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(token);
    });

    it('should populate currentUser from the decoded token on success', () => {
      service.login('admin@example.com', 'secret').subscribe();

      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(adminClaims), user: {} } }, errors: [] });

      expect(service.currentUser()?.email).toBe('admin@example.com');
      expect(service.currentUser()?.sub).toBe('user-1');
      expect(service.isAuthenticated()).toBeTrue();
    });

    it('should emit the LoginResponse data', () => {
      let emitted: { accessToken: string } | undefined;
      service.login('a@b.c', 'x').subscribe((res) => (emitted = res));

      const token = makeJwt(adminClaims);
      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: token, user: {} } }, errors: [] });

      expect(emitted?.accessToken).toBe(token);
    });

    it('should not persist a token on a 401 error', () => {
      let errored = false;
      service.login('a@b.c', 'wrong').subscribe({ error: () => (errored = true) });

      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ errors: [{ statusCode: 401, message: 'bad' }] }, { status: 401, statusText: 'Unauthorized' });

      expect(errored).toBeTrue();
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
      expect(service.currentUser()).toBeNull();
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should remove the token and clear currentUser', () => {
      // Log in first so there is a session to clear.
      service.login('admin@example.com', 'x').subscribe();
      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(adminClaims), user: {} } }, errors: [] });
      expect(service.isAuthenticated()).toBeTrue();

      service.logout();

      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBeFalse();
    });
  });

  // ─── token decode / role checks ─────────────────────────────────────────────

  describe('token decode & role checks', () => {
    it('should decode an existing token from localStorage at construction', () => {
      // Seed a token, then build a brand-new injector so the constructor reads it.
      localStorage.setItem(TOKEN_STORAGE_KEY, makeJwt(superAdminClaims));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
      });
      const fresh = TestBed.inject(AuthService);

      expect(fresh.currentUser()?.email).toBe('super@example.com');
      expect(fresh.isSuperAdmin()).toBeTrue();
    });

    it('should report isSuperAdmin true for a superadmin token', () => {
      service.login('super@example.com', 'x').subscribe();
      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(superAdminClaims), user: {} } }, errors: [] });

      expect(service.isSuperAdmin()).toBeTrue();
    });

    it('should report isSuperAdmin false for an admin token', () => {
      service.login('admin@example.com', 'x').subscribe();
      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(adminClaims), user: {} } }, errors: [] });

      expect(service.isSuperAdmin()).toBeFalse();
    });

    it('should expose the academies claim through currentUser', () => {
      service.login('admin@example.com', 'x').subscribe();
      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(adminClaims), user: {} } }, errors: [] });

      expect(service.currentUser()?.academies).toEqual(['ac-1']);
    });

    it('should decode UTF-8 (multi-byte) claims correctly', () => {
      const claims = { ...adminClaims, email: 'გიო@example.com' };
      service.login('x', 'y').subscribe();
      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(claims), user: {} } }, errors: [] });

      expect(service.currentUser()?.email).toBe('გიო@example.com');
    });

    it('should treat a malformed token as logged out', () => {
      localStorage.setItem(TOKEN_STORAGE_KEY, 'not-a-jwt');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
      });
      const fresh = TestBed.inject(AuthService);

      expect(fresh.currentUser()).toBeNull();
      expect(fresh.isAuthenticated()).toBeFalse();
    });
  });

  // ─── getToken ───────────────────────────────────────────────────────────────

  describe('getToken', () => {
    it('should return null when no token is stored', () => {
      expect(service.getToken()).toBeNull();
    });

    it('should return the stored token', () => {
      localStorage.setItem(TOKEN_STORAGE_KEY, 'abc');
      expect(service.getToken()).toBe('abc');
    });
  });
});
