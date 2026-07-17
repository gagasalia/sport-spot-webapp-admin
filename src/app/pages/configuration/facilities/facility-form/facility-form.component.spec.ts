import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';

import { TuiAlertService } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';

import { FacilityFormComponent } from './facility-form.component';
import { FacilityService } from '../../../../services/http-services/facility.service';
import { MediaService } from '../../../../services/http-services/media.service';
import { TenantService } from '../../../../shared/services/tenant.service';
import { Facility, SportRule } from '../../../../shared/models/facility.model';
import { SportType } from '../../../../shared/enums/court-type.enum';

// ─── Test data ────────────────────────────────────────────────────────────────

const savedFacility: Facility = {
  _id: 'facility-1',
  name: 'Saved',
  country: 'Georgia',
  city: 'Tbilisi',
  description: '',
  amenities: [],
};

function facilityWithRule(rule?: SportRule): Facility {
  return {
    _id: 'facility-1',
    name: 'Padel Club',
    country: 'Georgia',
    city: 'Tbilisi',
    description: 'desc',
    amenities: [],
    sportRules: rule ? [rule] : undefined,
  };
}

function makeContext(facility?: Facility) {
  return {
    data: facility ? { facility } : {},
    completeWith: jasmine.createSpy('completeWith'),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('FacilityFormComponent — padel equipment rules', () => {
  let component: FacilityFormComponent;
  let fixture: ComponentFixture<FacilityFormComponent>;
  let facilityServiceSpy: jasmine.SpyObj<FacilityService>;
  let contextSpy: ReturnType<typeof makeContext>;

  async function createComponent(facility?: Facility) {
    contextSpy = makeContext(facility);

    facilityServiceSpy = jasmine.createSpyObj('FacilityService', [
      'createFacility',
      'updateFacility',
    ]);
    facilityServiceSpy.createFacility.and.returnValue(of(savedFacility));
    facilityServiceSpy.updateFacility.and.returnValue(of(savedFacility));

    const mediaServiceSpy = jasmine.createSpyObj('MediaService', ['upload']);
    const alertServiceSpy = jasmine.createSpyObj('TuiAlertService', ['open']);
    alertServiceSpy.open.and.returnValue(of(undefined));

    const tenantStub = { academyId: signal<string | null>('academy-1').asReadonly() };

    await TestBed.configureTestingModule({
      imports: [FacilityFormComponent],
      providers: [
        provideAnimations(),
        { provide: POLYMORPHEUS_CONTEXT, useValue: contextSpy },
        { provide: FacilityService, useValue: facilityServiceSpy },
        { provide: MediaService, useValue: mediaServiceSpy },
        { provide: TuiAlertService, useValue: alertServiceSpy },
        { provide: TenantService, useValue: tenantStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(FacilityFormComponent, {
        set: { imports: [ReactiveFormsModule], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(FacilityFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** The `sportRules` the last submit sent, from either service spy. */
  function submittedSportRules(): SportRule[] | undefined {
    const createCall = facilityServiceSpy.createFacility.calls.mostRecent();
    if (createCall) {
      return createCall.args[0].sportRules;
    }
    return facilityServiceSpy.updateFacility.calls.mostRecent()?.args[1].sportRules;
  }

  // ─── Defaults & prefill ────────────────────────────────────────────────────

  it('defaults to 0 included rackets and no prices', async () => {
    await createComponent();

    expect(component.facilityForm.get('padelRules')!.value).toEqual({
      racketsIncluded: 0,
      racketRentGel: null,
      ballsPriceGel: null,
    });
  });

  it('prefills the section from the stored rule, converting tetri to GEL', async () => {
    await createComponent(
      facilityWithRule({
        sportType: SportType.Padel,
        racketsIncluded: 3,
        racketRentTetri: 2550,
        ballsPriceTetri: 1500,
      }),
    );

    expect(component.facilityForm.get('padelRules')!.value).toEqual({
      racketsIncluded: 3,
      racketRentGel: 25.5,
      ballsPriceGel: 15,
    });
  });

  // ─── Validation ────────────────────────────────────────────────────────────

  it('rejects more included rackets than a padel game needs (max 4)', async () => {
    await createComponent();

    const control = component.facilityForm.get('padelRules.racketsIncluded')!;
    control.setValue(5);

    expect(control.invalid).toBeTrue();
    expect(control.errors?.['max']).toBeTruthy();
  });

  it('rejects a negative rackets count', async () => {
    await createComponent();

    const control = component.facilityForm.get('padelRules.racketsIncluded')!;
    control.setValue(-1);

    expect(control.invalid).toBeTrue();
  });

  // ─── Submit payloads: the three facility configurations ────────────────────

  it('all-included facility: 4 rackets free, no rent price', async () => {
    await createComponent();
    component.facilityForm.get('name')!.setValue('All Included Club');
    component.facilityForm.get('padelRules.racketsIncluded')!.setValue(4);

    component.onSubmit();

    expect(submittedSportRules()).toEqual([{ sportType: SportType.Padel, racketsIncluded: 4 }]);
  });

  it('all-rental facility: 0 included, every racket rented (GEL → tetri)', async () => {
    await createComponent();
    component.facilityForm.get('name')!.setValue('Rental Club');
    component.facilityForm.get('padelRules.racketRentGel')!.setValue(10);

    component.onSubmit();

    expect(submittedSportRules()).toEqual([
      { sportType: SportType.Padel, racketsIncluded: 0, racketRentTetri: 1000 },
    ]);
  });

  it('mixed facility: 3 included, the 4th rentable', async () => {
    await createComponent();
    component.facilityForm.get('name')!.setValue('Mixed Club');
    component.facilityForm.get('padelRules.racketsIncluded')!.setValue(3);
    component.facilityForm.get('padelRules.racketRentGel')!.setValue(7.5);

    component.onSubmit();

    expect(submittedSportRules()).toEqual([
      { sportType: SportType.Padel, racketsIncluded: 3, racketRentTetri: 750 },
    ]);
  });

  it('includes the balls sale price when set', async () => {
    await createComponent();
    component.facilityForm.get('name')!.setValue('Balls Club');
    component.facilityForm.get('padelRules.racketsIncluded')!.setValue(2);
    component.facilityForm.get('padelRules.ballsPriceGel')!.setValue(15);

    component.onSubmit();

    expect(submittedSportRules()).toEqual([
      { sportType: SportType.Padel, racketsIncluded: 2, ballsPriceTetri: 1500 },
    ]);
  });

  // ─── Omit-empty semantics (docs/20 §2) ─────────────────────────────────────

  it('omits sportRules when the facility never had a rule and the section is untouched', async () => {
    await createComponent();
    component.facilityForm.get('name')!.setValue('No Equipment Club');

    component.onSubmit();

    expect(facilityServiceSpy.createFacility).toHaveBeenCalled();
    expect(submittedSportRules()).toBeUndefined();
  });

  it('keeps emitting the rule on unrelated edits of a facility that has one', async () => {
    await createComponent(
      facilityWithRule({ sportType: SportType.Padel, racketsIncluded: 2, racketRentTetri: 500 }),
    );
    component.facilityForm.get('name')!.setValue('Renamed Club');

    component.onSubmit();

    expect(facilityServiceSpy.updateFacility).toHaveBeenCalled();
    expect(submittedSportRules()).toEqual([
      { sportType: SportType.Padel, racketsIncluded: 2, racketRentTetri: 500 },
    ]);
  });

  it('still sends a zeroed rule when an existing rule is cleared out', async () => {
    await createComponent(facilityWithRule({ sportType: SportType.Padel, racketsIncluded: 4 }));
    component.facilityForm.get('padelRules.racketsIncluded')!.setValue(0);

    component.onSubmit();

    expect(submittedSportRules()).toEqual([{ sportType: SportType.Padel, racketsIncluded: 0 }]);
  });
});
