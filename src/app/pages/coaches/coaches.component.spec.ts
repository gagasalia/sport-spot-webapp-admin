import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CoachesComponent } from './coaches.component';
import { TPipe } from '../../shared/i18n/t.pipe';
import { CoachService } from '../../services/http-services/coach.service';
import { AcademyService } from '../../services/http-services/academy.service';
import { AuthService } from '../../shared/services/auth.service';
import { TenantService } from '../../shared/services/tenant.service';
import { Academy, AcademyStatus } from '../../shared/models/academy.model';
import { Coach, CoachListQuery } from '../../shared/models/coach.model';
import { SsToastService } from '../../shared/ui/toast.service';
import { SsDialogService } from '../../shared/ui/dialog.service';

const base: Omit<Coach, '_id' | 'name' | 'slug' | 'status'> = {
  bio: 'ბიო',
  languages: ['ka'],
  levels: [],
  certifications: [],
  city: 'Tbilisi',
  facilities: [],
  venues: [],
};

const draft: Coach = {
  ...base,
  _id: 'c-1',
  name: 'გიორგი ბერიძე',
  nameEn: 'Giorgi Beridze',
  slug: 'giorgi-beridze',
  district: 'Vake',
  academy: 'aca-1',
  levels: ['beginner', 'advanced'],
  priceIndividualTetri: 8000,
  priceGroupTetri: 3550,
  photo: {
    url: 'https://cdn.example/g-web.webp',
    thumbUrl: 'https://cdn.example/g.webp',
    type: 'image/webp',
  },
  status: 'draft',
};

const published: Coach = {
  ...base,
  _id: 'c-2',
  name: 'ნინო კაპანაძე',
  slug: 'nino-kapanadze',
  city: 'Batumi',
  academy: null,
  status: 'published',
};

const academies: Academy[] = [
  { _id: 'aca-1', name: 'ვაკის აკადემია', admins: [], status: AcademyStatus.PUBLISHED },
];

describe('CoachesComponent', () => {
  let component: CoachesComponent;
  let fixture: ComponentFixture<CoachesComponent>;
  let coachSpy: jasmine.SpyObj<CoachService>;
  let academySpy: jasmine.SpyObj<AcademyService>;
  let tenantStub: { ensure: jasmine.Spy };
  let routerSpy: jasmine.SpyObj<Router>;
  let dialogSpy: jasmine.SpyObj<SsDialogService>;
  let alertSpy: jasmine.SpyObj<SsToastService>;

  const lastQuery = (): CoachListQuery => coachSpy.getCoaches.calls.mostRecent().args[0];
  const rows = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid="coach-row"]'));
  const cell = (row: HTMLElement, testid: string): string =>
    (row.querySelector(`[data-testid="${testid}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  async function setup(superAdmin = true) {
    coachSpy = jasmine.createSpyObj<CoachService>('CoachService', [
      'getCoaches',
      'setStatus',
      'deleteCoach',
    ]);
    coachSpy.getCoaches.and.returnValue(
      of({ data: [draft, published], page: { page: 1, size: 20, total: 41 } }),
    );
    coachSpy.setStatus.and.callFake((id, status) =>
      of({ ...(id === draft._id ? draft : published), status }),
    );
    coachSpy.deleteCoach.and.returnValue(of(undefined));

    academySpy = jasmine.createSpyObj<AcademyService>('AcademyService', ['getAllAcademies']);
    academySpy.getAllAcademies.and.returnValue(of(academies));
    tenantStub = {
      ensure: jasmine
        .createSpy('ensure')
        .and.returnValue(of({ _id: 'aca-1', name: 'ჩემი აკადემია' } as Academy)),
    };

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);
    dialogSpy = jasmine.createSpyObj<SsDialogService>('SsDialogService', ['open']);
    dialogSpy.open.and.returnValue(of(true));
    alertSpy = jasmine.createSpyObj<SsToastService>('SsToastService', ['open']);
    alertSpy.open.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [CoachesComponent],
      providers: [
        { provide: CoachService, useValue: coachSpy },
        { provide: AcademyService, useValue: academySpy },
        { provide: AuthService, useValue: { isSuperAdmin: signal(superAdmin) } },
        { provide: TenantService, useValue: tenantStub },
        { provide: Router, useValue: routerSpy },
        { provide: SsDialogService, useValue: dialogSpy },
        { provide: SsToastService, useValue: alertSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(CoachesComponent, {
        // set:{imports} REPLACES the array — TPipe must ride along or the
        // template fails with NG0302 (ss-avatar falls under NO_ERRORS_SCHEMA).
        set: { imports: [TPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CoachesComponent);
    component = fixture.componentInstance;
    component['isMobile'].set(false);
    fixture.detectChanges();
  }

  describe('as a superadmin', () => {
    beforeEach(async () => setup(true));

    it('loads page 1 without filters on init', () => {
      expect(coachSpy.getCoaches).toHaveBeenCalledTimes(1);
      expect(lastQuery()).toEqual({
        page: 1,
        limit: 20,
        q: undefined,
        status: undefined,
        city: undefined,
      });
      expect(component['total']()).toBe(41);
      expect(component['totalPages']()).toBe(3);
    });

    it('renders one row per coach: names, place, academy, levels and prices', () => {
      expect(rows().length).toBe(2);
      const [first, second] = rows();
      expect(first.textContent).toContain('გიორგი ბერიძე');
      expect(first.textContent).toContain('Giorgi Beridze');
      expect(first.textContent).toContain('თბილისი · ვაკე');
      expect(cell(first, 'coach-academy')).toBe('ვაკის აკადემია');
      expect(cell(first, 'coach-levels')).toBe('დამწყები, გამოცდილი');
      expect(cell(first, 'coach-price')).toContain('ინდივიდუალური: ₾80');
      expect(cell(first, 'coach-price')).toContain('ჯგუფური: ₾35.50');

      expect(second.textContent).toContain('ბათუმი');
      expect(cell(second, 'coach-academy')).toBe('დამოუკიდებელი');
      expect(cell(second, 'coach-levels')).toBe('—');
      expect(cell(second, 'coach-price')).toBe('—');
      // the superadmin names every academy
      expect(academySpy.getAllAcademies).toHaveBeenCalled();
      expect(tenantStub.ensure).not.toHaveBeenCalled();
    });

    it('shows the photo thumb (thumb rendition first)', () => {
      expect(component['photoUrl'](draft)).toBe('https://cdn.example/g.webp');
      expect(component['photoUrl'](published)).toBeNull();
      expect(rows()[0].querySelector('ss-avatar')).not.toBeNull();
    });

    it('colours the status badges and labels the quick toggle by status', () => {
      const badges: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[data-testid="coach-status"]'),
      );
      expect(badges.map((b) => b.textContent!.trim())).toEqual(['დრაფტი', 'გამოქვეყნებული']);
      expect(badges[0].className).toContain('ss-badge--neutral');
      expect(badges[1].className).toContain('ss-badge--positive');

      expect(cell(rows()[0], 'coach-toggle')).toBe('გამოქვეყნება');
      expect(cell(rows()[1], 'coach-toggle')).toBe('დამალვა');
    });

    it('debounces the search box and reloads with q on page 1', fakeAsync(() => {
      component['page'].set(3);
      component['onSearchChange']('  გიორგი ');
      expect(coachSpy.getCoaches).toHaveBeenCalledTimes(1); // not yet

      tick(400);
      expect(coachSpy.getCoaches).toHaveBeenCalledTimes(2);
      expect(lastQuery().q).toBe('გიორგი');
      expect(lastQuery().page).toBe(1);
    }));

    it('status and city filters push their params and restart at page 1', () => {
      component['page'].set(2);
      component['onStatusFilterChange']('published');
      expect(lastQuery()).toEqual(jasmine.objectContaining({ status: 'published', page: 1 }));

      component['onCityChange']('Batumi');
      expect(lastQuery()).toEqual(
        jasmine.objectContaining({ status: 'published', city: 'Batumi', page: 1 }),
      );

      // '' is "any" — it drops the param again.
      component['onStatusFilterChange']('');
      expect(lastQuery().status).toBeUndefined();
      expect(lastQuery().city).toBe('Batumi');
    });

    it('paging keeps the current filters', () => {
      component['onCityChange']('Tbilisi');
      component['onPageChange'](2);
      expect(lastQuery()).toEqual(jasmine.objectContaining({ page: 2, city: 'Tbilisi' }));
    });

    it('publishing a draft confirms, PATCHes the status and swaps the row in', () => {
      (rows()[0].querySelector('[data-testid="coach-toggle"]') as HTMLElement).click();

      expect(dialogSpy.open).toHaveBeenCalledTimes(1);
      expect(coachSpy.setStatus).toHaveBeenCalledOnceWith('c-1', 'published');
      expect(component['rows']()[0].status).toBe('published');
      expect(component['busyIds']().size).toBe(0);
      expect(alertSpy.open).toHaveBeenCalledWith(
        'გამოქვეყნდა',
        jasmine.objectContaining({ appearance: 'success' }),
      );
      // the click acted in place — it did not open the editor
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('hiding a published coach sends it back to draft', () => {
      component['toggleStatus'](published);

      expect(coachSpy.setStatus).toHaveBeenCalledOnceWith('c-2', 'draft');
      expect(component['rows']()[1].status).toBe('draft');
      expect(alertSpy.open).toHaveBeenCalledWith(
        'დაიმალა',
        jasmine.objectContaining({ appearance: 'success' }),
      );
    });

    it('a declined confirmation changes nothing', () => {
      dialogSpy.open.and.returnValue(of(false));
      component['toggleStatus'](draft);
      expect(coachSpy.setStatus).not.toHaveBeenCalled();
      expect(component['rows']()[0].status).toBe('draft');
    });

    it('a failed status change keeps the row and toasts', () => {
      coachSpy.setStatus.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 403 })),
      );
      component['toggleStatus'](draft);

      expect(component['rows']()[0].status).toBe('draft');
      expect(component['busyIds']().size).toBe(0);
      expect(alertSpy.open).toHaveBeenCalledWith(
        'სტატუსის შეცვლა ვერ მოხერხდა, სცადეთ თავიდან',
        jasmine.objectContaining({ appearance: 'error' }),
      );
    });

    it('a row click opens the editor, but a click on a row control does not', () => {
      rows()[0].click();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/coaches', 'c-1']);

      routerSpy.navigate.calls.reset();
      dialogSpy.open.and.returnValue(of(false));
      (rows()[0].querySelector('[data-testid="coach-delete"]') as HTMLElement).click();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('"add coach" goes to the create page', () => {
      component['addCoach']();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/coaches/new']);
    });

    it('delete: confirm → DELETE → reload + toast', () => {
      coachSpy.getCoaches.calls.reset();

      component['deleteCoach'](draft);

      expect(dialogSpy.open).toHaveBeenCalled();
      expect(coachSpy.deleteCoach).toHaveBeenCalledWith('c-1');
      expect(coachSpy.getCoaches).toHaveBeenCalledTimes(1);
      expect(alertSpy.open).toHaveBeenCalledWith(
        'წაიშალა',
        jasmine.objectContaining({ appearance: 'success' }),
      );
    });

    it('delete does nothing when the confirm is declined', () => {
      dialogSpy.open.and.returnValue(of(false));
      component['deleteCoach'](draft);
      expect(coachSpy.deleteCoach).not.toHaveBeenCalled();
    });

    it('surfaces the error state when the list fetch fails', () => {
      coachSpy.getCoaches.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      component['retry']();
      expect(component['hasError']()).toBeTrue();
    });
  });

  describe('as an academy operator (ADMIN)', () => {
    beforeEach(async () => setup(false));

    it('names the academy from the operator\'s own tenant, never the superadmin list', () => {
      expect(tenantStub.ensure).toHaveBeenCalled();
      expect(academySpy.getAllAcademies).not.toHaveBeenCalled();
      expect(cell(rows()[0], 'coach-academy')).toBe('ჩემი აკადემია');
    });
  });
});
