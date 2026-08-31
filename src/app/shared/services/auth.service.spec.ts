import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AuthService, TOKEN_STORAGE_KEY } from './auth.service';
import { NonAdminLoginError } from '../models/auth.model';
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
  username: 'admin.sportspace',
  userType: [UserType.ADMIN],
  academies: ['ac-1'],
};

const superAdminClaims = {
  sub: 'user-2',
  username: 'super.admin',
  userType: [UserType.SUPERADMIN],
  academies: [],
};

const playerClaims = {
  sub: 'user-3',
  phone: '995533333333',
  userType: [UserType.USER],
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
      service.login('admin.sportspace', 'secret').subscribe();

      const req = httpMock.expectOne(`${base}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ username: 'admin.sportspace', password: 'secret' });
      req.flush({ result: { data: { accessToken: makeJwt(adminClaims), user: {} } }, errors: [] });
    });

    it('should persist the token in localStorage under ss_token', () => {
      const token = makeJwt(adminClaims);
      service.login('admin.sportspace', 'secret').subscribe();

      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: token, user: {} } }, errors: [] });

      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(token);
    });

    it('should populate currentUser from the decoded token on success', () => {
      service.login('admin.sportspace', 'secret').subscribe();

      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(adminClaims), user: {} } }, errors: [] });

      expect(service.currentUser()?.username).toBe('admin.sportspace');
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

    it('should reject a non-admin (player) login with NonAdminLoginError', () => {
      let error: unknown;
      service.login('995533333333', 'secret').subscribe({ error: (e) => (error = e) });

      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(playerClaims), user: {} } }, errors: [] });

      expect(error instanceof NonAdminLoginError).toBeTrue();
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBeFalse();
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
      service.login('admin.sportspace', 'x').subscribe();
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

      expect(fresh.currentUser()?.username).toBe('super.admin');
      expect(fresh.isSuperAdmin()).toBeTrue();
    });

    it('should report isSuperAdmin true for a superadmin token', () => {
      service.login('super.admin', 'x').subscribe();
      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(superAdminClaims), user: {} } }, errors: [] });

      expect(service.isSuperAdmin()).toBeTrue();
    });

    it('should report isSuperAdmin false for an admin token', () => {
      service.login('admin.sportspace', 'x').subscribe();
      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(adminClaims), user: {} } }, errors: [] });

      expect(service.isSuperAdmin()).toBeFalse();
    });

    it('should report isAdmin true for an admin token', () => {
      service.login('admin.sportspace', 'x').subscribe();
      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(adminClaims), user: {} } }, errors: [] });

      expect(service.isAdmin()).toBeTrue();
    });

    it('should report isAdmin true for a superadmin token', () => {
      service.login('super.admin', 'x').subscribe();
      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(superAdminClaims), user: {} } }, errors: [] });

      expect(service.isAdmin()).toBeTrue();
    });

    it('should report isAdmin false for a persisted player token', () => {
      // Seed a player token (e.g. left over from before the role check), then
      // build a fresh injector so the constructor reads it.
      localStorage.setItem(TOKEN_STORAGE_KEY, makeJwt(playerClaims));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
      });
      const fresh = TestBed.inject(AuthService);

      expect(fresh.isAuthenticated()).toBeTrue();
      expect(fresh.isAdmin()).toBeFalse();
    });

    it('should expose the academies claim through currentUser', () => {
      service.login('admin.sportspace', 'x').subscribe();
      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(adminClaims), user: {} } }, errors: [] });

      expect(service.currentUser()?.academies).toEqual(['ac-1']);
    });

    it('should decode UTF-8 (multi-byte) claims correctly', () => {
      const claims = { ...adminClaims, sub: 'გიო-1' };
      service.login('x', 'y').subscribe();
      httpMock
        .expectOne(`${base}/auth/login`)
        .flush({ result: { data: { accessToken: makeJwt(claims), user: {} } }, errors: [] });

      expect(service.currentUser()?.sub).toBe('გიო-1');
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
