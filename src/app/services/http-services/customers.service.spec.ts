import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { CustomersService } from './customers.service';
import {
  CustomerModeration,
  CustomerRow,
} from '../../shared/models/customer.model';
import { environment } from '../../../environments/environment';

function wrapInApiResponse<T>(data: T, page?: unknown) {
  return { result: { data, page }, errors: [] };
}

const base = `${environment.apiUrl}/customers`;

const row: CustomerRow = {
  userId: 'u1',
  firstName: 'Anna',
  lastName: 'K',
  email: 'anna@example.com',
  phone: '+995599000111',
  banned: false,
  flagged: true,
  flagReason: 'late cancels',
  bookings: 12,
  cancelled: 2,
  noShows: 1,
  spentTetri: 66000,
  lastBookingAt: '2026-07-30T10:00:00.000Z',
  lastActivityAt: '2026-07-30T10:00:00.000Z',
};

const moderation: CustomerModeration = {
  banned: true,
  banReason: 'chronic no-show',
  flagged: false,
  history: [],
};

describe('CustomersService', () => {
  let service: CustomersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CustomersService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(CustomersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list GETs /customers with only the set filters and unwraps rows + page', () => {
    let emitted: { data: CustomerRow[]; page?: { total: number } } | undefined;
    service
      .list({ q: 'anna', page: 2, limit: 20 })
      .subscribe((v) => (emitted = v as never));

    const req = httpMock.expectOne(`${base}?q=anna&page=2&limit=20`);
    expect(req.request.method).toBe('GET');
    req.flush(wrapInApiResponse([row], { page: 2, size: 20, total: 41 }));

    expect(emitted!.data).toEqual([row]);
    expect(emitted!.page?.total).toBe(41);
  });

  it('list omits empty filters entirely', () => {
    service.list({}).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.params.keys()).toEqual([]);
    req.flush(wrapInApiResponse([]));
  });

  it('detail GETs /customers/:id and unwraps', () => {
    let emitted: unknown;
    service.detail('u1').subscribe((v) => (emitted = v));
    const req = httpMock.expectOne(`${base}/u1`);
    expect(req.request.method).toBe('GET');
    req.flush(wrapInApiResponse({ profile: { _id: 'u1' } }));
    expect((emitted as { profile: { _id: string } }).profile._id).toBe('u1');
  });

  it('bookings GETs /customers/:id/bookings with pagination', () => {
    service.bookings('u1', 3, 10).subscribe();
    const req = httpMock.expectOne(`${base}/u1/bookings?page=3&limit=10`);
    expect(req.request.method).toBe('GET');
    req.flush(wrapInApiResponse([]));
  });

  it('moderation actions PATCH the right endpoints with the reason payloads', () => {
    let banResult: CustomerModeration | undefined;
    service.ban('u1', 'chronic no-show').subscribe((v) => (banResult = v));
    const ban = httpMock.expectOne(`${base}/u1/ban`);
    expect(ban.request.method).toBe('PATCH');
    expect(ban.request.body).toEqual({ reason: 'chronic no-show' });
    ban.flush(wrapInApiResponse(moderation));
    expect(banResult).toEqual(moderation);

    service.unban('u1').subscribe();
    const unban = httpMock.expectOne(`${base}/u1/unban`);
    expect(unban.request.method).toBe('PATCH');
    expect(unban.request.body).toEqual({});
    unban.flush(wrapInApiResponse({ ...moderation, banned: false }));

    service.flag('u1', 'late cancels').subscribe();
    const flag = httpMock.expectOne(`${base}/u1/flag`);
    expect(flag.request.body).toEqual({ reason: 'late cancels' });
    flag.flush(wrapInApiResponse(moderation));

    service.unflag('u1').subscribe();
    const unflag = httpMock.expectOne(`${base}/u1/unflag`);
    expect(unflag.request.method).toBe('PATCH');
    unflag.flush(wrapInApiResponse(moderation));
  });

  it('fixContact PATCHes only the provided fields', () => {
    service.fixContact('u1', { firstName: 'Ana', phone: '+995' }).subscribe();
    const req = httpMock.expectOne(`${base}/u1/contact`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ firstName: 'Ana', phone: '+995' });
    req.flush(wrapInApiResponse({ _id: 'u1', email: 'anna@example.com' }));
  });
});
