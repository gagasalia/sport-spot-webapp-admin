import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { TenantService } from './tenant.service';
import { AuthService } from './auth.service';
import { AcademyService } from '../../services/http-services/academy.service';
import { Academy, AcademyStatus } from '../models/academy.model';
import { JwtPayload } from '../models/auth.model';

// `isSuperAdmin` and `currentUser` are Angular Signals (callables), so the stubs
// model them as plain callable spies rather than createSpyObj method entries.
interface AuthStub {
  isSuperAdmin: jasmine.Spy<() => boolean>;
  currentUser: jasmine.Spy<() => JwtPayload | null>;
}

const mockAcademy: Academy = {
  _id: 'academy-1',
  name: 'Sports Academy',
  admins: [],
  status: AcademyStatus.PUBLISHED,
};

function makePayload(sub: string): JwtPayload {
  return { sub, email: 'op@example.com', userType: ['admin'], academies: [] };
}

describe('TenantService', () => {
  let service: TenantService;
  let authStub: AuthStub;
  let academyServiceSpy: jasmine.SpyObj<AcademyService>;

  function configure() {
    TestBed.configureTestingModule({
      providers: [
        TenantService,
        { provide: AuthService, useValue: authStub },
        { provide: AcademyService, useValue: academyServiceSpy },
      ],
    });
    service = TestBed.inject(TenantService);
  }

  beforeEach(() => {
    authStub = {
      isSuperAdmin: jasmine.createSpy('isSuperAdmin').and.returnValue(false),
      currentUser: jasmine.createSpy('currentUser').and.returnValue(null),
    };
    academyServiceSpy = jasmine.createSpyObj<AcademyService>('AcademyService', ['getAcademyById']);
  });

  // ─── Superadmin ───────────────────────────────────────────────────────────

  describe('superadmin', () => {
    beforeEach(() => {
      authStub.isSuperAdmin.and.returnValue(true);
      configure();
    });

    it('should resolve to null without calling AcademyService', (done) => {
      service.resolveAcademy().subscribe((academy) => {
        expect(academy).toBeNull();
        expect(academyServiceSpy.getAcademyById).not.toHaveBeenCalled();
        done();
      });
    });

    it('should cache the null result and not re-resolve on a second call', (done) => {
      service.resolveAcademy().subscribe(() => {
        // Flip the flag: a cached resolution must ignore it.
        authStub.isSuperAdmin.and.returnValue(false);
        authStub.currentUser.and.returnValue(makePayload('user-1'));

        service.resolveAcademy().subscribe((academy) => {
          expect(academy).toBeNull();
          expect(academyServiceSpy.getAcademyById).not.toHaveBeenCalled();
          done();
        });
      });
    });
  });

  // ─── Operator with a user id ──────────────────────────────────────────────

  describe('operator with a userId', () => {
    beforeEach(() => {
      authStub.isSuperAdmin.and.returnValue(false);
      authStub.currentUser.and.returnValue(makePayload('user-1'));
      academyServiceSpy.getAcademyById.and.returnValue(of(mockAcademy));
      configure();
    });

    it('should call getAcademyById once with the user id and resolve the academy', (done) => {
      service.resolveAcademy().subscribe((academy) => {
        expect(academy).toEqual(mockAcademy);
        expect(academyServiceSpy.getAcademyById).toHaveBeenCalledOnceWith('user-1');
        expect(service.academyId()).toBe('academy-1');
        done();
      });
    });

    it('should cache-hit on the second call (no second request)', (done) => {
      service.resolveAcademy().subscribe(() => {
        service.resolveAcademy().subscribe((academy) => {
          expect(academy).toEqual(mockAcademy);
          expect(academyServiceSpy.getAcademyById).toHaveBeenCalledTimes(1);
          done();
        });
      });
    });
  });

  // ─── Operator without a user id ───────────────────────────────────────────

  describe('operator without a userId', () => {
    beforeEach(() => {
      authStub.isSuperAdmin.and.returnValue(false);
      authStub.currentUser.and.returnValue(null);
      configure();
    });

    it('should resolve to null without calling AcademyService', (done) => {
      service.resolveAcademy().subscribe((academy) => {
        expect(academy).toBeNull();
        expect(academyServiceSpy.getAcademyById).not.toHaveBeenCalled();
        expect(service.academyId()).toBeNull();
        done();
      });
    });
  });
});
