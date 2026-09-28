import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { OTHER_CITY, VenueEditComponent, countWords } from './venue-edit.component';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { VenueService } from '../../../services/http-services/venue.service';
import { AcademyService } from '../../../services/http-services/academy.service';
import { FacilityService } from '../../../services/http-services/facility.service';
import { CreateVenueDto, UpdateVenueDto, Venue } from '../../../shared/models/venue.model';
import { Facility } from '../../../shared/models/facility.model';
import { SsToastService } from '../../../shared/ui/toast.service';

const existing: Venue = {
  _id: 'v-1',
  name: 'გორის პადელი',
  nameEn: 'Gori Padel',
  slug: 'gori-padel',
  city: 'Gori',
  citySlug: 'gori',
  address: 'სტალინის 1',
  lat: 41.98,
  lng: 44.11,
  website: 'https://gori-padel.ge',
  courtsCount: 3,
  indoorCourtsCount: 1,
  hasRoof: true,
  priceMinTetri: 5000,
  priceMaxTetri: 7550,
  racketRentalTetri: 500,
  openingHours: {
    mon: { open: '10:00', close: '22:00' },
    tue: { open: '10:00', close: '22:00' },
    wed: { open: '10:00', close: '22:00' },
    thu: { open: '10:00', close: '22:00' },
    fri: { open: '10:00', close: '01:00' },
    sat: { open: '09:00', close: '01:00' },
    sun: null,
  },
  description: 'ორი სიტყვა',
  kind: 'club',
  status: 'published',
  partnerFacility: 'f-1',
  source: 'import',
  sourceUrl: 'https://example.com/gori',
};

describe('VenueEditComponent', () => {
  let component: VenueEditComponent;
  let fixture: ComponentFixture<VenueEditComponent>;
  let venueSpy: jasmine.SpyObj<VenueService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let alertSpy: jasmine.SpyObj<SsToastService>;

  async function setup(id?: string) {
    venueSpy = jasmine.createSpyObj<VenueService>('VenueService', [
      'getVenue',
      'createVenue',
      'updateVenue',
    ]);
    venueSpy.getVenue.and.returnValue(of(existing));
    venueSpy.createVenue.and.returnValue(of({ ...existing, _id: 'v-new' }));
    venueSpy.updateVenue.and.returnValue(of(existing));

    const academySpy = jasmine.createSpyObj<AcademyService>('AcademyService', [
      'getAllAcademies',
    ]);
    academySpy.getAllAcademies.and.returnValue(of([{ _id: 'aca-1', name: 'A1' } as never]));
    const facilitySpy = jasmine.createSpyObj<FacilityService>('FacilityService', [
      'getFacilitiesByAcademy',
    ]);
    facilitySpy.getFacilitiesByAcademy.and.returnValue(
      of([{ _id: 'f-1', name: 'ვაკის პადელი' } as Facility]),
    );

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);
    alertSpy = jasmine.createSpyObj<SsToastService>('SsToastService', ['open']);
    alertSpy.open.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [VenueEditComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap(id ? { id } : {})) },
        },
        { provide: VenueService, useValue: venueSpy },
        { provide: AcademyService, useValue: academySpy },
        { provide: FacilityService, useValue: facilitySpy },
        { provide: Router, useValue: routerSpy },
        { provide: SsToastService, useValue: alertSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(VenueEditComponent, {
        // set:{imports} REPLACES the array — TPipe (and the date pipe) must ride
        // along or the template fails with NG0302.
        set: { imports: [ReactiveFormsModule, DatePipe, TPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VenueEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const form = () => component.form;
  const createBody = (): CreateVenueDto => venueSpy.createVenue.calls.mostRecent().args[0];
  const updateBody = (): UpdateVenueDto => venueSpy.updateVenue.calls.mostRecent().args[1];

  describe('create mode (/venues/new)', () => {
    beforeEach(async () => setup());

    it('starts empty and invalid until the name is filled', () => {
      expect(component['isEditMode']).toBeFalse();
      expect(venueSpy.getVenue).not.toHaveBeenCalled();
      expect(form().invalid).toBeTrue();
      expect(form().controls.name.hasError('required')).toBeTrue();

      form().controls.name.setValue('ვაკის პადელი');
      expect(form().valid).toBeTrue();
    });

    it('treats the slug as optional but validates its format', () => {
      form().controls.name.setValue('X');
      expect(form().controls.slug.hasError('required')).toBeFalse();

      form().controls.slug.setValue('Vake Padel');
      expect(form().controls.slug.hasError('pattern')).toBeTrue();
      form().controls.slug.setValue('vake-padel-2');
      expect(form().controls.slug.valid).toBeTrue();
    });

    it('rejects more indoor courts than courts, and an inverted price band', () => {
      form().controls.name.setValue('X');
      form().patchValue({ courtsCount: 2, indoorCourtsCount: 3 });
      expect(form().hasError('indoorExceedsTotal')).toBeTrue();
      form().patchValue({ indoorCourtsCount: 2 });
      expect(form().hasError('indoorExceedsTotal')).toBeFalse();

      form().patchValue({ priceMinGel: 80, priceMaxGel: 60 });
      expect(form().hasError('priceBandInverted')).toBeTrue();
      form().patchValue({ priceMaxGel: 80 });
      expect(form().valid).toBeTrue();
    });

    it('rejects fractional court counts and GEL amounts with more than two decimals', () => {
      form().controls.courtsCount.setValue(2.5);
      expect(form().controls.courtsCount.hasError('integer')).toBeTrue();
      form().controls.courtsCount.setValue(-1);
      expect(form().controls.courtsCount.hasError('min')).toBeTrue();

      form().controls.priceMinGel.setValue(25.555);
      expect(form().controls.priceMinGel.hasError('decimals')).toBeTrue();
      form().controls.priceMinGel.setValue(25.55);
      expect(form().controls.priceMinGel.valid).toBeTrue();
    });

    it('mirrors the API caps: ≤100 courts, ≤10 000 ₾, 120-char names, 80-char slugs', () => {
      form().controls.courtsCount.setValue(101);
      expect(form().controls.courtsCount.hasError('max')).toBeTrue();
      form().controls.priceMaxGel.setValue(10_000.01);
      expect(form().controls.priceMaxGel.hasError('max')).toBeTrue();
      form().controls.name.setValue('x'.repeat(121));
      expect(form().controls.name.hasError('maxlength')).toBeTrue();
      form().controls.slug.setValue('a'.repeat(81));
      expect(form().controls.slug.hasError('maxlength')).toBeTrue();
    });

    it('requires a typed town only when "other town" is picked', () => {
      form().controls.name.setValue('X');
      form().controls.city.setValue(OTHER_CITY);
      expect(form().controls.cityOther.enabled).toBeTrue();
      expect(form().invalid).toBeTrue();

      form().controls.cityOther.setValue('გორი');
      expect(form().valid).toBeTrue();

      form().controls.city.setValue('Batumi');
      expect(form().controls.cityOther.disabled).toBeTrue();
    });

    it('validates URLs and coordinates', () => {
      form().controls.website.setValue('gori-padel.ge');
      expect(form().controls.website.hasError('pattern')).toBeTrue();
      form().controls.website.setValue('https://gori-padel.ge');
      expect(form().controls.website.valid).toBeTrue();

      form().controls.lat.setValue(95);
      expect(form().controls.lat.hasError('max')).toBeTrue();
    });

    it('submit converts GEL to tetri, omits empty optionals and returns to the list', () => {
      form().patchValue({
        name: '  ვაკის პადელი ',
        city: 'Tbilisi',
        district: 'Vake',
        landmark: 'lisi',
        courtsCount: 4,
        indoorCourtsCount: 2,
        hasRoof: true,
        priceMinGel: 25.5,
        priceMaxGel: 40,
        racketRentalGel: 7.25,
        website: 'https://vake.ge',
        partnerFacility: 'f-1',
      });

      component['onSubmit']();

      expect(createBody()).toEqual({
        name: 'ვაკის პადელი',
        kind: 'club',
        status: 'draft',
        city: 'Tbilisi',
        district: 'Vake',
        landmark: 'lisi',
        website: 'https://vake.ge',
        courtsCount: 4,
        indoorCourtsCount: 2,
        hasRoof: true,
        priceMinTetri: 2550,
        priceMaxTetri: 4000,
        racketRentalTetri: 725,
        partnerFacility: 'f-1',
      });
      expect(alertSpy.open).toHaveBeenCalledWith(
        'შეიქმნა',
        jasmine.objectContaining({ appearance: 'success' }),
      );
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/venues']);
    });

    it('a typed town is sent as the city, and Tbilisi-only district/landmark are dropped', () => {
      form().patchValue({
        name: 'X',
        district: 'Vake',
        landmark: 'lisi',
        city: OTHER_CITY,
        cityOther: ' გორი ',
      });

      component['onSubmit']();

      const body = createBody();
      expect(body.city).toBe('გორი');
      expect('district' in body).toBeFalse();
      expect('landmark' in body).toBeFalse();
      expect('openingHours' in body).toBeFalse();
    });

    it('an invalid submit touches every field, toasts and sends nothing', () => {
      component['onSubmit']();

      expect(venueSpy.createVenue).not.toHaveBeenCalled();
      expect(form().controls.name.touched).toBeTrue();
      expect(alertSpy.open).toHaveBeenCalledWith(
        'გთხოვთ შეავსოთ ყველა სავალდებულო ველი',
        jasmine.objectContaining({ appearance: 'error' }),
      );
    });

    it('a 409 marks the slug as taken and stays on the page', () => {
      venueSpy.createVenue.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409 })),
      );
      form().patchValue({ name: 'X', slug: 'vake-padel' });

      component['onSubmit']();

      expect(form().controls.slug.hasError('conflict')).toBeTrue();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
      expect(component['isSaving']()).toBeFalse();
      expect(alertSpy.open).toHaveBeenCalledWith(
        'ეს slug უკვე დაკავებულია',
        jasmine.objectContaining({ appearance: 'error' }),
      );
    });

    describe('opening hours', () => {
      it('stay out of the payload (and of validation) while hours are unknown', () => {
        form().controls.name.setValue('X');
        form().controls.openingHours.controls.mon.controls.open.setValue('');
        expect(form().controls.openingHours.disabled).toBeTrue();
        expect(form().valid).toBeTrue();
      });

      it('a "day off" toggle sends that day as null', () => {
        form().patchValue({ name: 'X', hoursKnown: true });
        form().controls.openingHours.controls.sun.controls.closed.setValue(true);

        component['onSubmit']();

        const hours = createBody().openingHours!;
        expect(hours.sun).toBeNull();
        expect(hours.mon).toEqual({ open: '09:00', close: '23:00' });
        expect(Object.keys(hours)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
      });

      it('an open day needs both times; a day off needs none', () => {
        form().patchValue({ name: 'X', hoursKnown: true });
        const mon = form().controls.openingHours.controls.mon;

        mon.controls.close.setValue('');
        expect(mon.hasError('time')).toBeTrue();
        expect(form().invalid).toBeTrue();

        mon.controls.closed.setValue(true);
        expect(mon.valid).toBeTrue();
        expect(form().valid).toBeTrue();
      });

      it('renders 7 day rows and hides a day-off row\'s time inputs', () => {
        form().controls.hoursKnown.setValue(true);
        fixture.detectChanges();

        const rows = fixture.nativeElement.querySelectorAll('[data-testid="hours-row"]');
        expect(rows.length).toBe(7);
        expect(rows[6].querySelectorAll('input[type="time"]').length).toBe(2);

        (rows[6].querySelector('input[type="checkbox"]') as HTMLInputElement).click();
        fixture.detectChanges();

        expect(form().controls.openingHours.controls.sun.controls.closed.value).toBeTrue();
        const after = fixture.nativeElement.querySelectorAll('[data-testid="hours-row"]');
        expect(after[6].querySelectorAll('input[type="time"]').length).toBe(0);
      });
    });

    it('counts description words live', () => {
      expect(component['descriptionWords']()).toBe(0);
      form().controls.description.setValue('  პადელის   კლუბი ვაკეში ');
      expect(component['descriptionWords']()).toBe(3);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="description-words"]').textContent,
      ).toContain('3 სიტყვა');
    });

    it('offers the loaded facilities as partner options', () => {
      expect(component['partnerGroups']()).toEqual([
        {
          academyName: 'A1',
          options: [
            jasmine.objectContaining({ id: 'f-1', academyName: 'A1' }) as never,
          ],
        },
      ]);
      expect(component['unknownPartner']()).toBeNull();

      form().controls.partnerFacility.setValue('f-gone');
      expect(component['unknownPartner']()).toBe('f-gone');
    });
  });

  describe('edit mode (/venues/:id)', () => {
    beforeEach(async () => setup('v-1'));

    it('loads the venue and patches the form (tetri → GEL, unknown town → other)', () => {
      expect(component['isEditMode']).toBeTrue();
      expect(venueSpy.getVenue).toHaveBeenCalledWith('v-1');

      const v = form().getRawValue();
      expect(v.city).toBe(OTHER_CITY);
      expect(v.cityOther).toBe('Gori');
      expect(v.priceMinGel).toBe(50);
      expect(v.priceMaxGel).toBe(75.5);
      expect(v.racketRentalGel).toBe(5);
      expect(v.hoursKnown).toBeTrue();
      expect(v.openingHours.sun.closed).toBeTrue();
      expect(v.openingHours.fri).toEqual({ closed: false, open: '10:00', close: '01:00' });
      expect(v.partnerFacility).toBe('f-1');
      expect(form().valid).toBeTrue();
    });

    it('requires the slug once the venue exists', () => {
      form().controls.slug.setValue('');
      expect(form().controls.slug.hasError('required')).toBeTrue();
    });

    it('shows the read-only source facts', () => {
      const meta = fixture.nativeElement.querySelector('[data-testid="venue-meta"]');
      expect(meta.textContent).toContain('იმპორტი');
      expect(meta.querySelector('a').getAttribute('href')).toBe('https://example.com/gori');
    });

    it('PUTs the edit with cleared optionals as null and money in tetri', () => {
      form().patchValue({
        website: '',
        partnerFacility: '',
        priceMaxGel: null,
        priceMinGel: 55.5,
        hoursKnown: false,
      });

      component['onSubmit']();

      expect(venueSpy.updateVenue).toHaveBeenCalledWith('v-1', jasmine.any(Object));
      const body = updateBody();
      expect(body.website).toBeNull();
      expect(body.partnerFacility).toBeNull();
      expect(body.openingHours).toBeNull();
      expect(body.priceMaxTetri).toBeNull();
      expect(body.priceMinTetri).toBe(5550);
      expect(body.racketRentalTetri).toBe(500);
      expect(body.city).toBe('Gori');
      expect(body.slug).toBe('gori-padel');
      expect(body.district).toBeNull();
      expect(alertSpy.open).toHaveBeenCalledWith(
        'შეინახა',
        jasmine.objectContaining({ appearance: 'success' }),
      );
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/venues']);
    });

    it('keeps the loaded week, including the day off, in the PUT', () => {
      component['onSubmit']();
      const hours = updateBody().openingHours!;
      expect(hours.sun).toBeNull();
      expect(hours.sat).toEqual({ open: '09:00', close: '01:00' });
    });
  });

  describe('when the venue cannot be loaded', () => {
    beforeEach(async () => {
      await setup();
      venueSpy.getVenue.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      component['venueId'].set('v-404');
      component['retry']();
    });

    it('shows the error state', () => {
      expect(component['hasError']()).toBeTrue();
      expect(component['isLoading']()).toBeFalse();
    });
  });

  it('countWords splits on any whitespace', () => {
    expect(countWords('')).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords(' a  b\nc\t d ')).toBe(4);
  });
});
