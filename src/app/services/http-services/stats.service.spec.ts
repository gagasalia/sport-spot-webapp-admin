import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { StatsService } from './stats.service';
import { StatsOverview } from '../../shared/models/stats.model';
import { environment } from '../../../environments/environment';

function wrapInApiResponse<T>(data: T) {
  return { result: { data }, errors: [] };
}

const base = `${environment.apiUrl}/statistics`;

const overview: StatsOverview = {
  current: {
    occupancy: 0.33,
    netRevenueTetri: 2627000,
    totalBookings: 558,
    cancelRate: 0.12,
    newUsers: 9,
    returningUsers: 45,
  },
  previous: {
    occupancy: 0.29,
    netRevenueTetri: 2644000,
    totalBookings: 493,
    cancelRate: 0.12,
    newUsers: 17,
    returningUsers: 31,
  },
  previousRange: { from: '2026-06-04', to: '2026-07-03' },
};

describe('StatsService', () => {
  let service: StatsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StatsService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StatsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getOverview GETs /statistics/overview with the date range and unwraps data', () => {
    let emitted: StatsOverview | undefined;
    service
      .getOverview({ from: '2026-07-04', to: '2026-08-02' })
      .subscribe((v) => (emitted = v));

    const req = httpMock.expectOne(
      `${base}/overview?from=2026-07-04&to=2026-08-02`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(wrapInApiResponse(overview));

    expect(emitted).toEqual(overview);
  });

  it('serializes only the filters that are set', () => {
    service
      .getRevenue({
        from: '2026-07-04',
        to: '2026-08-02',
        facilityId: 'fac-1',
        granularity: 'week',
        // academyId/courtId/sportType intentionally absent
      })
      .subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${base}/revenue`,
    );
    expect(req.request.params.get('from')).toBe('2026-07-04');
    expect(req.request.params.get('facilityId')).toBe('fac-1');
    expect(req.request.params.get('granularity')).toBe('week');
    expect(req.request.params.has('academyId')).toBeFalse();
    expect(req.request.params.has('courtId')).toBeFalse();
    expect(req.request.params.has('sportType')).toBeFalse();
    req.flush(wrapInApiResponse({}));
  });

  it('exposes one getter per metric endpoint', () => {
    const calls: [keyof StatsService, string][] = [
      ['getOccupancy', 'occupancy'],
      ['getHeatmap', 'heatmap'],
      ['getUsers', 'users'],
      ['getCancellations', 'cancellations'],
    ];
    for (const [method, path] of calls) {
      (
        service[method] as (q: { from: string; to: string }) => {
          subscribe: () => void;
        }
      )({ from: '2026-08-01', to: '2026-08-02' }).subscribe();
      const req = httpMock.expectOne((r) => r.url === `${base}/${path}`);
      req.flush(wrapInApiResponse({}));
    }
  });
});
