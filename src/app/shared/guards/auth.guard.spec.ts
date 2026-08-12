import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { provideRouter } from '@angular/router';

import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { TenantService } from '../services/tenant.service';

function runGuard(url: string) {
  const state = { url } as RouterStateSnapshot;
  const route = {} as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => authGuard(route, state));
}

describe('authGuard', () => {
  // `isAuthenticated`/`isAdmin` are Angular Signals (callables), not plain
  // methods. A createSpyObj methods-array entry would model them as
  // `Spy<() => void>` and type-check awkwardly; a plain stub with callable
  // spies mirrors the Signal shape exactly.
  let authStub: {
    isAuthenticated: jasmine.Spy<() => boolean>;
    isAdmin: jasmine.Spy<() => boolean>;
    logout: jasmine.Spy<() => void>;
  };
  let tenantStub: { clear: jasmine.Spy<() => void> };

  beforeEach(() => {
    authStub = {
      isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(false),
      isAdmin: jasmine.createSpy('isAdmin').and.returnValue(false),
      logout: jasmine.createSpy('logout'),
    };
    tenantStub = { clear: jasmine.createSpy('clear') };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: TenantService, useValue: tenantStub },
      ],
    });
  });

  it('should allow an authenticated admin', () => {
    authStub.isAuthenticated.and.returnValue(true);
    authStub.isAdmin.and.returnValue(true);
    expect(runGuard('/configuration/academy')).toBeTrue();
  });

  it('should redirect an anonymous user to /login', () => {
    authStub.isAuthenticated.and.returnValue(false);
    const result = runGuard('/configuration/courts');

    expect(result instanceof UrlTree).toBeTrue();
    const tree = result as UrlTree;
    expect(tree.toString()).toContain('/login');
  });

  it('should preserve the attempted URL as returnUrl', () => {
    authStub.isAuthenticated.and.returnValue(false);
    const tree = runGuard('/configuration/courts') as UrlTree;

    expect(tree.queryParams['returnUrl']).toBe('/configuration/courts');
  });

  it('should tear down a non-admin (player) session and redirect to /login', () => {
    authStub.isAuthenticated.and.returnValue(true);
    authStub.isAdmin.and.returnValue(false);

    const result = runGuard('/configuration/courts');

    expect(authStub.logout).toHaveBeenCalled();
    expect(tenantStub.clear).toHaveBeenCalled();
    expect(result instanceof UrlTree).toBeTrue();
    expect((result as UrlTree).toString()).toContain('/login');
  });

  it('should not log out an authenticated admin', () => {
    authStub.isAuthenticated.and.returnValue(true);
    authStub.isAdmin.and.returnValue(true);

    runGuard('/configuration/academy');

    expect(authStub.logout).not.toHaveBeenCalled();
  });
});
