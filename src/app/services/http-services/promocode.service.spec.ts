import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { PromocodeService } from './promocode.service';
import {
  CreatePromocodeDto,
  Promocode,
  PromoRedemption,
  UpdatePromocodeDto,
} from '../../shared/models/promocode.model';
import { environment } from '../../../environments/environment';

function wrap<T>(data: T, page?: unknown) {
  return { result: { data, page }, errors: [] };
}

const base = `${environment.apiUrl}/promocodes`;

const mockPromo: Promocode = {
  _id: 'p-1',
  academy: 'aca-1',
  academyName: 'Padel House',
  code: 'SUMMER-25',
  name: 'ზაფხულის აქცია',
  discountType: 'percent',
  percentOff: 25,
  maxDiscountTetri: 2000,
  eligibility: 'everyone',
  usedCount: 0,
  active: true,
};

const mockRedemption: PromoRedemption = {
  _id: 'r-1',
  promo: 'p-1',
  code: 'SUMMER-25',
  user: { _id: 'u-1', firstName: 'Anna', lastName: 'Kapanadze', phone: '+995599000111' },
  booking: 'b-1',
  discountTetri: 500,
  priceTetri: 5000,
  createdAt: '2026-08-01T10:00:00.000Z',
};

describe('PromocodeService', () => {
  let service: PromocodeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PromocodeService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PromocodeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getPromocodes GETs /promocodes with every provided param and unwraps rows + page', () => {
    let emitted: { data: Promocode[]; page?: { total: number } } | undefined;
    service
      .getPromocodes({ page: 2, limit: 20, academyId: 'aca-1', q: 'SUM', active: true })
      .subscribe((r) => (emitted = r as never));

    const req = httpMock.expectOne(
      (r) =>
        r.url === base &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '20' &&
        r.params.get('academyId') === 'aca-1' &&
        r.params.get('q') === 'SUM' &&
        r.params.get('active') === 'true',
    );
    expect(req.request.method).toBe('GET');
    req.flush(wrap([mockPromo], { page: 2, size: 20, total: 41 }));

    expect(emitted!.data).toEqual([mockPromo]);
    expect(emitted!.page?.total).toBe(41);
  });

  it('getPromocodes omits undefined optional params from the URL', () => {
    service.getPromocodes({ page: 1, limit: 20 }).subscribe();

    const req = httpMock.expectOne(
      (r) =>
        r.url === base &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '20' &&
        !r.params.has('academyId') &&
        !r.params.has('q') &&
        !r.params.has('active'),
    );
    req.flush(wrap([mockPromo]));
  });

  it('getPromocodes still sends active=false (only undefined is omitted)', () => {
    service.getPromocodes({ page: 1, limit: 20, active: false }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === base && r.params.get('active') === 'false',
    );
    req.flush(wrap([]));
  });

  it('getPromocodes defaults to an empty array when data is null', () => {
    let emitted: { data: Promocode[] } | undefined;
    service.getPromocodes({ page: 1, limit: 20 }).subscribe((r) => (emitted = r as never));
    const req = httpMock.expectOne((r) => r.url === base);
    req.flush(wrap(null));
    expect(emitted!.data).toEqual([]);
  });

  it('createPromocode POSTs the dto (money in tetri) and unwraps the promocode', () => {
    const dto: CreatePromocodeDto = {
      code: 'SUMMER-25',
      name: 'ზაფხულის აქცია',
      discountType: 'percent',
      percentOff: 25,
      maxDiscountTetri: 2000,
      eligibility: 'everyone',
      active: true,
      academyId: 'aca-1',
    };
    let emitted: Promocode | undefined;
    service.createPromocode(dto).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(wrap(mockPromo));

    expect(emitted).toEqual(mockPromo);
  });

  it('updatePromocode PATCHes the dto and passes explicit nulls through untouched', () => {
    const dto: UpdatePromocodeDto = {
      name: null,
      maxDiscountTetri: null,
      expiresAt: null,
      usageLimitTotal: null,
      active: true,
    };
    let emitted: Promocode | undefined;
    service.updatePromocode('p-1', dto).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/p-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      name: null,
      maxDiscountTetri: null,
      expiresAt: null,
      usageLimitTotal: null,
      active: true,
    });
    req.flush(wrap({ ...mockPromo, name: undefined }));

    expect(emitted).toBeTruthy();
  });

  it('deletePromocode DELETEs and maps the result to undefined', () => {
    let emitted: unknown = 'sentinel';
    service.deletePromocode('p-1').subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/p-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(wrap({ deleted: true }));

    expect(emitted).toBeUndefined();
  });

  it('getRedemptions GETs /promocodes/:id/redemptions with page params and unwraps', () => {
    let emitted: { data: PromoRedemption[]; page?: { total: number } } | undefined;
    service.getRedemptions('p-1', 2, 10).subscribe((r) => (emitted = r as never));

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${base}/p-1/redemptions` &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '10',
    );
    expect(req.request.method).toBe('GET');
    req.flush(wrap([mockRedemption], { page: 2, size: 10, total: 11 }));

    expect(emitted!.data).toEqual([mockRedemption]);
    expect(emitted!.page?.total).toBe(11);
  });

  it('getRedemptions defaults to an empty array when data is null', () => {
    let emitted: { data: PromoRedemption[] } | undefined;
    service.getRedemptions('p-1').subscribe((r) => (emitted = r as never));
    const req = httpMock.expectOne((r) => r.url === `${base}/p-1/redemptions`);
    req.flush(wrap(null));
    expect(emitted!.data).toEqual([]);
  });
});
