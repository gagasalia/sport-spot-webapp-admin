import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TuiAlertService } from '@taiga-ui/core';
import { TuiDialogService } from '@taiga-ui/experimental';

import { CourtsComponent } from './courts.component';
import { CourtService } from '../../../services/http-services/court.service';
import { FacilityService } from '../../../services/http-services/facility.service';
import { TenantService } from '../../../shared/services/tenant.service';
import { Facility } from '../../../shared/models/facility.model';
import { Court } from '../../../shared/models/court.model';
import {
  SportType,
  CourtLocationType,
  SurfaceMaterial,
  SurfaceColor,
} from '../../../shared/enums/court-type.enum';

const facility: Facility = {
  _id: 'fac-1',
  name: 'Padel House',
  country: 'Georgia',
  city: 'Tbilisi',
  description: 'desc',
  amenities: [],
};

const court: Court = {
  _id: 'court-1',
  facility: 'fac-1',
  courtNumber: 1,
  sportType: SportType.Padel,
  locationType: CourtLocationType.Indoor,
  surface: { material: SurfaceMaterial.Synthetic, color: SurfaceColor.Blue },
  activeState: false,
};

describe('CourtsComponent', () => {
  let component: CourtsComponent;
  let fixture: ComponentFixture<CourtsComponent>;
  let courtSpy: jasmine.SpyObj<CourtService>;
  let facilitySpy: jasmine.SpyObj<FacilityService>;
  let tenantSpy: jasmine.SpyObj<TenantService>;

  async function setup() {
    courtSpy = jasmine.createSpyObj<CourtService>('CourtService', ['getCourts', 'deleteCourt']);
    facilitySpy = jasmine.createSpyObj<FacilityService>('FacilityService', [
      'getFacilitiesByAcademy',
    ]);
    tenantSpy = jasmine.createSpyObj<TenantService>('TenantService', ['academyId']);

    tenantSpy.academyId.and.returnValue('aca-1');
    facilitySpy.getFacilitiesByAcademy.and.returnValue(of([facility]));
    courtSpy.getCourts.and.returnValue(of([court]));

    const routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [CourtsComponent],
      providers: [
        { provide: CourtService, useValue: courtSpy },
        { provide: FacilityService, useValue: facilitySpy },
        { provide: TenantService, useValue: tenantSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: TuiAlertService, useValue: { open: () => of(undefined) } },
        { provide: TuiDialogService, useValue: { open: () => of(undefined) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(CourtsComponent, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();

    fixture = TestBed.createComponent(CourtsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => setup());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads facilities for the tenant academy', () => {
    expect(facilitySpy.getFacilitiesByAcademy).toHaveBeenCalledWith('aca-1');
    expect(component.facilities()).toEqual([facility]);
  });

  it('auto-selects the single facility and loads its courts via CourtService', () => {
    expect(component.selectedFacilityId()).toBe('fac-1');
    expect(courtSpy.getCourts).toHaveBeenCalledWith('fac-1');
    expect(component.courts()).toEqual([court]);
  });

  it('does not load facilities when there is no tenant academy', fakeAsync(async () => {
    tenantSpy.academyId.and.returnValue(null);
    facilitySpy.getFacilitiesByAcademy.calls.reset();

    component.ngOnInit();
    tick();

    expect(facilitySpy.getFacilitiesByAcademy).not.toHaveBeenCalled();
    expect(component.facilities()).toEqual([]);
  }));

  it('deletes a court via CourtService with facility + court ids, then reloads', () => {
    courtSpy.deleteCourt.and.returnValue(of(void 0));
    courtSpy.getCourts.calls.reset();

    component.onDeleteCourt(court);

    expect(courtSpy.deleteCourt).toHaveBeenCalledWith('fac-1', 'court-1');
    expect(courtSpy.getCourts).toHaveBeenCalledWith('fac-1');
  });
});
