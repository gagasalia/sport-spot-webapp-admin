import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { COACH_OTHER_CITY, CoachEditComponent } from './coach-edit.component';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { AcademySelectComponent } from '../../../shared/ui/academy-select.component';
import { CoachService } from '../../../services/http-services/coach.service';
import { AcademyService } from '../../../services/http-services/academy.service';
import { FacilityService } from '../../../services/http-services/facility.service';
import { VenueService } from '../../../services/http-services/venue.service';
import { MediaService } from '../../../services/http-services/media.service';
import { AuthService } from '../../../shared/services/auth.service';
import { TenantService } from '../../../shared/services/tenant.service';
import { Academy, AcademyStatus } from '../../../shared/models/academy.model';
import { Coach, CreateCoachDto, UpdateCoachDto } from '../../../shared/models/coach.model';
import { Facility } from '../../../shared/models/facility.model';
import { Venue } from '../../../shared/models/venue.model';
import { SsToastService } from '../../../shared/ui/toast.service';

const existing: Coach = {
  _id: 'c-1',
  name: 'გიორგი ბერიძე',
  nameEn: 'Giorgi Beridze',
  slug: 'giorgi-beridze',
  photo: {
    url: 'https://cdn.example/g-web.webp',
    thumbUrl: 'https://cdn.example/g-thumb.webp',
    key: 'coach-photo/g-web.webp',
    thumbKey: 'coach-photo/g-thumb.webp',
    type: 'image/webp',
  },
  bio: 'ორი სიტყვა',
  bioEn: 'Two words',
  languages: ['ka', 'ru'],
  levels: ['kids'],
  certifications: ['FIP Level 1'],
  priceIndividualTetri: 8000,
  priceGroupTetri: 3550,
  phone: '+995 555 00 00 00',
  instagram: 'https://instagram.com/giorgi',
  city: 'Gori',
  academy: 'aca-1',
  facilities: ['f-1'],
  venues: ['v-1'],
  status: 'published',
  updatedAt: '2026-09-20T08:00:00.000Z',
};

const academies: Academy[] = [
  { _id: 'aca-1', name: 'ვაკის აკადემია', admins: [], status: AcademyStatus.PUBLISHED },
  { _id: 'aca-2', name: 'საბურთალოს აკადემია', admins: [], status: AcademyStatus.PUBLISHED },
];

const venues: Venue[] = ['v-1', 'v-2', 'v-3', 'v-4', 'v-5', 'v-6', 'v-7'].map(
  (id, i) =>
    ({
      _id: id,
      name: `კლუბი ${i + 1}`,
      slug: id,
      city: 'Batumi',
      courtsCount: 2,
      indoorCourtsCount: 0,
      hasRoof: false,
      kind: 'club',
      status: 'published',
      source: 'manual',
    }) as Venue,
);

describe('CoachEditComponent', () => {
  let component: CoachEditComponent;
  let fixture: ComponentFixture<CoachEditComponent>;
  let coachSpy: jasmine.SpyObj<CoachService>;
  let academySpy: jasmine.SpyObj<AcademyService>;
  let facilitySpy: jasmine.SpyObj<FacilityService>;
  let venueSpy: jasmine.SpyObj<VenueService>;
  let mediaSpy: jasmine.SpyObj<MediaService>;
  let tenantStub: { ensure: jasmine.Spy };
  let routerSpy: jasmine.SpyObj<Router>;
  let alertSpy: jasmine.SpyObj<SsToastService>;

  async function setup(opts: { id?: string; superAdmin?: boolean } = {}) {
    const superAdmin = opts.superAdmin ?? true;
    coachSpy = jasmine.createSpyObj<CoachService>('CoachService', [
      'getCoach',
      'createCoach',
      'updateCoach',
    ]);
    coachSpy.getCoach.and.returnValue(of(existing));
    coachSpy.createCoach.and.returnValue(of({ ...existing, _id: 'c-new' }));
    coachSpy.updateCoach.and.returnValue(of(existing));

    academySpy = jasmine.createSpyObj<AcademyService>('AcademyService', ['getAllAcademies']);
    academySpy.getAllAcademies.and.returnValue(of(academies));
    facilitySpy = jasmine.createSpyObj<FacilityService>('FacilityService', [
      'getFacilitiesByAcademy',
    ]);
    facilitySpy.getFacilitiesByAcademy.and.callFake((academyId: string) =>
      of(
        ['f-1', 'f-2', 'f-3', 'f-4', 'f-5', 'f-6', 'f-7'].map(
          (fid, i) => ({ _id: `${academyId}-${fid}`, name: `ობიექტი ${i + 1}` }) as Facility,
        ),
      ),
    );
    venueSpy = jasmine.createSpyObj<VenueService>('VenueService', ['getVenues']);
    venueSpy.getVenues.and.returnValue(of({ data: venues }));
    mediaSpy = jasmine.createSpyObj<MediaService>('MediaService', ['uploadImage']);
    mediaSpy.uploadImage.and.returnValue(
      of({
        url: 'https://cdn.example/new-web.webp',
        thumbUrl: 'https://cdn.example/new-thumb.webp',
        key: 'coach-photo/new-web.webp',
        thumbKey: 'coach-photo/new-thumb.webp',
        type: 'image/webp',
        size: 1234,
      }),
    );
    tenantStub = {
      ensure: jasmine
        .createSpy('ensure')
        .and.returnValue(
          of({ _id: 'aca-1', name: 'ვაკის აკადემია', admins: [], status: AcademyStatus.PUBLISHED }),
        ),
    };

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);
    alertSpy = jasmine.createSpyObj<SsToastService>('SsToastService', ['open']);
    alertSpy.open.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [CoachEditComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap(opts.id ? { id: opts.id } : {})) },
        },
        { provide: CoachService, useValue: coachSpy },
        { provide: AcademyService, useValue: academySpy },
        { provide: FacilityService, useValue: facilitySpy },
        { provide: VenueService, useValue: venueSpy },
        { provide: MediaService, useValue: mediaSpy },
        { provide: AuthService, useValue: { isSuperAdmin: signal(superAdmin) } },
        { provide: TenantService, useValue: tenantStub },
        { provide: Router, useValue: routerSpy },
        { provide: SsToastService, useValue: alertSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(CoachEditComponent, {
        // set:{imports} REPLACES the array — TPipe (plus the date pipe and the
        // academy select's value accessor) must ride along.
        set: {
          imports: [ReactiveFormsModule, DatePipe, TPipe, AcademySelectComponent],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CoachEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const form = () => component.form;
  const q = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const createBody = (): CreateCoachDto => coachSpy.createCoach.calls.mostRecent().args[0];
  const updateBody = (): UpdateCoachDto => coachSpy.updateCoach.calls.mostRecent().args[1];
  const fill = () => form().patchValue({ name: 'გიორგი ბერიძე', bio: 'ტრენერი ვაკეში' });
  const select = (value: string) => ({ value }) as HTMLSelectElement;

  describe('create mode (/coaches/new) as a superadmin', () => {
    beforeEach(async () => setup());

    it('starts invalid until the name and the bio are filled', () => {
      expect(component['isEditMode']).toBeFalse();
      expect(coachSpy.getCoach).not.toHaveBeenCalled();
      expect(form().invalid).toBeTrue();
      expect(form().controls.name.hasError('required')).toBeTrue();
      expect(form().controls.bio.hasError('required')).toBeTrue();

      form().patchValue({ name: '   ', bio: 'ბიო' });
      expect(form().controls.name.hasError('required')).toBeTrue(); // blank after trimming

      fill();
      expect(form().valid).toBeTrue();
    });

    it('defaults to Georgian, draft, Tbilisi — with an optional, validated slug', () => {
      const v = form().getRawValue();
      expect(v.languages).toEqual(['ka']);
      expect(v.status).toBe('draft');
      expect(v.city).toBe('Tbilisi');

      fill();
      expect(form().controls.slug.hasError('required')).toBeFalse();
      form().controls.slug.setValue('Giorgi Beridze');
      expect(form().controls.slug.hasError('pattern')).toBeTrue();
      form().controls.slug.setValue('giorgi-beridze-2');
      expect(form().controls.slug.valid).toBeTrue();
    });

    it('mirrors the API caps: 120-char names, 4000-char bios, ≤10 000 ₾ with 2 decimals', () => {
      form().controls.name.setValue('x'.repeat(121));
      expect(form().controls.name.hasError('maxlength')).toBeTrue();
      form().controls.bio.setValue('x'.repeat(4001));
      expect(form().controls.bio.hasError('maxlength')).toBeTrue();
      form().controls.priceIndividualGel.setValue(10_000.01);
      expect(form().controls.priceIndividualGel.hasError('max')).toBeTrue();
      form().controls.priceGroupGel.setValue(25.555);
      expect(form().controls.priceGroupGel.hasError('decimals')).toBeTrue();
      form().controls.priceGroupGel.setValue(-1);
      expect(form().controls.priceGroupGel.hasError('min')).toBeTrue();
    });

    it('requires a typed town only when "other town" is picked', () => {
      fill();
      form().controls.city.setValue(COACH_OTHER_CITY);
      expect(form().controls.cityOther.enabled).toBeTrue();
      expect(form().invalid).toBeTrue();

      form().controls.cityOther.setValue('გორი');
      expect(form().valid).toBeTrue();

      form().controls.city.setValue('Batumi');
      expect(form().controls.cityOther.disabled).toBeTrue();
    });

    it('offers the district only in Tbilisi', () => {
      expect(q('coach-district')).not.toBeNull();
      form().controls.city.setValue('Batumi');
      fixture.detectChanges();
      expect(q('coach-district')).toBeNull();
    });

    it('submit converts GEL to tetri, omits empty optionals and returns to the list', () => {
      form().patchValue({
        name: '  გიორგი ბერიძე ',
        bio: ' ტრენერი ვაკეში ',
        district: 'Vake',
        priceIndividualGel: 80,
        priceGroupGel: 35.5,
        phone: '+995 555 00 00 00',
      });
      component['toggleLevel']('beginner');
      component['addFacility'](select('aca-1-f-2'));

      component['onSubmit']();

      expect(createBody()).toEqual({
        name: 'გიორგი ბერიძე',
        status: 'draft',
        bio: 'ტრენერი ვაკეში',
        languages: ['ka'],
        levels: ['beginner'],
        certifications: [],
        priceIndividualTetri: 8000,
        priceGroupTetri: 3550,
        phone: '+995 555 00 00 00',
        city: 'Tbilisi',
        district: 'Vake',
        facilities: ['aca-1-f-2'],
        venues: [],
      });
      // no academy picked = an independent coach: the key is simply left out
      expect('academy' in createBody()).toBeFalse();
      expect('photo' in createBody()).toBeFalse();
      expect(alertSpy.open).toHaveBeenCalledWith(
        'შეიქმნა',
        jasmine.objectContaining({ appearance: 'success' }),
      );
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/coaches']);
    });

    it('a superadmin can attach the coach to an academy and to directory venues', () => {
      fill();
      form().controls.academy.setValue('aca-2');
      component['addVenue'](select('v-3'));

      component['onSubmit']();

      expect(createBody().academy).toBe('aca-2');
      expect(createBody().venues).toEqual(['v-3']);
    });

    it('a typed town is sent as the city, and the Tbilisi-only district is dropped', () => {
      fill();
      form().patchValue({ district: 'Vake', city: COACH_OTHER_CITY, cityOther: ' გორი ' });

      component['onSubmit']();

      expect(createBody().city).toBe('გორი');
      expect('district' in createBody()).toBeFalse();
    });

    it('language and level chips toggle in their canonical order', () => {
      component['toggleLanguage']('ru');
      component['toggleLanguage']('en');
      expect(form().controls.languages.value).toEqual(['ka', 'en', 'ru']);
      component['toggleLanguage']('ka');
      expect(form().controls.languages.value).toEqual(['en', 'ru']);

      component['toggleLevel']('advanced');
      component['toggleLevel']('kids');
      expect(form().controls.levels.value).toEqual(['kids', 'advanced']);

      fixture.detectChanges();
      expect(q('language-en')!.getAttribute('aria-pressed')).toBe('true');
      expect(q('language-ka')!.getAttribute('aria-pressed')).toBe('false');
      (q('level-beginner') as HTMLElement).click();
      expect(form().controls.levels.value).toEqual(['kids', 'beginner', 'advanced']);
    });

    it('certifications: trimmed, de-duplicated, at most 10, removable', () => {
      component['addCertification']('  FIP   Level 1 ');
      component['addCertification']('fip level 1');
      expect(form().controls.certifications.value).toEqual(['FIP Level 1']);

      for (let i = 2; i <= 10; i++) component['addCertification'](`Cert ${i}`);
      expect(form().controls.certifications.value.length).toBe(10);
      component['addCertification']('Cert 11');
      expect(form().controls.certifications.value.length).toBe(10);
      expect(component['certError']()).toBe('მაქსიმუმ 10 სერტიფიკატი');

      component['removeCertification'](0);
      expect(form().controls.certifications.value[0]).toBe('Cert 2');
      expect(component['certError']()).toBeNull();
    });

    it('Enter in the certification input commits a chip (commas stay inside it)', () => {
      const input = { value: 'WPT Academy, Madrid' } as HTMLInputElement;
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      component['onCertKeydown'](event, input);
      expect(form().controls.certifications.value).toEqual(['WPT Academy, Madrid']);
      expect(input.value).toBe('');
    });

    it('uploads the photo through the media pipeline with the coach-photo scope', () => {
      const file = new File(['x'], 'giorgi.jpg', { type: 'image/jpeg' });
      component['onPhotoSelected']({ target: { files: [file], value: '' } } as unknown as Event);

      expect(mediaSpy.uploadImage).toHaveBeenCalledWith(file, 'coach-photo');
      expect(form().controls.photo.value).toEqual({
        url: 'https://cdn.example/new-web.webp',
        type: 'image/webp',
        thumbUrl: 'https://cdn.example/new-thumb.webp',
        key: 'coach-photo/new-web.webp',
        thumbKey: 'coach-photo/new-thumb.webp',
      });
      fixture.detectChanges();
      expect(q('photo-preview')!.querySelector('img')!.getAttribute('src')).toBe(
        'https://cdn.example/new-thumb.webp',
      );

      fill();
      component['onSubmit']();
      expect(createBody().photo?.url).toBe('https://cdn.example/new-web.webp');
    });

    it('rejects a non-image file before uploading', () => {
      const file = new File(['x'], 'cv.pdf', { type: 'application/pdf' });
      component['onPhotoSelected']({ target: { files: [file], value: '' } } as unknown as Event);
      expect(mediaSpy.uploadImage).not.toHaveBeenCalled();
      expect(alertSpy.open).toHaveBeenCalledWith(
        'გთხოვთ აირჩიოთ სურათის ფაილი',
        jasmine.objectContaining({ appearance: 'error' }),
      );
    });

    it('counts bio words live against the 150-word SEO bar', () => {
      expect(component['bioWords']()).toBe(0);
      form().controls.bio.setValue('  პადელის   ტრენერი ვაკეში ');
      expect(component['bioWords']()).toBe(3);
      fixture.detectChanges();
      const counter = q('bio-words')!;
      expect(counter.textContent).toContain('3 სიტყვა');
      expect(counter.textContent).toContain('SEO: ≥150 სიტყვა');
      expect(counter.classList).toContain('is-low');
    });

    it('offers every facility (grouped by academy) and caps facilities and venues at 6', () => {
      expect(component['facilityGroups']().map((g) => g.academyName)).toEqual([
        'ვაკის აკადემია',
        'საბურთალოს აკადემია',
      ]);
      for (let i = 1; i <= 7; i++) component['addFacility'](select(`aca-1-f-${i}`));
      expect(form().controls.facilities.value.length).toBe(6);
      component['removeFacility']('aca-1-f-1');
      expect(form().controls.facilities.value).not.toContain('aca-1-f-1');

      for (const venue of venues) component['addVenue'](select(venue._id));
      expect(form().controls.venues.value.length).toBe(6);
      expect(component['venueChoices']().map((v) => v._id)).toEqual(['v-7']);
      expect(venueSpy.getVenues).toHaveBeenCalledWith({ page: 1, limit: 100 });
    });

    it('shows the academy select and the venues picker to a superadmin', () => {
      expect(q('coach-academy-field')).not.toBeNull();
      expect(q('coach-venues-field')).not.toBeNull();
      expect(q('coach-academy-readonly')).toBeNull();
      expect(component['academies']()).toEqual(academies);
      expect(tenantStub.ensure).not.toHaveBeenCalled();
    });

    it('an invalid submit touches every field, toasts and sends nothing', () => {
      component['onSubmit']();

      expect(coachSpy.createCoach).not.toHaveBeenCalled();
      expect(form().controls.name.touched).toBeTrue();
      expect(alertSpy.open).toHaveBeenCalledWith(
        'გთხოვთ შეავსოთ ყველა სავალდებულო ველი',
        jasmine.objectContaining({ appearance: 'error' }),
      );
    });

    it('a 409 marks the slug as taken and stays on the page', () => {
      coachSpy.createCoach.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409 })),
      );
      fill();
      form().controls.slug.setValue('giorgi-beridze');

      component['onSubmit']();

      expect(form().controls.slug.hasError('conflict')).toBeTrue();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
      expect(component['isSaving']()).toBeFalse();
      expect(alertSpy.open).toHaveBeenCalledWith(
        'ეს slug უკვე დაკავებულია',
        jasmine.objectContaining({ appearance: 'error' }),
      );
    });
  });

  describe('edit mode (/coaches/:id) as a superadmin', () => {
    beforeEach(async () => setup({ id: 'c-1' }));

    it('loads the coach and patches the form (tetri → GEL, unknown town → other)', () => {
      expect(component['isEditMode']).toBeTrue();
      expect(coachSpy.getCoach).toHaveBeenCalledWith('c-1');

      const v = form().getRawValue();
      expect(v.city).toBe(COACH_OTHER_CITY);
      expect(v.cityOther).toBe('Gori');
      expect(v.priceIndividualGel).toBe(80);
      expect(v.priceGroupGel).toBe(35.5);
      expect(v.languages).toEqual(['ka', 'ru']);
      expect(v.academy).toBe('aca-1');
      expect(v.venues).toEqual(['v-1']);
      expect(form().valid).toBeTrue();
      expect(q('coach-meta')).not.toBeNull();
    });

    it('requires the slug once the coach exists', () => {
      form().controls.slug.setValue('');
      expect(form().controls.slug.hasError('required')).toBeTrue();
    });

    it('PUTs the edit: cleared optionals as null, a removed photo as photo: null', () => {
      component['removePhoto']();
      fixture.detectChanges();
      expect(q('photo-preview')).toBeNull();
      form().patchValue({
        nameEn: '',
        bioEn: ' ',
        instagram: '',
        priceGroupGel: null,
        priceIndividualGel: 90.25,
        academy: '',
      });

      component['onSubmit']();

      expect(coachSpy.updateCoach).toHaveBeenCalledWith('c-1', jasmine.any(Object));
      const body = updateBody();
      expect(body.photo).toBeNull();
      expect('photo' in body).toBeTrue();
      expect(body.nameEn).toBeNull();
      expect(body.bioEn).toBeNull();
      expect(body.instagram).toBeNull();
      expect(body.whatsapp).toBeNull();
      expect(body.priceGroupTetri).toBeNull();
      expect(body.priceIndividualTetri).toBe(9025);
      expect(body.city).toBe('Gori');
      expect(body.district).toBeNull();
      expect(body.slug).toBe('giorgi-beridze');
      // '' in the academy select = independent → an explicit null
      expect(body.academy).toBeNull();
      expect(body.venues).toEqual(['v-1']);
      expect(body.facilities).toEqual(['f-1']);
      expect(alertSpy.open).toHaveBeenCalledWith(
        'შეინახა',
        jasmine.objectContaining({ appearance: 'success' }),
      );
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/coaches']);
    });

    it('keeps the stored photo, sending only the media fields the API stores', () => {
      component['onSubmit']();
      expect(updateBody().photo).toEqual(existing.photo!);
    });
  });

  describe('as an academy operator (ADMIN)', () => {
    beforeEach(async () => setup({ id: 'c-1', superAdmin: false }));

    it('shows the own academy read-only and hides the academy select and the venues picker', () => {
      expect(q('coach-academy-readonly')!.textContent!.trim()).toBe('ვაკის აკადემია');
      expect(q('coach-academy-field')).toBeNull();
      expect(q('coach-venues-field')).toBeNull();
    });

    it('offers only the own academy\'s facilities and never reads the superadmin lists', () => {
      expect(tenantStub.ensure).toHaveBeenCalled();
      expect(facilitySpy.getFacilitiesByAcademy).toHaveBeenCalledOnceWith('aca-1');
      expect(academySpy.getAllAcademies).not.toHaveBeenCalled();
      expect(venueSpy.getVenues).not.toHaveBeenCalled();
      expect(component['facilityGroups']().map((g) => g.academyName)).toEqual(['ვაკის აკადემია']);
    });

    it('never sends academy or venues', () => {
      component['onSubmit']();
      const body = updateBody();
      expect('academy' in body).toBeFalse();
      expect('venues' in body).toBeFalse();
      expect(body.facilities).toEqual(['f-1']);
    });

    it('a 403 explains the missing permission', () => {
      coachSpy.updateCoach.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 403 })),
      );
      component['onSubmit']();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
      expect(alertSpy.open).toHaveBeenCalledWith(
        'ამ ტრენერის შეცვლის უფლება არ გაქვთ',
        jasmine.objectContaining({ appearance: 'error' }),
      );
    });
  });

  describe('an operator creating a coach', () => {
    beforeEach(async () => setup({ superAdmin: false }));

    it('leaves academy and venues out of the create body', () => {
      fill();
      component['onSubmit']();
      expect('academy' in createBody()).toBeFalse();
      expect('venues' in createBody()).toBeFalse();
    });
  });

  describe('when the coach cannot be loaded', () => {
    beforeEach(async () => {
      await setup();
      coachSpy.getCoach.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      component['coachId'].set('c-404');
      component['retry']();
    });

    it('shows the error state', () => {
      expect(component['hasError']()).toBeTrue();
      expect(component['isLoading']()).toBeFalse();
    });
  });
});
