import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';

import { TenantService } from './tenant.service';
import { AcademyService } from '../../services/http-services/academy.service';
import { Academy, AcademyStatus } from '../models/academy.model';

const mockAcademy: Academy = {
  _id: 'academy-1',
  name: 'Sports Academy',
  admins: [],
  status: AcademyStatus.PUBLISHED,
};

describe('TenantService', () => {
  let service: TenantService;
  let academyServiceSpy: jasmine.SpyObj<AcademyService>;

  function configure() {
    TestBed.configureTestingModule({
      providers: [
        TenantService,
        { provide: AcademyService, useValue: academyServiceSpy },
      ],
    });
    service = TestBed.inject(TenantService);
  }

  beforeEach(() => {
    academyServiceSpy = jasmine.createSpyObj<AcademyService>('AcademyService', ['getMyAcademy']);
  });

  // ─── Operator resolution via /academy/my ──────────────────────────────────

  describe('operator resolution via /academy/my', () => {
    beforeEach(() => {
      academyServiceSpy.getMyAcademy.and.returnValue(of(mockAcademy));
      configure();
    });

    it('should resolve the academy through getMyAcademy (a single /my call)', (done) => {
      service.resolveAcademy().subscribe((academy) => {
        expect(academy).toEqual(mockAcademy);
        expect(academyServiceSpy.getMyAcademy).toHaveBeenCalledTimes(1);
        expect(service.academyId()).toBe('academy-1');
        expect(service.hasTenant()).toBeTrue();
        done();
      });
    });

    it('should never call the per-id endpoint (no getAcademyById)', (done) => {
      service.resolveAcademy().subscribe(() => {
        expect((academyServiceSpy as unknown as Record<string, unknown>)['getAcademyById'])
          .toBeUndefined();
        done();
      });
    });

    it('should cache-hit on the second call (no second request)', (done) => {
      service.resolveAcademy().subscribe(() => {
        service.resolveAcademy().subscribe((academy) => {
          expect(academy).toEqual(mockAcademy);
          expect(academyServiceSpy.getMyAcademy).toHaveBeenCalledTimes(1);
          done();
        });
      });
    });
  });

  // ─── ensure(): replay for hard-refresh / deep-link page init ───────────────

  describe('ensure() — replay for hard-refresh page init', () => {
    it('de-duplicates concurrent first calls into a single /my request', () => {
      const subject = new Subject<Academy | null>();
      academyServiceSpy.getMyAcademy.and.returnValue(subject.asObservable());
      configure();

      // Two pages init "simultaneously" before the request settles.
      let a: Academy | null | undefined;
      let b: Academy | null | undefined;
      service.ensure().subscribe((v) => (a = v));
      service.ensure().subscribe((v) => (b = v));

      subject.next(mockAcademy);
      subject.complete();

      expect(academyServiceSpy.getMyAcademy).toHaveBeenCalledTimes(1);
      expect(a).toEqual(mockAcademy);
      expect(b).toEqual(mockAcademy);
      expect(service.academyId()).toBe('academy-1');
    });

    it('replays the already-resolved academy to a late subscriber without re-fetching', (done) => {
      academyServiceSpy.getMyAcademy.and.returnValue(of(mockAcademy));
      configure();

      // First resolution (as if the login flow ran).
      service.ensure().subscribe(() => {
        // A page that initializes later (hard refresh) must get the cached value.
        service.ensure().subscribe((academy) => {
          expect(academy).toEqual(mockAcademy);
          expect(academyServiceSpy.getMyAcademy).toHaveBeenCalledTimes(1);
          done();
        });
      });
    });
  });

  // ─── Superadmin / no-academy null path ────────────────────────────────────

  describe('superadmin / no-academy null path', () => {
    beforeEach(() => {
      // The API returns null data for a superadmin or an operator with no academy.
      academyServiceSpy.getMyAcademy.and.returnValue(of(null));
      configure();
    });

    it('should resolve to null and report no tenant', (done) => {
      service.ensure().subscribe((academy) => {
        expect(academy).toBeNull();
        expect(service.academyId()).toBeNull();
        expect(service.hasTenant()).toBeFalse();
        done();
      });
    });

    it('should cache the null result and not re-resolve on a second call', (done) => {
      service.resolveAcademy().subscribe(() => {
        service.resolveAcademy().subscribe((academy) => {
          expect(academy).toBeNull();
          expect(academyServiceSpy.getMyAcademy).toHaveBeenCalledTimes(1);
          done();
        });
      });
    });
  });

  // ─── clear() ───────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('resets the cache so the next ensure() re-fetches', (done) => {
      academyServiceSpy.getMyAcademy.and.returnValue(of(mockAcademy));
      configure();

      service.ensure().subscribe(() => {
        service.clear();
        expect(service.academyId()).toBeNull();

        service.ensure().subscribe((academy) => {
          expect(academy).toEqual(mockAcademy);
          expect(academyServiceSpy.getMyAcademy).toHaveBeenCalledTimes(2);
          done();
        });
      });
    });
  });
});
