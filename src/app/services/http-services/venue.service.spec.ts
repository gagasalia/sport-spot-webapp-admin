import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { VenueService } from './venue.service';
import { CreateVenueDto, UpdateVenueDto, Venue } from '../../shared/models/venue.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';
import { environment } from '../../../environments/environment';

function wrap<T>(data: T, page?: unknown) {
  return { result: { data, page }, errors: [] };
}

const base = `${environment.apiUrl}/venues`;

const venue: Venue = {
  _id: 'v-1',
  name: 'ვაკის პადელი',
  nameEn: 'Vake Padel',
  slug: 'vake-padel',
  city: 'Tbilisi',
  citySlug: 'tbilisi',
  district: 'Vake',
  courtsCount: 4,
  indoorCourtsCount: 2,
  hasRoof: true,
  priceMinTetri: 6000,
  priceMaxTetri: 9000,
  kind: 'club',
  status: 'published',
  source: 'manual',
};

describe('VenueService', () => {
  let service: VenueService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VenueService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VenueService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getVenues GETs /venues with every provided filter and unwraps rows + page', () => {
    let emitted: { data: Venue[]; page?: { total: number } } | undefined;
    service
      .getVenues({
        page: 2,
        limit: 20,
        q: 'vake',
        city: 'Tbilisi',
        district: 'Vake',
        landmark: 'lisi',
        kind: 'club',
        status: 'published',
      })
      .subscribe((r) => (emitted = r as never));

    const req = httpMock.expectOne(
      (r) =>
        r.url === base &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '20' &&
        r.params.get('q') === 'vake' &&
        r.params.get('city') === 'Tbilisi' &&
        r.params.get('district') === 'Vake' &&
        r.params.get('landmark') === 'lisi' &&
        r.params.get('kind') === 'club' &&
        r.params.get('status') === 'published',
    );
    expect(req.request.method).toBe('GET');
    req.flush(wrap([venue], { page: 2, size: 20, total: 41 }));

    expect(emitted!.data).toEqual([venue]);
    expect(emitted!.page?.total).toBe(41);
  });

  it('getVenues leaves unset and empty filters out of the URL', () => {
    service.getVenues({ page: 1, limit: 20, q: '', city: undefined }).subscribe();

    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.params.keys().sort()).toEqual(['limit', 'page']);
    req.flush(wrap([]));
  });

  it('getVenues defaults to an empty array when data is null', () => {
    let emitted: { data: Venue[] } | undefined;
    service.getVenues({ page: 1, limit: 20 }).subscribe((r) => (emitted = r as never));
    httpMock.expectOne((r) => r.url === base).flush(wrap(null));
    expect(emitted!.data).toEqual([]);
  });

  it('getVenue GETs /venues/:id and unwraps the venue', () => {
    let emitted: Venue | undefined;
    service.getVenue('v-1').subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/v-1`);
    expect(req.request.method).toBe('GET');
    req.flush(wrap(venue));
    expect(emitted).toEqual(venue);
  });

  it('createVenue POSTs the dto quietly (the page owns the error toast)', () => {
    const dto: CreateVenueDto = {
      name: 'ვაკის პადელი',
      city: 'Tbilisi',
      courtsCount: 4,
      indoorCourtsCount: 2,
      hasRoof: true,
      priceMinTetri: 6000,
      kind: 'club',
      status: 'draft',
    };
    let emitted: Venue | undefined;
    service.createVenue(dto).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap(venue));
    expect(emitted).toEqual(venue);
  });

  it('updateVenue PUTs the dto with explicit nulls untouched', () => {
    const dto: UpdateVenueDto = { website: null, partnerFacility: null, openingHours: null };
    let emitted: Venue | undefined;
    service.updateVenue('v-1', dto).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/v-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ website: null, partnerFacility: null, openingHours: null });
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap(venue));
    expect(emitted).toEqual(venue);
  });

  it('setStatus PATCHes /venues/:id/status with { status }', () => {
    let emitted: Venue | undefined;
    service.setStatus('v-1', 'opening_soon').subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/v-1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'opening_soon' });
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap({ ...venue, status: 'opening_soon' }));
    expect(emitted?.status).toBe('opening_soon');
  });

  it('deleteVenue DELETEs /venues/:id and maps the result to undefined', () => {
    let emitted: unknown = 'sentinel';
    service.deleteVenue('v-1').subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/v-1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap({ deleted: true }));
    expect(emitted).toBeUndefined();
  });
});
