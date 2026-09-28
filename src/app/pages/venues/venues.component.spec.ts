import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { VenuesComponent } from './venues.component';
import { TPipe } from '../../shared/i18n/t.pipe';
import { VenueService } from '../../services/http-services/venue.service';
import { AcademyService } from '../../services/http-services/academy.service';
import { FacilityService } from '../../services/http-services/facility.service';
import { Venue, VenueListQuery } from '../../shared/models/venue.model';
import { Facility } from '../../shared/models/facility.model';
import { SsToastService } from '../../shared/ui/toast.service';
import { SsDialogService } from '../../shared/ui/dialog.service';
import { environment } from '../../../environments/environment';

const vake: Venue = {
  _id: 'v-1',
  name: 'ვაკის პადელი',
  nameEn: 'Vake Padel',
  slug: 'vake-padel',
  city: 'Tbilisi',
  district: 'Vake',
  courtsCount: 4,
  indoorCourtsCount: 2,
  hasRoof: true,
  priceMinTetri: 6000,
  priceMaxTetri: 9050,
  kind: 'club',
  status: 'published',
  source: 'manual',
  partnerFacility: 'f-1',
};

const batumi: Venue = {
  _id: 'v-2',
  name: 'ბათუმის კურორტი',
  slug: 'batumi-resort',
  city: 'Batumi',
  courtsCount: 2,
  indoorCourtsCount: 0,
  hasRoof: false,
  kind: 'resort',
  status: 'draft',
  source: 'import',
};

const partnerFacility = {
  _id: 'f-1',
  name: 'ვაკის პადელ კლუბი',
  slug: 'vake-padel-club',
} as Facility;

describe('VenuesComponent', () => {
  let component: VenuesComponent;
  let fixture: ComponentFixture<VenuesComponent>;
  let venueSpy: jasmine.SpyObj<VenueService>;
  let academySpy: jasmine.SpyObj<AcademyService>;
  let facilitySpy: jasmine.SpyObj<FacilityService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let dialogSpy: jasmine.SpyObj<SsDialogService>;
  let alertSpy: jasmine.SpyObj<SsToastService>;

  const lastQuery = (): VenueListQuery => venueSpy.getVenues.calls.mostRecent().args[0];

  beforeEach(async () => {
    venueSpy = jasmine.createSpyObj<VenueService>('VenueService', [
      'getVenues',
      'setStatus',
      'deleteVenue',
    ]);
    venueSpy.getVenues.and.returnValue(
      of({ data: [vake, batumi], page: { page: 1, size: 20, total: 41 } }),
    );
    venueSpy.setStatus.and.returnValue(of({ ...batumi, status: 'published' }));
    venueSpy.deleteVenue.and.returnValue(of(undefined));

    academySpy = jasmine.createSpyObj<AcademyService>('AcademyService', ['getAllAcademies']);
    academySpy.getAllAcademies.and.returnValue(of([{ _id: 'aca-1', name: 'A1' } as never]));
    facilitySpy = jasmine.createSpyObj<FacilityService>('FacilityService', [
      'getFacilitiesByAcademy',
    ]);
    facilitySpy.getFacilitiesByAcademy.and.returnValue(of([partnerFacility]));

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);
    dialogSpy = jasmine.createSpyObj<SsDialogService>('SsDialogService', ['open']);
    alertSpy = jasmine.createSpyObj<SsToastService>('SsToastService', ['open']);
    alertSpy.open.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [VenuesComponent],
      providers: [
        { provide: VenueService, useValue: venueSpy },
        { provide: AcademyService, useValue: academySpy },
        { provide: FacilityService, useValue: facilitySpy },
        { provide: Router, useValue: routerSpy },
        { provide: SsDialogService, useValue: dialogSpy },
        { provide: SsToastService, useValue: alertSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(VenuesComponent, {
        // set:{imports} REPLACES the array — TPipe must ride along or `| t` is NG0302.
        set: { imports: [TPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VenuesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads page 1 without filters on init', () => {
    expect(venueSpy.getVenues).toHaveBeenCalledTimes(1);
    expect(lastQuery()).toEqual({
      page: 1,
      limit: 20,
      q: undefined,
      city: undefined,
      status: undefined,
      kind: undefined,
    });
    expect(component['total']()).toBe(41);
  });

  it('renders one row per venue with its name, English name, price band and status', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="venue-row"]');
    expect(rows.length).toBe(2);
    const first = rows[0].textContent as string;
    expect(first).toContain('ვაკის პადელი');
    expect(first).toContain('Vake Padel');
    expect(first).toContain('₾60–₾90.50');

    const badges = fixture.nativeElement.querySelectorAll('[data-testid="venue-status"]');
    expect(badges[0].textContent.trim()).toBe('გამოქვეყნებული');
    expect(badges[0].className).toContain('ss-badge--positive');
    expect(badges[1].textContent.trim()).toBe('დრაფტი');
  });

  it('debounces the search box and reloads with q on page 1', fakeAsync(() => {
    component['page'].set(3);
    component['onSearchChange']('  vake ');
    expect(venueSpy.getVenues).toHaveBeenCalledTimes(1); // not yet

    tick(400);
    expect(venueSpy.getVenues).toHaveBeenCalledTimes(2);
    expect(lastQuery().q).toBe('vake');
    expect(lastQuery().page).toBe(1);
  }));

  it('city, status and kind filters push their params and restart at page 1', () => {
    component['page'].set(2);
    component['onCityChange']('Batumi');
    expect(lastQuery()).toEqual(jasmine.objectContaining({ city: 'Batumi', page: 1 }));

    component['onStatusFilterChange']('opening_soon');
    expect(lastQuery()).toEqual(
      jasmine.objectContaining({ city: 'Batumi', status: 'opening_soon', page: 1 }),
    );

    component['onKindFilterChange']('resort');
    expect(lastQuery()).toEqual(
      jasmine.objectContaining({ city: 'Batumi', status: 'opening_soon', kind: 'resort' }),
    );

    // '' is "any" — it drops the param again.
    component['onStatusFilterChange']('');
    expect(lastQuery().status).toBeUndefined();
  });

  it('paging keeps the current filters', () => {
    component['onKindFilterChange']('club');
    component['onPageChange'](2);
    expect(lastQuery()).toEqual(jasmine.objectContaining({ page: 2, kind: 'club' }));
  });

  it('a row click opens the editor, but a click on a row control does not', () => {
    const row: HTMLElement = fixture.nativeElement.querySelector('[data-testid="venue-row"]');
    row.click();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/venues', 'v-1']);

    routerSpy.navigate.calls.reset();
    const button = document.createElement('button');
    row.appendChild(button);
    button.click();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('"add" goes to the create page', () => {
    component['addVenue']();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/venues/new']);
  });

  it('status quick-change PATCHes optimistically and toasts on success', () => {
    component['onStatusChange'](batumi, 'published');

    expect(venueSpy.setStatus).toHaveBeenCalledWith('v-2', 'published');
    expect(component['rows']()[1].status).toBe('published');
    expect(alertSpy.open).toHaveBeenCalledWith(
      'შეინახა',
      jasmine.objectContaining({ appearance: 'success' }),
    );
  });

  it('status quick-change reverts the row when the PATCH fails', () => {
    venueSpy.setStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    component['onStatusChange'](batumi, 'published');

    expect(component['rows']()[1].status).toBe('draft');
    expect(alertSpy.open).toHaveBeenCalledWith(
      'შენახვა ვერ მოხერხდა, სცადეთ თავიდან',
      jasmine.objectContaining({ appearance: 'error' }),
    );
  });

  it('picking the current status is a no-op', () => {
    component['onStatusChange'](vake, 'published');
    expect(venueSpy.setStatus).not.toHaveBeenCalled();
  });

  it('delete: confirm → DELETE → reload + toast', () => {
    dialogSpy.open.and.returnValue(of(true));
    venueSpy.getVenues.calls.reset();

    component['deleteVenue'](vake);

    expect(dialogSpy.open).toHaveBeenCalled();
    expect(venueSpy.deleteVenue).toHaveBeenCalledWith('v-1');
    expect(venueSpy.getVenues).toHaveBeenCalledTimes(1);
    expect(alertSpy.open).toHaveBeenCalledWith(
      'წაიშალა',
      jasmine.objectContaining({ appearance: 'success' }),
    );
  });

  it('delete does nothing when the confirm is declined', () => {
    dialogSpy.open.and.returnValue(of(false));
    component['deleteVenue'](vake);
    expect(venueSpy.deleteVenue).not.toHaveBeenCalled();
  });

  it('surfaces the error state when the list fetch fails', () => {
    venueSpy.getVenues.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    component['retry']();
    expect(component['hasError']()).toBeTrue();
  });

  describe('display helpers', () => {
    it('formats the price band in GEL', () => {
      expect(component['priceBand'](vake)).toBe('₾60–₾90.50');
      expect(component['priceBand']({ ...vake, priceMaxTetri: undefined })).toBe('₾60+');
      expect(component['priceBand']({ ...vake, priceMinTetri: undefined })).toBe('≤ ₾90.50');
      expect(component['priceBand']({ ...vake, priceMaxTetri: 6000 })).toBe('₾60');
      expect(component['priceBand'](batumi)).toBe('—');
    });

    it('labels the place as city · district, or just the town', () => {
      expect(component['placeLabel'](vake)).toBe('თბილისი · ვაკე');
      expect(component['placeLabel'](batumi)).toBe('ბათუმი');
      expect(component['placeLabel']({ ...batumi, city: 'Gori' })).toBe('Gori');
      expect(
        component['placeLabel']({ ...vake, district: undefined, landmark: 'kus-tba' }),
      ).toBe('თბილისი · კუს ტბა');
    });

    it('links a partner venue to its facility page on the player app', () => {
      expect(component['partnerName'](vake)).toBe('ვაკის პადელ კლუბი');
      expect(component['partnerUrl'](vake)).toBe(
        `${environment.siteUrl}/facilities/vake-padel-club`,
      );
      expect(component['partnerUrl'](batumi)).toBeNull();
      expect(component['partnerName'](batumi)).toBe('');
      // A link to a facility the picker could not load still resolves by id.
      expect(component['partnerUrl']({ ...vake, partnerFacility: 'f-gone' })).toBe(
        `${environment.siteUrl}/facilities/f-gone`,
      );
    });

    it('maps status, kind and source to their badges', () => {
      expect(component['statusClass']('opening_soon')).toBe('ss-badge ss-badge--warning');
      expect(component['statusLabel']('closed')).toBe('დახურულია');
      expect(component['kindLabel']('resort')).toBe('კურორტი');
      expect(component['sourceLabel'](batumi)).toBe('იმპორტი');
    });
  });
});
