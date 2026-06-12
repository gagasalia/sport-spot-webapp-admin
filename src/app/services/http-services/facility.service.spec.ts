import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { FacilityService } from './facility.service';
import { Facility } from '../../shared/models/facility.model';
import { environment } from '../../../environments/environment';

function wrapInApiResponse<T>(data: T) {
  return { result: { data }, errors: [] };
}

const base = `${environment.apiUrl}/facilities`;

const mockFacility: Facility = {
  _id: 'fac-1',
  name: 'Padel House',
  country: 'Georgia',
  city: 'Tbilisi',
  description: 'desc',
  amenities: [],
  activeState: false,
};

describe('FacilityService', () => {
  let service: FacilityService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FacilityService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FacilityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getFacilitiesByAcademy GETs /facilities/academy/:id and unwraps data', () => {
    let emitted: Facility[] | undefined;
    service.getFacilitiesByAcademy('aca-1').subscribe((f) => (emitted = f));

    const req = httpMock.expectOne(`${base}/academy/aca-1`);
    expect(req.request.method).toBe('GET');
    req.flush(wrapInApiResponse([mockFacility]));

    expect(emitted).toEqual([mockFacility]);
  });

  it('setFacilityStatus PATCHes /facilities/:id/status with { activeState }', () => {
    let emitted: Facility | undefined;
    service.setFacilityStatus('fac-1', true).subscribe((f) => (emitted = f));

    const req = httpMock.expectOne(`${base}/fac-1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activeState: true });
    req.flush(wrapInApiResponse({ ...mockFacility, activeState: true }));

    expect(emitted?.activeState).toBeTrue();
  });

  it('deleteFacility DELETEs /facilities/:id', () => {
    let completed = false;
    service.deleteFacility('fac-1').subscribe({ complete: () => (completed = true) });

    const req = httpMock.expectOne(`${base}/fac-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(completed).toBeTrue();
  });
});
