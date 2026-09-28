import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';

import { FacilityFormComponent } from './facility-form.component';
import { TPipe } from '../../../../shared/i18n/t.pipe';
import { FacilityService } from '../../../../services/http-services/facility.service';
import { MediaService } from '../../../../services/http-services/media.service';
import { TenantService } from '../../../../shared/services/tenant.service';
import { CreateFacilityDto, Facility } from '../../../../shared/models/facility.model';
import { SsToastService } from '../../../../shared/ui/toast.service';
import { SS_DIALOG_CONTEXT } from '../../../../shared/ui/dialog.service';

const facility: Facility = {
  _id: 'f-1',
  name: 'ლისის პადელი',
  country: 'Georgia',
  city: 'Tbilisi',
  district: 'Saburtalo',
  landmark: 'lisi',
  description: '',
  amenities: [],
};

describe('FacilityFormComponent — landmark', () => {
  let component: FacilityFormComponent;
  let fixture: ComponentFixture<FacilityFormComponent>;
  let facilitySpy: jasmine.SpyObj<FacilityService>;

  async function setup(existing?: Facility) {
    facilitySpy = jasmine.createSpyObj<FacilityService>('FacilityService', [
      'createFacility',
      'updateFacility',
    ]);
    facilitySpy.createFacility.and.returnValue(of(facility));
    facilitySpy.updateFacility.and.returnValue(of(facility));
    const alertSpy = jasmine.createSpyObj<SsToastService>('SsToastService', ['open']);
    alertSpy.open.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [FacilityFormComponent],
      providers: [
        {
          provide: SS_DIALOG_CONTEXT,
          useValue: {
            data: existing ? { facility: existing } : {},
            completeWith: jasmine.createSpy('completeWith'),
          },
        },
        { provide: FacilityService, useValue: facilitySpy },
        { provide: MediaService, useValue: jasmine.createSpyObj('MediaService', ['uploadImage']) },
        { provide: TenantService, useValue: { academyId: () => 'aca-1' } },
        { provide: SsToastService, useValue: alertSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(FacilityFormComponent, {
        set: { imports: [ReactiveFormsModule, TPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(FacilityFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const createBody = (): CreateFacilityDto => facilitySpy.createFacility.calls.mostRecent().args[0];

  it('offers the four landmarks plus "none"', async () => {
    await setup();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      '[data-testid="facility-landmark"]',
    );
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['', 'kus-tba', 'lisi', 'expo-park', 'mtatsmindis-parki']);
  });

  it('create sends the picked landmark and leaves an empty one out', async () => {
    await setup();
    component.facilityForm.patchValue({ name: 'ახალი', landmark: 'kus-tba' });
    component.onSubmit();
    expect(createBody().landmark).toBe('kus-tba');

    component.facilityForm.patchValue({ landmark: '' });
    component.onSubmit();
    expect(createBody().landmark).toBeUndefined();
  });

  // The facility update drops only undefined keys; '' is the API's "clear".
  it("edit pre-selects the stored landmark and sends '' when it is cleared", async () => {
    await setup(facility);
    expect(component.facilityForm.get('landmark')?.value).toBe('lisi');

    component.facilityForm.patchValue({ landmark: '' });
    component.onSubmit();

    const [id, dto] = facilitySpy.updateFacility.calls.mostRecent().args;
    expect(id).toBe('f-1');
    expect(dto.landmark).toBe('');
  });
});
