import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** The only section a tournament maker may open. */
export const ORGANIZER_HOME = '/tournaments';

/** `/tournaments` itself or anything under it (query / fragment ignored). */
export function isOrganizerUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return path === ORGANIZER_HOME || path.startsWith(`${ORGANIZER_HOME}/`);
}

/**
 * A tournament maker (docs/33 §6) sees ONLY «ტურნირები»: any other shell
 * route — the default redirect and the wildcard included, which resolve to
 * `/reservations` before this runs — lands on `/tournaments`. Admins and
 * superadmins pass untouched. Mounted as `canActivateChild` on the shell.
 */
export const organizerGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  if (!auth.isOrganizer() || isOrganizerUrl(state.url)) {
    return true;
  }
  return inject(Router).createUrlTree([ORGANIZER_HOME]);
};
