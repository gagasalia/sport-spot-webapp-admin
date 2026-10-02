import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';

import { RankingService, apiErrorMessage } from './ranking.service';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';
import { SKIP_LOADING } from '../../shared/interceptors/loading.interceptor';
import {
  RatingCardView,
  ScorecardView,
  TournamentResultDto,
} from '../../shared/models/ranking.model';
import { environment } from '../../../environments/environment';

const base = environment.apiUrl;

function wrap<T>(data: T, page?: { page: number; size: number; total: number }) {
  return { result: { data, ...(page ? { page } : {}) }, errors: [] };
}

const card = { id: 's1', status: 'confirmed' } as ScorecardView;

describe('RankingService', () => {
  let service: RankingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RankingService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RankingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs a tournament’s results', () => {
    let result: ScorecardView[] | undefined;
    service.tournamentResults('t1').subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${base}/tournaments/t1/results`);
    expect(req.request.method).toBe('GET');
    req.flush(wrap([card]));
    expect(result).toEqual([card]);
  });

  it('POSTs one result quietly (the dialog shows the API message inline)', () => {
    const dto: TournamentResultDto = {
      mode: 'singles',
      participants: [
        { key: 'a', phone: '+995555000001' },
        { key: 'b', phone: '555000002', name: 'Luka' },
      ],
      games: [{ teams: [['a'], ['b']], score: { type: 'sets', sets: [[6, 1]] } }],
    };
    service.createTournamentResult('t1', dto).subscribe();
    const req = httpMock.expectOne(`${base}/tournaments/t1/results`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap(card));
  });

  it('DELETEs a result with the reason in the body', () => {
    service.voidTournamentResult('t1', 's1', 'typo').subscribe();
    const req = httpMock.expectOne(`${base}/tournaments/t1/results/s1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ reason: 'typo' });
    req.flush(wrap({ ...card, status: 'void' }));
  });

  it('GETs the moderation list with only the set filters', () => {
    let total: number | undefined;
    service
      .scorecards({ status: 'pending', shadowOnly: true, userId: 'u1', page: 2, limit: 20 })
      .subscribe(({ page }) => (total = page?.total));
    const req = httpMock.expectOne(
      (r) => r.url === `${base}/ranking/scorecards` && r.method === 'GET',
    );
    expect(req.request.params.get('status')).toBe('pending');
    expect(req.request.params.get('shadowOnly')).toBe('true');
    expect(req.request.params.get('userId')).toBe('u1');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush(wrap([card], { page: 2, size: 20, total: 21 }));
    expect(total).toBe(21);
  });

  it('omits unset moderation filters', () => {
    service.scorecards({ shadowOnly: false }).subscribe();
    const req = httpMock.expectOne(`${base}/ranking/scorecards`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush(wrap([]));
  });

  it('POSTs a void with its reason', () => {
    service.voidScorecard('s1', 'duplicate').subscribe();
    const req = httpMock.expectOne(`${base}/ranking/scorecards/s1/void`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'duplicate' });
    req.flush(wrap({ ...card, status: 'void' }));
  });

  it('GETs a customer’s rating card', () => {
    let result: RatingCardView | undefined;
    service.customerCard('u1').subscribe((c) => (result = c));
    const req = httpMock.expectOne(`${base}/ranking/customers/u1/card`);
    req.flush(wrap({ name: 'Nino', calibrating: true } as RatingCardView));
    expect(result?.name).toBe('Nino');
  });

  it('passes the moderation phone filter as typed', () => {
    service.scorecards({ phone: '555 123 456' }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/ranking/scorecards`);
    expect(req.request.params.get('phone')).toBe('555 123 456');
    req.flush(wrap([]));
  });

  it('GETs a customer’s scorecards in every status, paginated and quiet', () => {
    let total: number | undefined;
    service
      .customerScorecards('u1', { page: 2, limit: 5 })
      .subscribe(({ page }) => (total = page?.total));
    const req = httpMock.expectOne((r) => r.url === `${base}/ranking/customers/u1/scorecards`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('5');
    expect(req.request.params.has('status')).toBeFalse();
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap([card], { page: 2, size: 5, total: 7 }));
    expect(total).toBe(7);
  });

  it('looks a phone up without the overlay or the error toast', () => {
    let found: boolean | undefined;
    service.lookupCustomer('555123456').subscribe((v) => (found = v.found));
    const req = httpMock.expectOne(
      (r) => r.url === `${base}/ranking/customers/lookup` && r.params.get('phone') === '555123456',
    );
    expect(req.request.context.get(SKIP_LOADING)).toBeTrue();
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap({ found: true, userId: 'u9', name: 'Luka' }));
    expect(found).toBeTrue();
  });

  it('apiErrorMessage reads the envelope’s first error', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { result: null, errors: [{ statusCode: 400, message: 'invalid_set_score: x' }] },
    });
    expect(apiErrorMessage(err)).toBe('invalid_set_score: x');
    expect(apiErrorMessage(new HttpErrorResponse({ status: 500 }))).toBe('');
    expect(apiErrorMessage(new Error('boom'))).toBe('');
  });
});
