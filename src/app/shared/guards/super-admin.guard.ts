import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Restricts super-admin routes. Anonymous users go to `/login`;
 * authenticated non-superadmins are sent back to the app root.
 */
export const superAdminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  if (auth.isSuperAdmin()) {
    return true;
  }

  return router.createUrlTree(['/']);
};
