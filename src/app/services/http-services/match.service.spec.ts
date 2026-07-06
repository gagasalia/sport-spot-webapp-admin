import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { MatchService } from './match.service';
import { AdminMatch } from '../../shared/models/match.model';
import { environment } from '../../../environments/environment';

const base = environment.apiUrl;

const match: AdminMatch = {
  _id: 'm1',
  owner: 'u1',
  ownerName: 'გიო ბერიძე',
  academy: 'a1',
  facility: 'f1',
  facilityName: 'Green Hills Padel',
  city: 'Tbilisi',
  sportType: 'padel',
  date: '2026-07-08',
  startTime: '19:30',
  durationMinutes: 90,
  level: 'intermediate',
  category: 'mixed',
  visibility: 'public',
  maxPlayers: 4,
  playersCount: 2,
  status: 'open',
};

describe('MatchService (operator)', () => {
  let service: MatchService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MatchService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MatchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs the academy-scoped list with filters', () => {
    let count = -1;
    service
      .getMatches({ facility: 'f1', status: 'open', page: 2, limit: 10 })
      .subscribe(({ data }) => (count = data.length));

    const req = httpMock.expectOne((r) => r.url === `${base}/matches/operator`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('facility')).toBe('f1');
    expect(req.request.params.get('status')).toBe('open');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ result: { data: [match], page: { page: 2, size: 10, total: 11 } }, errors: [] });

    expect(count).toBe(1);
  });

  it('GETs the full membership list (contacts included)', () => {
    service.getPlayers('m1').subscribe();
    const req = httpMock.expectOne(`${base}/matches/m1/players/operator`);
    expect(req.request.method).toBe('GET');
    req.flush({ result: { data: [] }, errors: [] });
  });

  it('POSTs the moderation cancel', () => {
    let status = '';
    service.cancelMatch('m1').subscribe((m) => (status = m.status));

    const req = httpMock.expectOne(`${base}/matches/m1/admin-cancel`);
    expect(req.request.method).toBe('POST');
    req.flush({
      result: { data: { ...match, status: 'cancelled', cancelledBy: 'admin' } },
      errors: [],
    });

    expect(status).toBe('cancelled');
  });
});
