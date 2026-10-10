import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { OTHER_CITY, VenueEditComponent } from './venue-edit.component';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { VenueService } from '../../../services/http-services/venue.service';
import { AcademyService } from '../../../services/http-services/academy.service';
import { FacilityService } from '../../../services/http-services/facility.service';
import {
  MediaService,
  MediaUnconfiguredError,
} from '../../../services/http-services/media.service';
import { CreateVenueDto, UpdateVenueDto, Venue } from '../../../shared/models/venue.model';
import { Facility, IMedia } from '../../../shared/models/facility.model';
import { SsToastService } from '../../../shared/ui/toast.service';

/** What MediaService.uploadImage resolves to (both renditions + keys). */
const uploaded: IMedia = {
  url: 'https://cdn.example/venue-photo/new-web.webp',
  thumbUrl: 'https://cdn.example/venue-photo/new-thumb.webp',
  key: 'venue-photo/new-web.webp',
  thumbKey: 'venue-photo/new-thumb.webp',
  type: 'image/webp',
  size: 1234,
};

/** ...and the media fields of it the API stores. */
const uploadedPayload = {
  url: 'https://cdn.example/venue-photo/new-web.webp',
  type: 'image/webp',
  thumbUrl: 'https://cdn.example/venue-photo/new-thumb.webp',
  key: 'venue-photo/new-web.webp',
  thumbKey: 'venue-photo/new-thumb.webp',
};

const fileEvent = (file: File) => ({ target: { files: [file], value: '' } }) as unknown as Event;
const imageFile = () => new File(['x'], 'aia.jpg', { type: 'image/jpeg' });

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
  // a borrowed cover (provenance in metadata.sourceUrl) and an own logo
  cover: {
    url: 'https://cdn.example/venue-photo/aia-web.webp',
    thumbUrl: 'https://cdn.example/venue-photo/aia-thumb.webp',
    key: 'venue-photo/aia-web.webp',
    thumbKey: 'venue-photo/aia-thumb.webp',
    type: 'image/webp',
    size: 2048,
    metadata: { sourceUrl: 'https://padelspot.ge/venues/aia-padel' },
  },
  logo: {
    url: 'https://cdn.example/venue-photo/logo-web.webp',
    thumbUrl: 'https://cdn.example/venue-photo/logo-thumb.webp',
    type: 'image/webp',
  },
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
  let mediaSpy: jasmine.SpyObj<MediaService>;

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
    mediaSpy = jasmine.createSpyObj<MediaService>('MediaService', ['uploadImage']);
    mediaSpy.uploadImage.and.returnValue(of(uploaded));

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
        { provide: MediaService, useValue: mediaSpy },
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
  const q = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
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

    describe('photos', () => {
      it('uploads a cover with the venue-photo scope; the POST carries its media fields', () => {
        expect(q('cover-drop')).not.toBeNull();
        const file = imageFile();
        component['onImageSelected']('cover', fileEvent(file));

        expect(mediaSpy.uploadImage).toHaveBeenCalledWith(file, 'venue-photo');
        expect(form().controls.cover.value).toEqual(uploadedPayload);
        fixture.detectChanges();
        expect(q('cover-preview')!.querySelector('img')!.getAttribute('src')).toBe(
          uploaded.thumbUrl!,
        );
        expect(q('cover-source')).toBeNull();
        expect(q('logo-drop')).not.toBeNull();

        form().controls.name.setValue('X');
        component['onSubmit']();
        expect(createBody().cover).toEqual(uploadedPayload);
        expect('logo' in createBody()).toBeFalse();
      });

      it('rejects a non-image file before uploading', () => {
        const file = new File(['x'], 'menu.pdf', { type: 'application/pdf' });
        component['onImageSelected']('logo', fileEvent(file));
        expect(mediaSpy.uploadImage).not.toHaveBeenCalled();
        expect(alertSpy.open).toHaveBeenCalledWith(
          'გთხოვთ აირჩიოთ სურათის ფაილი',
          jasmine.objectContaining({ appearance: 'error' }),
        );
      });

      it('toasts when uploads are not configured here and leaves the slot empty', () => {
        mediaSpy.uploadImage.and.returnValue(throwError(() => new MediaUnconfiguredError()));
        component['onImageSelected']('logo', fileEvent(imageFile()));

        expect(form().controls.logo.value).toBeNull();
        expect(component['isUploadingImage']()).toBeFalse();
        expect(alertSpy.open).toHaveBeenCalledWith(
          'სურათების ატვირთვა ამ გარემოში არ არის კონფიგურირებული',
          jasmine.objectContaining({ appearance: 'error' }),
        );
      });
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

    describe('photos', () => {
      it('previews the loaded images and captions the borrowed cover with its source', () => {
        expect(q('cover-preview')!.querySelector('img')!.getAttribute('src')).toBe(
          existing.cover!.thumbUrl!,
        );
        expect(q('logo-preview')).not.toBeNull();

        const source = q('cover-source') as HTMLAnchorElement;
        expect(source.getAttribute('href')).toBe('https://padelspot.ge/venues/aia-padel');
        expect(source.getAttribute('target')).toBe('_blank');
        expect(source.getAttribute('rel')).toBe('noopener');
        expect(source.textContent).toContain('წყარო: padelspot.ge');
        // the logo carries no provenance → no caption
        expect(q('logo-source')).toBeNull();
      });

      it('leaves untouched images out of the PUT, so a re-save keeps their provenance', () => {
        component['onSubmit']();

        const body = updateBody();
        expect('cover' in body).toBeFalse();
        expect('logo' in body).toBeFalse();
      });

      it('a replaced cover goes over as its media fields only, and its source caption goes', () => {
        component['onImageSelected']('cover', fileEvent(imageFile()));
        fixture.detectChanges();

        expect(q('cover-source')).toBeNull();
        expect(q('cover-preview')!.querySelector('img')!.getAttribute('src')).toBe(
          uploaded.thumbUrl!,
        );

        component['onSubmit']();
        const body = updateBody();
        expect(body.cover).toEqual(uploadedPayload);
        expect('logo' in body).toBeFalse();
      });

      it('a removed logo goes over as logo: null while the cover stays out', () => {
        q('logo-remove')!.click();
        fixture.detectChanges();
        expect(q('logo-preview')).toBeNull();
        expect(q('logo-drop')).not.toBeNull();

        component['onSubmit']();
        const body = updateBody();
        expect('logo' in body).toBeTrue();
        expect(body.logo).toBeNull();
        expect('cover' in body).toBeFalse();
      });

      it('removing the borrowed cover hides its source caption', () => {
        component['removeImage']('cover');
        fixture.detectChanges();

        expect(q('cover-preview')).toBeNull();
        expect(q('cover-source')).toBeNull();
      });

      it('blocks save while an upload runs', () => {
        const upload$ = new Subject<IMedia>();
        mediaSpy.uploadImage.and.returnValue(upload$);

        component['onImageSelected']('logo', fileEvent(imageFile()));
        fixture.detectChanges();
        expect(component['isUploadingImage']()).toBeTrue();
        expect((q('venue-save') as HTMLButtonElement).disabled).toBeTrue();

        component['onSubmit']();
        expect(venueSpy.updateVenue).not.toHaveBeenCalled();

        upload$.next(uploaded);
        fixture.detectChanges();
        expect(component['isUploadingImage']()).toBeFalse();
        expect((q('venue-save') as HTMLButtonElement).disabled).toBeFalse();

        component['onSubmit']();
        expect(updateBody().logo).toEqual(uploadedPayload);
        expect('cover' in updateBody()).toBeFalse();
      });
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
});
