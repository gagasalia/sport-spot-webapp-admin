import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { CoachService } from './coach.service';
import { Coach, CreateCoachDto, UpdateCoachDto } from '../../shared/models/coach.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';
import { environment } from '../../../environments/environment';

function wrap<T>(data: T, page?: unknown) {
  return { result: { data, page }, errors: [] };
}

const base = `${environment.apiUrl}/coaches`;

const coach: Coach = {
  _id: 'c-1',
  name: 'გიორგი ბერიძე',
  nameEn: 'Giorgi Beridze',
  slug: 'giorgi-beridze',
  bio: 'ტრენერი',
  languages: ['ka', 'en'],
  levels: ['beginner'],
  certifications: ['FIP Level 1'],
  priceIndividualTetri: 8000,
  city: 'Tbilisi',
  district: 'Vake',
  academy: 'aca-1',
  facilities: ['f-1'],
  venues: [],
  status: 'published',
};

describe('CoachService', () => {
  let service: CoachService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CoachService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CoachService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getCoaches GETs /coaches with every provided filter and unwraps rows + page', () => {
    let emitted: { data: Coach[]; page?: { total: number } } | undefined;
    service
      .getCoaches({
        page: 2,
        limit: 20,
        q: 'გიორგი',
        status: 'published',
        city: 'Tbilisi',
        academy: 'aca-1',
      })
      .subscribe((r) => (emitted = r as never));

    const req = httpMock.expectOne(
      (r) =>
        r.url === base &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '20' &&
        r.params.get('q') === 'გიორგი' &&
        r.params.get('status') === 'published' &&
        r.params.get('city') === 'Tbilisi' &&
        r.params.get('academy') === 'aca-1',
    );
    expect(req.request.method).toBe('GET');
    req.flush(wrap([coach], { page: 2, size: 20, total: 41 }));

    expect(emitted!.data).toEqual([coach]);
    expect(emitted!.page?.total).toBe(41);
  });

  it('getCoaches leaves unset and empty filters out of the URL', () => {
    service.getCoaches({ page: 1, limit: 20, q: '', city: undefined, academy: '' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.params.keys().sort()).toEqual(['limit', 'page']);
    req.flush(wrap([]));
  });

  it('getCoaches defaults to an empty array when data is null', () => {
    let emitted: { data: Coach[] } | undefined;
    service.getCoaches({ page: 1, limit: 20 }).subscribe((r) => (emitted = r as never));
    httpMock.expectOne((r) => r.url === base).flush(wrap(null));
    expect(emitted!.data).toEqual([]);
  });

  it('getCoach GETs /coaches/:id and unwraps the coach', () => {
    let emitted: Coach | undefined;
    service.getCoach('c-1').subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/c-1`);
    expect(req.request.method).toBe('GET');
    req.flush(wrap(coach));
    expect(emitted).toEqual(coach);
  });

  it('createCoach POSTs the dto quietly (the page owns the error toast)', () => {
    const dto: CreateCoachDto = {
      name: 'გიორგი ბერიძე',
      bio: 'ტრენერი',
      city: 'Tbilisi',
      languages: ['ka'],
      priceIndividualTetri: 8000,
      status: 'draft',
    };
    let emitted: Coach | undefined;
    service.createCoach(dto).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap(coach));
    expect(emitted).toEqual(coach);
  });

  it('updateCoach PUTs the dto with explicit nulls untouched', () => {
    const dto: UpdateCoachDto = { photo: null, academy: null, priceGroupTetri: null };
    let emitted: Coach | undefined;
    service.updateCoach('c-1', dto).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/c-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ photo: null, academy: null, priceGroupTetri: null });
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap(coach));
    expect(emitted).toEqual(coach);
  });

  it('setStatus PATCHes /coaches/:id/status with { status }', () => {
    let emitted: Coach | undefined;
    service.setStatus('c-1', 'draft').subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/c-1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'draft' });
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap({ ...coach, status: 'draft' }));
    expect(emitted?.status).toBe('draft');
  });

  it('deleteCoach DELETEs /coaches/:id and maps the result to undefined', () => {
    let emitted: unknown = 'sentinel';
    service.deleteCoach('c-1').subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/c-1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap(true));
    expect(emitted).toBeUndefined();
  });
});
