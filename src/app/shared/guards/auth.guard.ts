import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TenantService } from '../services/tenant.service';

/**
 * Blocks unauthenticated AND non-operator access. Redirects to `/login`,
 * preserving the attempted URL as `returnUrl`. Operators are admins,
 * superadmins and tournament makers (organizers, docs/33 §6 — their reach is
 * narrowed further by `organizerGuard`).
 *
 * A persisted player token (issued by the shared `/auth/login` before the
 * role check existed, or copied over from the webapp) would pass a pure
 * "is authenticated" check and then 403 on every admin endpoint — so an
 * authenticated-but-non-operator session is torn down here instead.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const tenant = inject(TenantService);

  if (auth.isAuthenticated()) {
    if (auth.isAdmin() || auth.isOrganizer()) {
      return true;
    }
    auth.logout();
    tenant.clear();
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
