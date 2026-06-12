import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ScheduleService } from './schedule.service';
import {
  FacilityScheduleDTO,
  HolidayDTO,
  PricingDTO,
  WeeklyHoursDTO,
} from '../../shared/models/schedule.model';
import { environment } from '../../../environments/environment';

function wrapInApiResponse<T>(data: T) {
  return { result: { data }, errors: [] };
}

const FACILITY_ID = 'fac-1';

const emptyWeeklyHours: WeeklyHoursDTO = {
  0: [{ start: '09:00', end: '22:00' }],
  1: [{ start: '09:00', end: '22:00' }],
  2: [{ start: '09:00', end: '22:00' }],
  3: [{ start: '09:00', end: '22:00' }],
  4: [{ start: '09:00', end: '22:00' }],
  5: [{ start: '09:00', end: '22:00' }],
  6: [],
};

const mockSchedule: FacilityScheduleDTO = {
  _id: 'sched-1',
  facility: FACILITY_ID,
  academy: 'aca-1',
  timezone: 'Asia/Tbilisi',
  slotDurationMinutes: 90,
  weeklyHours: emptyWeeklyHours,
  holidays: [],
  pricing: { currency: 'GEL', generalPriceTetri: 0 },
};

describe('ScheduleService', () => {
  let service: ScheduleService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/facilities/${FACILITY_ID}/schedule`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ScheduleService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ScheduleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── tetri ↔ GEL conversion ───────────────────────────────────────────────

  describe('tetri ↔ GEL conversion', () => {
    it('gelToTetri converts decimal GEL to integer tetri', () => {
      expect(ScheduleService.gelToTetri(25)).toBe(2500);
      expect(ScheduleService.gelToTetri(25.5)).toBe(2550);
      expect(ScheduleService.gelToTetri(0)).toBe(0);
      expect(ScheduleService.gelToTetri(0.01)).toBe(1);
    });

    it('gelToTetri rounds to the nearest tetri (no float drift)', () => {
      expect(ScheduleService.gelToTetri(10.005)).toBe(1001);
      expect(ScheduleService.gelToTetri(19.99)).toBe(1999);
    });

    it('tetriToGel converts integer tetri to decimal GEL', () => {
      expect(ScheduleService.tetriToGel(2500)).toBe(25);
      expect(ScheduleService.tetriToGel(2550)).toBe(25.5);
      expect(ScheduleService.tetriToGel(0)).toBe(0);
      expect(ScheduleService.tetriToGel(1)).toBe(0.01);
    });

    it('round-trips GEL → tetri → GEL', () => {
      [0, 5, 25.5, 19.99, 100].forEach((gel) => {
        const tetri = ScheduleService.gelToTetri(gel);
        expect(ScheduleService.tetriToGel(tetri)).toBeCloseTo(gel, 2);
      });
    });
  });

  // ── reads ─────────────────────────────────────────────────────────────────

  it('getSchedule GETs the facility-scoped schedule url and unwraps data', () => {
    let emitted: FacilityScheduleDTO | undefined;
    service.getSchedule(FACILITY_ID).subscribe((s) => (emitted = s));

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush(wrapInApiResponse(mockSchedule));

    expect(emitted).toEqual(mockSchedule);
  });

  // ── writes ──────────────────────────────────────────────────────────────

  it('updateWeeklyHours PUTs weeklyHours per facility', () => {
    service.updateWeeklyHours(FACILITY_ID, emptyWeeklyHours).subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ weeklyHours: emptyWeeklyHours });
    req.flush(wrapInApiResponse(mockSchedule));
  });

  it('updateWeeklyHours includes optional meta when provided', () => {
    service
      .updateWeeklyHours(FACILITY_ID, emptyWeeklyHours, {
        timezone: 'Asia/Tbilisi',
        slotDurationMinutes: 60,
      })
      .subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.body).toEqual({
      weeklyHours: emptyWeeklyHours,
      timezone: 'Asia/Tbilisi',
      slotDurationMinutes: 60,
    });
    req.flush(wrapInApiResponse(mockSchedule));
  });

  it('updatePricing PATCHes /pricing with the tetri payload', () => {
    const pricing: PricingDTO = {
      currency: 'GEL',
      generalPriceTetri: 2500,
      offPeak: { start: '10:00', end: '14:00', priceTetri: 2000 },
    };
    service.updatePricing(FACILITY_ID, pricing).subscribe();

    const req = httpMock.expectOne(`${base}/pricing`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(pricing);
    req.flush(wrapInApiResponse(mockSchedule));
  });

  it('addHoliday POSTs to /holidays', () => {
    const holiday: HolidayDTO = { date: '2026-01-01', isClosed: true };
    service.addHoliday(FACILITY_ID, holiday).subscribe();

    const req = httpMock.expectOne(`${base}/holidays`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(holiday);
    req.flush(wrapInApiResponse(mockSchedule));
  });

  it('updateHoliday PUTs to /holidays/:id (addressed by server _id)', () => {
    const holiday: HolidayDTO = { date: '2026-01-01', isClosed: false };
    service.updateHoliday(FACILITY_ID, 'hol-1', holiday).subscribe();

    const req = httpMock.expectOne(`${base}/holidays/hol-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(holiday);
    req.flush(wrapInApiResponse(mockSchedule));
  });

  it('deleteHoliday DELETEs /holidays/:id (addressed by server _id)', () => {
    service.deleteHoliday(FACILITY_ID, 'hol-1').subscribe();

    const req = httpMock.expectOne(`${base}/holidays/hol-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(wrapInApiResponse(mockSchedule));
  });
});
