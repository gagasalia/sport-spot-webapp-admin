import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';

import { TournamentFormComponent } from './tournament-form.component';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { TournamentService } from '../../../services/http-services/tournament.service';
import { FacilityService } from '../../../services/http-services/facility.service';
import { AcademyService } from '../../../services/http-services/academy.service';
import { VenueService } from '../../../services/http-services/venue.service';
import { AuthService } from '../../../shared/services/auth.service';
import { TenantService } from '../../../shared/services/tenant.service';
import { SS_DIALOG_CONTEXT } from '../../../shared/ui/dialog.service';
import { SsToastService } from '../../../shared/ui/toast.service';
import { Academy, AcademyStatus } from '../../../shared/models/academy.model';
import {
  CreateTournamentDto,
  Tournament,
  UpdateTournamentDto,
} from '../../../shared/models/tournament.model';
import { Facility } from '../../../shared/models/facility.model';
import { Venue } from '../../../shared/models/venue.model';

const internal: Tournament = {
  _id: 't-1',
  academy: 'aca-1',
  facility: 'f-1',
  name: 'Summer Open',
  sportType: 'padel',
  type: 'doubles',
  format: 'knockout',
  level: 'any',
  category: 'mixed',
  startDate: '2026-10-18',
  startTime: '10:00',
  entryFeeTetri: 5000,
  currency: 'GEL',
  maxParticipants: 16,
  registeredCount: 0,
  status: 'draft',
};

const external: Tournament = {
  ...internal,
  _id: 't-ext',
  academy: undefined,
  facility: undefined,
  name: 'Batumi Autumn Open',
  external: {
    registrationUrl: 'https://padelbatumi.ge/open',
    organizerName: 'Padel Club Batumi',
    venue: 'v-1',
  },
};

const venues = [
  { _id: 'v-1', name: 'ბათუმის პადელი', slug: 'batumi-padel', city: 'Batumi' },
  { _id: 'v-2', name: 'ქუთაისის პადელი', slug: 'kutaisi-padel', city: 'Kutaisi' },
] as Venue[];

describe('TournamentFormComponent', () => {
  let component: TournamentFormComponent;
  let fixture: ComponentFixture<TournamentFormComponent>;
  let tournamentSpy: jasmine.SpyObj<TournamentService>;
  let facilitySpy: jasmine.SpyObj<FacilityService>;
  let academySpy: jasmine.SpyObj<AcademyService>;
  let venueSpy: jasmine.SpyObj<VenueService>;
  let completeWith: jasmine.Spy;

  async function setup(opts: { superAdmin: boolean; tournament?: Tournament }) {
    tournamentSpy = jasmine.createSpyObj<TournamentService>('TournamentService', [
      'createTournament',
      'updateTournament',
    ]);
    tournamentSpy.createTournament.and.returnValue(of(internal));
    tournamentSpy.updateTournament.and.returnValue(of(internal));
    facilitySpy = jasmine.createSpyObj<FacilityService>('FacilityService', [
      'getFacilitiesByAcademy',
    ]);
    // The operator's own academy (aca-1) keeps bare ids; any other is prefixed.
    facilitySpy.getFacilitiesByAcademy.and.callFake((academyId: string) => {
      const prefix = academyId === 'aca-1' ? '' : `${academyId}-`;
      return of([
        { _id: `${prefix}f-1`, name: 'ვაკე' } as Facility,
        { _id: `${prefix}f-2`, name: 'საბურთალო' } as Facility,
      ]);
    });
    academySpy = jasmine.createSpyObj<AcademyService>('AcademyService', ['getAllAcademies']);
    academySpy.getAllAcademies.and.returnValue(
      of([{ _id: 'aca-9', name: 'A9', admins: [], status: AcademyStatus.PUBLISHED }]),
    );
    venueSpy = jasmine.createSpyObj<VenueService>('VenueService', ['getVenues']);
    venueSpy.getVenues.and.returnValue(of({ data: venues }));
    completeWith = jasmine.createSpy('completeWith');

    // An operator resolves their academy; a superadmin resolves none.
    const academy: Academy | null = opts.superAdmin
      ? null
      : { _id: 'aca-1', name: 'A1', admins: [], status: AcademyStatus.PUBLISHED };
    const toast = jasmine.createSpyObj<SsToastService>('SsToastService', ['open']);
    toast.open.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [TournamentFormComponent],
      providers: [
        {
          provide: SS_DIALOG_CONTEXT,
          useValue: { data: { tournament: opts.tournament }, completeWith },
        },
        { provide: TournamentService, useValue: tournamentSpy },
        { provide: FacilityService, useValue: facilitySpy },
        { provide: AcademyService, useValue: academySpy },
        { provide: VenueService, useValue: venueSpy },
        { provide: AuthService, useValue: { isSuperAdmin: signal(opts.superAdmin) } },
        {
          provide: TenantService,
          useValue: { ensure: () => of(academy), academyId: signal(academy?._id ?? null) },
        },
        { provide: SsToastService, useValue: toast },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TournamentFormComponent, {
        // set:{imports} REPLACES the array — TPipe must ride along (NG0302).
        set: { imports: [CommonModule, ReactiveFormsModule, TPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TournamentFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const form = () => component.form;
  const q = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const createBody = (): CreateTournamentDto =>
    tournamentSpy.createTournament.calls.mostRecent().args[0];
  const updateBody = (): UpdateTournamentDto =>
    tournamentSpy.updateTournament.calls.mostRecent().args[1];
  const submit = () => (component as unknown as { onSubmit(): void }).onSubmit();
  const switchExternal = (on: boolean) => {
    form().get('external')!.setValue(on);
    fixture.detectChanges();
  };

  describe('as an academy operator', () => {
    beforeEach(async () => setup({ superAdmin: false }));

    it('never shows the external switch and keeps the facility required', () => {
      expect(q('external-block')).toBeNull();
      expect(q('external-toggle')).toBeNull();
      expect(q('facility-field')).not.toBeNull();
      // the first facility is preselected on create
      expect(form().get('facility')!.value).toBe('f-1');
      form().get('facility')!.setValue('');
      expect(form().get('facility')!.hasError('required')).toBeTrue();
    });

    it('creates an internal tournament: facility sent, no external key', () => {
      form().patchValue({ name: 'Vake Cup', startDate: '2026-11-01', entryFeeGel: 25.5 });
      submit();

      const body = createBody();
      expect(body.facility).toBe('f-1');
      expect(body.entryFeeTetri).toBe(2550);
      expect('external' in body).toBeFalse();
      expect(venueSpy.getVenues).not.toHaveBeenCalled();
      expect(completeWith).toHaveBeenCalledWith(internal);
    });

    it('ignores a forged external flag: the payload stays internal', () => {
      form().patchValue({
        name: 'Vake Cup',
        startDate: '2026-11-01',
        external: true,
        registrationUrl: 'https://example.com',
      });
      submit();

      expect(createBody().facility).toBe('f-1');
      expect('external' in createBody()).toBeFalse();
    });
  });

  describe('as a superadmin creating a tournament', () => {
    beforeEach(async () => setup({ superAdmin: true }));

    it('loads every facility (no preselection) and the venues directory', () => {
      expect(academySpy.getAllAcademies).toHaveBeenCalled();
      expect(component['facilities']().map((f) => f._id)).toEqual(['aca-9-f-1', 'aca-9-f-2']);
      expect(form().get('facility')!.value).toBe('');
      expect(venueSpy.getVenues).toHaveBeenCalledWith({ page: 1, limit: 100 });
    });

    it('the external switch reveals the off-site fields and hides the facility', () => {
      expect(q('external-toggle')).not.toBeNull();
      expect(q('external-url')).toBeNull();
      expect(q('facility-field')).not.toBeNull();

      switchExternal(true);

      expect(q('external-url')).not.toBeNull();
      expect(q('external-organizer')).not.toBeNull();
      expect(q('external-venue')).not.toBeNull();
      expect(q('external-venue-name')).not.toBeNull();
      expect(q('facility-field')).toBeNull();
      expect(form().get('facility')!.disabled).toBeTrue();

      switchExternal(false);
      expect(q('external-url')).toBeNull();
      expect(q('facility-field')).not.toBeNull();
      expect(form().get('facility')!.enabled).toBeTrue();
      expect(form().get('registrationUrl')!.disabled).toBeTrue();
    });

    it('requires an http(s) registration link and a place', () => {
      form().patchValue({ name: 'Batumi Open', startDate: '2026-11-01' });
      switchExternal(true);
      expect(form().get('registrationUrl')!.hasError('required')).toBeTrue();

      form().get('registrationUrl')!.setValue('   ');
      expect(form().get('registrationUrl')!.hasError('required')).toBeTrue();
      form().get('registrationUrl')!.setValue('padelbatumi.ge/open');
      expect(form().get('registrationUrl')!.hasError('pattern')).toBeTrue();
      form().get('registrationUrl')!.setValue('ftp://padelbatumi.ge/open');
      expect(form().get('registrationUrl')!.hasError('pattern')).toBeTrue();
      // a pasted link's stray spaces are fine — the payload trims them
      form().get('registrationUrl')!.setValue(' https://padelbatumi.ge/open ');
      expect(form().get('registrationUrl')!.valid).toBeTrue();

      // no facility, so a directory venue or a free-text place is needed
      expect(form().hasError('externalPlace')).toBeTrue();
      form().get('externalVenueName')!.setValue('ყვარლის ტბა');
      expect(form().hasError('externalPlace')).toBeFalse();
      expect(form().valid).toBeTrue();
    });

    it('creates an external tournament: external block, no facility', () => {
      form().patchValue({ name: 'Batumi Open', startDate: '2026-11-01' });
      switchExternal(true);
      form().patchValue({
        registrationUrl: ' https://padelbatumi.ge/open ',
        organizerName: ' Padel Club Batumi ',
        externalVenueName: ' ბათუმის ბულვარი ',
      });
      submit();

      const body = createBody();
      expect('facility' in body).toBeFalse();
      expect(body.external).toEqual({
        registrationUrl: 'https://padelbatumi.ge/open',
        organizerName: 'Padel Club Batumi',
        venueName: 'ბათუმის ბულვარი',
      });
      expect(body.name).toBe('Batumi Open');
    });

    it('a directory venue replaces the free-text place', () => {
      form().patchValue({ name: 'Batumi Open', startDate: '2026-11-01' });
      switchExternal(true);
      form().patchValue({
        registrationUrl: 'https://padelbatumi.ge/open',
        externalVenueName: 'typed first',
      });
      form().get('externalVenue')!.setValue('v-2');
      fixture.detectChanges();

      expect(q('external-venue-name')).toBeNull();
      submit();

      expect(createBody().external).toEqual({
        registrationUrl: 'https://padelbatumi.ge/open',
        venue: 'v-2',
      });
    });

    it('with the switch off a superadmin creates an internal tournament at a picked facility', () => {
      form().patchValue({ name: 'Vake Cup', startDate: '2026-11-01' });
      (component as unknown as { selectFacility(id: string): void }).selectFacility('aca-9-f-2');
      submit();

      expect(createBody().facility).toBe('aca-9-f-2');
      expect('external' in createBody()).toBeFalse();
    });
  });

  describe('as a superadmin editing an external tournament', () => {
    beforeEach(async () => setup({ superAdmin: true, tournament: external }));

    it('opens with the switch on and the stored block filled in', () => {
      expect(form().get('external')!.value).toBeTrue();
      expect(form().get('registrationUrl')!.value).toBe('https://padelbatumi.ge/open');
      expect(form().get('externalVenue')!.value).toBe('v-1');
      expect(q('external-url')).not.toBeNull();
      expect(q('facility-field')).toBeNull();
    });

    it('PUTs the whole block; a cleared directory venue goes over as venue: null', () => {
      form().get('externalVenue')!.setValue('');
      form().get('externalVenueName')!.setValue('ბათუმის ბულვარი');
      submit();

      expect(tournamentSpy.updateTournament).toHaveBeenCalledWith('t-ext', jasmine.any(Object));
      const body = updateBody();
      expect('facility' in body).toBeFalse();
      expect(body.external).toEqual({
        registrationUrl: 'https://padelbatumi.ge/open',
        organizerName: 'Padel Club Batumi',
        venue: null,
        venueName: 'ბათუმის ბულვარი',
      });
    });

    it('locks the switch: the kind is fixed at creation and the PUT stays external', () => {
      expect(form().get('external')!.disabled).toBeTrue();
      expect((q('external-toggle') as HTMLInputElement).disabled).toBeTrue();
      expect(q('external-locked')).not.toBeNull();
      submit();

      const body = updateBody();
      expect('facility' in body).toBeFalse();
      expect(body.external).toEqual(jasmine.objectContaining({ registrationUrl: 'https://padelbatumi.ge/open' }));
    });
  });

  describe('as a superadmin editing an internal tournament', () => {
    beforeEach(async () => setup({ superAdmin: true, tournament: internal }));

    it('leaves the external key out of the PUT and locks the switch', () => {
      expect(form().get('external')!.disabled).toBeTrue();
      expect((q('external-toggle') as HTMLInputElement).disabled).toBeTrue();
      submit();
      const body = updateBody();
      expect(body.facility).toBe('f-1');
      expect('external' in body).toBeFalse();
    });
  });
});
