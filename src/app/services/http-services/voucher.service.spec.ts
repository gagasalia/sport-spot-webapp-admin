import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { VoucherService } from './voucher.service';
import { GrantResult, GrantVoucherDto, PendingGrant, Voucher } from '../../shared/models/voucher.model';
import { environment } from '../../../environments/environment';

function wrap<T>(data: T, page?: unknown) {
  return { result: { data, page }, errors: [] };
}

const FACILITY_ID = 'fac-1';
const ACADEMY_ID = 'aca-1';
const base = `${environment.apiUrl}/vouchers`;

const mockVoucher: Voucher = {
  _id: 'v-1',
  facility: FACILITY_ID,
  code: 'SS-ABCD-2345',
  initialTetri: 5000,
  balanceTetri: 5000,
  currency: 'GEL',
  status: 'active',
  source: 'admin_grant',
  ownerPhone: '+995555123456',
};

const mockGrant: PendingGrant = {
  _id: 'g-1',
  phone: '+995555999888',
  facility: FACILITY_ID,
  amountTetri: 3000,
  source: 'admin_grant',
};

describe('VoucherService', () => {
  let service: VoucherService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VoucherService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VoucherService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('grant POSTs the dto (amount in tetri) and returns an active voucher', () => {
    const dto: GrantVoucherDto = {
      phone: '+995555123456',
      facilityId: FACILITY_ID,
      amountTetri: 5000,
      note: 'welcome',
    };
    let emitted: GrantResult | undefined;
    service.grant(dto).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/grant`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(wrap({ status: 'granted', voucher: mockVoucher }));

    expect(emitted).toEqual({ status: 'granted', voucher: mockVoucher });
  });

  it('grant can return a pending grant for an unknown phone', () => {
    let emitted: GrantResult | undefined;
    service
      .grant({ phone: '+995555999888', facilityId: FACILITY_ID, amountTetri: 3000 })
      .subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/grant`);
    req.flush(wrap({ status: 'pending', grant: mockGrant }));

    expect(emitted).toEqual({ status: 'pending', grant: mockGrant });
  });

  it('import POSTs the facility scope + entries and unwraps { granted, pending }', () => {
    const entries = [
      { phone: '+995555123456', amountTetri: 5000 },
      { phone: '+995555123457', amountTetri: 2500 },
    ];
    let emitted: { granted: number; pending: number } | undefined;
    service.import({ facilityId: FACILITY_ID }, entries).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/grants/import`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ facilityId: FACILITY_ID, entries });
    expect(req.request.body.expiresAt).toBeUndefined();
    req.flush(wrap({ granted: 1, pending: 1 }));

    expect(emitted).toEqual({ granted: 1, pending: 1 });
  });

  it('import includes expiresAt only when provided, and carries an academy scope', () => {
    const entries = [{ phone: '+995555123456', amountTetri: 5000 }];
    service.import({ academyId: ACADEMY_ID }, entries, '2026-12-31').subscribe();

    const req = httpMock.expectOne(`${base}/grants/import`);
    expect(req.request.body).toEqual({ academyId: ACADEMY_ID, entries, expiresAt: '2026-12-31' });
    req.flush(wrap({ granted: 1, pending: 0 }));
  });

  it('getVouchers GETs /vouchers with facility + page params and unwraps rows + page', () => {
    let emitted: { data: Voucher[]; page?: { total: number } } | undefined;
    service.getVouchers({ facilityId: FACILITY_ID }, 2, 20).subscribe((v) => (emitted = v as never));

    const req = httpMock.expectOne(
      (r) =>
        r.url === base &&
        r.params.get('facilityId') === FACILITY_ID &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '20',
    );
    expect(req.request.method).toBe('GET');
    req.flush(wrap([mockVoucher], { page: 2, size: 20, total: 41 }));

    expect(emitted!.data).toEqual([mockVoucher]);
    expect(emitted!.page?.total).toBe(41);
  });

  it('getVouchers sends academyId for the academy-wide scope', () => {
    service.getVouchers({ academyId: ACADEMY_ID }).subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === base &&
        r.params.get('academyId') === ACADEMY_ID &&
        !r.params.has('facilityId'),
    );
    expect(req.request.method).toBe('GET');
    req.flush(wrap([]));
  });

  it('getVouchers sends NO scope params for the universal pool', () => {
    service.getVouchers({}).subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === base && !r.params.has('facilityId') && !r.params.has('academyId'),
    );
    expect(req.request.method).toBe('GET');
    req.flush(wrap([]));
  });

  it('getVouchers defaults to an empty array when data is null', () => {
    let emitted: { data: Voucher[] } | undefined;
    service.getVouchers({ facilityId: FACILITY_ID }).subscribe((v) => (emitted = v as never));
    const req = httpMock.expectOne((r) => r.url === base);
    req.flush(wrap(null));
    expect(emitted!.data).toEqual([]);
  });

  it('getGrants GETs /vouchers/grants with facility + page params and unwraps', () => {
    let emitted: { data: PendingGrant[] } | undefined;
    service.getGrants({ facilityId: FACILITY_ID }).subscribe((g) => (emitted = g as never));

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${base}/grants` &&
        r.params.get('facilityId') === FACILITY_ID &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '20',
    );
    expect(req.request.method).toBe('GET');
    req.flush(wrap([mockGrant]));

    expect(emitted!.data).toEqual([mockGrant]);
  });
});
