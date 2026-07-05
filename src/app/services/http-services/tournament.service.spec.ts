import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { TournamentService } from './tournament.service';
import { Tournament } from '../../shared/models/tournament.model';
import { environment } from '../../../environments/environment';

const base = environment.apiUrl;

const mockTournament: Tournament = {
  _id: 't1',
  academy: 'a1',
  facility: 'f1',
  facilityName: 'Green Hills Padel',
  city: 'Tbilisi',
  name: 'Summer Open',
  sportType: 'padel',
  type: 'doubles',
  format: 'knockout',
  level: 'any',
  startDate: '2026-07-18',
  startTime: '10:00',
  entryFeeTetri: 5000,
  currency: 'GEL',
  maxParticipants: 16,
  registeredCount: 4,
  status: 'draft',
};

function wrap<T>(data: T, page?: { page: number; size: number; total: number }) {
  return { result: { data, ...(page ? { page } : {}) }, errors: [] };
}

describe('TournamentService', () => {
  let service: TournamentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TournamentService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TournamentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs the academy tournaments with paging', () => {
    let result: Tournament[] | undefined;
    service.getMyTournaments(2, 10).subscribe(({ data }) => (result = data));

    const req = httpMock.expectOne(`${base}/tournaments/my?page=2&limit=10`);
    expect(req.request.method).toBe('GET');
    req.flush(wrap([mockTournament], { page: 2, size: 10, total: 11 }));

    expect(result).toEqual([mockTournament]);
  });

  it('POSTs a create payload', () => {
    let result: Tournament | undefined;
    service
      .createTournament({
        facility: 'f1',
        name: 'Summer Open',
        type: 'doubles',
        format: 'knockout',
        startDate: '2026-07-18',
        startTime: '10:00',
        entryFeeTetri: 5000,
        maxParticipants: 16,
      })
      .subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${base}/tournaments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.entryFeeTetri).toBe(5000);
    req.flush(wrap(mockTournament));

    expect(result).toEqual(mockTournament);
  });

  it('PATCHes a lifecycle transition', () => {
    let result: Tournament | undefined;
    service.setStatus('t1', 'published').subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${base}/tournaments/t1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'published' });
    req.flush(wrap({ ...mockTournament, status: 'published' }));

    expect(result?.status).toBe('published');
  });

  it('GETs the registrations of one tournament', () => {
    let count = -1;
    service.getRegistrations('t1').subscribe((regs) => (count = regs.length));

    const req = httpMock.expectOne(`${base}/tournaments/t1/registrations`);
    expect(req.request.method).toBe('GET');
    req.flush(
      wrap([
        {
          _id: 'r1',
          tournament: 't1',
          user: 'u1',
          status: 'registered',
          paymentStatus: 'paid',
        },
      ]),
    );

    expect(count).toBe(1);
  });

  it('DELETEs a draft', () => {
    let done = false;
    service.deleteTournament('t1').subscribe(() => (done = true));

    const req = httpMock.expectOne(`${base}/tournaments/t1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(wrap({ deleted: true }));

    expect(done).toBeTrue();
  });
});
