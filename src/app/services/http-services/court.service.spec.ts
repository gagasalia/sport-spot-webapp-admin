import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { CourtService } from './court.service';
import { Court, CreateCourtDto } from '../../shared/models/court.model';
import {
  SportType,
  CourtLocationType,
  SurfaceMaterial,
  SurfaceColor,
} from '../../shared/enums/court-type.enum';
import { environment } from '../../../environments/environment';

function wrapInApiResponse<T>(data: T) {
  return { result: { data }, errors: [] };
}

const FACILITY_ID = 'fac-1';

const mockCourt: Court = {
  _id: 'court-1',
  facility: FACILITY_ID,
  academy: 'aca-1',
  courtNumber: 1,
  sportType: SportType.Padel,
  locationType: CourtLocationType.Indoor,
  surface: { material: SurfaceMaterial.Synthetic, color: SurfaceColor.Blue },
  activeState: false,
};

describe('CourtService', () => {
  let service: CourtService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/facilities/${FACILITY_ID}/courts`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CourtService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CourtService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getCourts GETs the facility-scoped url and unwraps data', () => {
    let emitted: Court[] | undefined;
    service.getCourts(FACILITY_ID).subscribe((c) => (emitted = c));

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush(wrapInApiResponse([mockCourt]));

    expect(emitted).toEqual([mockCourt]);
  });

  it('getCourtById GETs the court url and unwraps data', () => {
    let emitted: Court | undefined;
    service.getCourtById(FACILITY_ID, 'court-1').subscribe((c) => (emitted = c));

    const req = httpMock.expectOne(`${base}/court-1`);
    expect(req.request.method).toBe('GET');
    req.flush(wrapInApiResponse(mockCourt));

    expect(emitted).toEqual(mockCourt);
  });

  it('createCourt POSTs the dto and unwraps the created court', () => {
    const dto: CreateCourtDto = {
      courtNumber: 2,
      sportType: SportType.Padel,
      locationType: CourtLocationType.Outdoor,
      surface: { material: SurfaceMaterial.Clay, color: SurfaceColor.Red },
    };
    let created: Court | undefined;
    service.createCourt(FACILITY_ID, dto).subscribe((c) => (created = c));

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(wrapInApiResponse({ ...mockCourt, ...dto }));

    expect(created?.courtNumber).toBe(2);
  });

  it('updateCourt PUTs the dto to the court url', () => {
    service.updateCourt(FACILITY_ID, 'court-1', { courtNumber: 9 }).subscribe();

    const req = httpMock.expectOne(`${base}/court-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ courtNumber: 9 });
    req.flush(wrapInApiResponse(mockCourt));
  });

  it('setCourtStatus PATCHes /status with { activeState }', () => {
    let emitted: Court | undefined;
    service.setCourtStatus(FACILITY_ID, 'court-1', true).subscribe((c) => (emitted = c));

    const req = httpMock.expectOne(`${base}/court-1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activeState: true });
    req.flush(wrapInApiResponse({ ...mockCourt, activeState: true }));

    expect(emitted?.activeState).toBeTrue();
  });

  it('deleteCourt DELETEs the court url', () => {
    let completed = false;
    service.deleteCourt(FACILITY_ID, 'court-1').subscribe({ complete: () => (completed = true) });

    const req = httpMock.expectOne(`${base}/court-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(completed).toBeTrue();
  });
});
