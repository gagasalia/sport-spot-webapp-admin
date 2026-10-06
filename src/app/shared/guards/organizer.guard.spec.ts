import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { isOrganizerUrl, organizerGuard } from './organizer.guard';
import { AuthService } from '../services/auth.service';

function runGuard(url: string) {
  const state = { url } as RouterStateSnapshot;
  return TestBed.runInInjectionContext(() =>
    organizerGuard({} as ActivatedRouteSnapshot, state),
  );
}

// docs/33 §6: a tournament maker sees ONLY «ტურნირები».
describe('organizerGuard', () => {
  let organizer: boolean;

  beforeEach(() => {
    organizer = false;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isOrganizer: () => organizer } },
      ],
    });
  });

  it('lets an admin / superadmin open any route (today’s behaviour)', () => {
    for (const url of ['/reservations', '/statistics', '/super-admin/user-management', '/tournaments']) {
      expect(runGuard(url)).toBeTrue();
    }
  });

  it('lets an organizer open /tournaments and anything under it', () => {
    organizer = true;
    expect(runGuard('/tournaments')).toBeTrue();
    expect(runGuard('/tournaments/66a1b2c3d4e5f6a7b8c9d0e1')).toBeTrue();
    expect(runGuard('/tournaments?page=2')).toBeTrue();
  });

  it('sends an organizer anywhere else to /tournaments (the default redirect and the wildcard land on /reservations first)', () => {
    organizer = true;
    for (const url of ['/reservations', '/customers/1', '/configuration/academy', '/tournamentsx']) {
      const result = runGuard(url);
      expect(result instanceof UrlTree).withContext(url).toBeTrue();
      expect((result as UrlTree).toString()).toBe('/tournaments');
    }
  });

  it('isOrganizerUrl ignores the query and the fragment', () => {
    expect(isOrganizerUrl('/tournaments#x')).toBeTrue();
    expect(isOrganizerUrl('/tournaments/abc?tab=draw')).toBeTrue();
    expect(isOrganizerUrl('/')).toBeFalse();
    expect(isOrganizerUrl('/tournaments-old')).toBeFalse();
  });
});
