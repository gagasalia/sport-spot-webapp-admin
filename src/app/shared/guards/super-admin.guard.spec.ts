import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { superAdminGuard } from './super-admin.guard';
import { AuthService } from '../services/auth.service';

function runGuard(url: string) {
  const state = { url } as RouterStateSnapshot;
  const route = {} as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => superAdminGuard(route, state));
}

describe('superAdminGuard', () => {
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated', 'isSuperAdmin']);

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authSpy }],
    });
    TestBed.inject(Router);
  });

  it('should allow a superadmin', () => {
    authSpy.isAuthenticated.and.returnValue(true);
    authSpy.isSuperAdmin.and.returnValue(true);

    expect(runGuard('/super-admin/user-management')).toBeTrue();
  });

  it('should redirect an anonymous user to /login with returnUrl', () => {
    authSpy.isAuthenticated.and.returnValue(false);
    authSpy.isSuperAdmin.and.returnValue(false);

    const tree = runGuard('/super-admin/user-management') as UrlTree;
    expect(tree instanceof UrlTree).toBeTrue();
    expect(tree.toString()).toContain('/login');
    expect(tree.queryParams['returnUrl']).toBe('/super-admin/user-management');
  });

  it('should reject an authenticated non-superadmin by redirecting to the root', () => {
    authSpy.isAuthenticated.and.returnValue(true);
    authSpy.isSuperAdmin.and.returnValue(false);

    const tree = runGuard('/super-admin/academies-management') as UrlTree;
    expect(tree instanceof UrlTree).toBeTrue();
    expect(tree.toString()).toBe('/');
  });
});
