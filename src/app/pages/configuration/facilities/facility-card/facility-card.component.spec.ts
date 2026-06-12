import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TuiAlertService } from '@taiga-ui/core';
import { TuiDialogService } from '@taiga-ui/experimental';

import { FacilityCardComponent } from './facility-card.component';
import { FacilityService } from '../../../../services/http-services/facility.service';
import { Facility } from '../../../../shared/models/facility.model';

const facility: Facility = {
  _id: 'fac-1',
  name: 'Padel House',
  country: 'Georgia',
  city: 'Tbilisi',
  description: 'desc',
  amenities: [],
  activeState: false,
};

describe('FacilityCardComponent', () => {
  let component: FacilityCardComponent;
  let fixture: ComponentFixture<FacilityCardComponent>;
  let facilitySpy: jasmine.SpyObj<FacilityService>;

  async function setup() {
    facilitySpy = jasmine.createSpyObj<FacilityService>('FacilityService', ['setFacilityStatus']);

    await TestBed.configureTestingModule({
      imports: [FacilityCardComponent],
      providers: [
        { provide: FacilityService, useValue: facilitySpy },
        { provide: TuiAlertService, useValue: { open: () => of(undefined) } },
        { provide: TuiDialogService, useValue: { open: () => of(true) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(FacilityCardComponent, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();

    fixture = TestBed.createComponent(FacilityCardComponent);
    component = fixture.componentInstance;
    component.facility = { ...facility };
    component.ngOnChanges();
    fixture.detectChanges();
  }

  beforeEach(async () => setup());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('publish toggle calls PATCH /facilities/:id/status via setFacilityStatus', () => {
    facilitySpy.setFacilityStatus.and.returnValue(of({ ...facility, activeState: true }));

    component.onToggleState(true);

    expect(facilitySpy.setFacilityStatus).toHaveBeenCalledWith('fac-1', true);
    expect(component.activeState()).toBeTrue();
  });

  it('emits the updated facility on success', () => {
    const updated = { ...facility, activeState: true };
    facilitySpy.setFacilityStatus.and.returnValue(of(updated));
    const emitted = spyOn(component.facilityUpdated, 'emit');

    component.onToggleState(true);

    expect(emitted).toHaveBeenCalledWith(updated);
  });

  it('reverts the optimistic toggle when the PATCH fails', () => {
    facilitySpy.setFacilityStatus.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    component.onToggleState(true);

    expect(component.activeState()).toBeFalse();
  });
});
