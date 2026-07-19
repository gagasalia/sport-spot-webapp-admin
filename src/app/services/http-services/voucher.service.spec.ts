import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { VoucherService } from './voucher.service';
import { GrantVoucherDto, PendingGrant, Voucher } from '../../shared/models/voucher.model';
import { environment } from '../../../environments/environment';

function wrap<T>(data: T) {
  return { result: { data }, errors: [] };
}

const FACILITY_ID = 'fac-1';
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
  ownerEmail: 'gio@mail.com',
};

const mockGrant: PendingGrant = {
  _id: 'g-1',
  email: 'new@mail.com',
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
      email: 'gio@mail.com',
      facilityId: FACILITY_ID,
      amountTetri: 5000,
      note: 'welcome',
    };
    let emitted: Voucher | PendingGrant | undefined;
    service.grant(dto).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/grant`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(wrap(mockVoucher));

    expect(emitted).toEqual(mockVoucher);
  });

  it('grant can return a pending grant for an unknown email', () => {
    let emitted: Voucher | PendingGrant | undefined;
    service
      .grant({ email: 'new@mail.com', facilityId: FACILITY_ID, amountTetri: 3000 })
      .subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/grant`);
    req.flush(wrap(mockGrant));

    expect(emitted).toEqual(mockGrant);
  });

  it('import POSTs { facilityId, entries } and unwraps { granted, pending }', () => {
    const entries = [
      { email: 'a@mail.com', amountTetri: 5000 },
      { email: 'b@mail.com', amountTetri: 2500 },
    ];
    let emitted: { granted: number; pending: number } | undefined;
    service.import(FACILITY_ID, entries).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/grants/import`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ facilityId: FACILITY_ID, entries });
    expect(req.request.body.expiresAt).toBeUndefined();
    req.flush(wrap({ granted: 1, pending: 1 }));

    expect(emitted).toEqual({ granted: 1, pending: 1 });
  });

  it('import includes expiresAt only when provided', () => {
    const entries = [{ email: 'a@mail.com', amountTetri: 5000 }];
    service.import(FACILITY_ID, entries, '2026-12-31').subscribe();

    const req = httpMock.expectOne(`${base}/grants/import`);
    expect(req.request.body).toEqual({ facilityId: FACILITY_ID, entries, expiresAt: '2026-12-31' });
    req.flush(wrap({ granted: 1, pending: 0 }));
  });

  it('getVouchers GETs /vouchers?facilityId= and unwraps the array', () => {
    let emitted: Voucher[] | undefined;
    service.getVouchers(FACILITY_ID).subscribe((v) => (emitted = v));

    const req = httpMock.expectOne((r) => r.url === base && r.params.get('facilityId') === FACILITY_ID);
    expect(req.request.method).toBe('GET');
    req.flush(wrap([mockVoucher]));

    expect(emitted).toEqual([mockVoucher]);
  });

  it('getVouchers defaults to an empty array when data is null', () => {
    let emitted: Voucher[] | undefined;
    service.getVouchers(FACILITY_ID).subscribe((v) => (emitted = v));
    const req = httpMock.expectOne((r) => r.url === base);
    req.flush(wrap(null));
    expect(emitted).toEqual([]);
  });

  it('getGrants GETs /vouchers/grants?facilityId= and unwraps the array', () => {
    let emitted: PendingGrant[] | undefined;
    service.getGrants(FACILITY_ID).subscribe((g) => (emitted = g));

    const req = httpMock.expectOne(
      (r) => r.url === `${base}/grants` && r.params.get('facilityId') === FACILITY_ID,
    );
    expect(req.request.method).toBe('GET');
    req.flush(wrap([mockGrant]));

    expect(emitted).toEqual([mockGrant]);
  });
});
