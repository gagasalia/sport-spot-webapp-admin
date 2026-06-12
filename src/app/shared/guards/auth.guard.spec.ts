import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { provideRouter } from '@angular/router';

import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

function runGuard(url: string) {
  const state = { url } as RouterStateSnapshot;
  const route = {} as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => authGuard(route, state));
}

describe('authGuard', () => {
  // `isAuthenticated` is an Angular Signal (a callable), not a plain method. A
  // createSpyObj methods-array entry would model it as `Spy<() => void>` and
  // type-check awkwardly; a plain stub with a callable spy mirrors the Signal
  // shape exactly.
  let authStub: { isAuthenticated: jasmine.Spy<() => boolean> };

  beforeEach(() => {
    authStub = { isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(false) };

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authStub }],
    });
  });

  it('should allow an authenticated user', () => {
    authStub.isAuthenticated.and.returnValue(true);
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
});
