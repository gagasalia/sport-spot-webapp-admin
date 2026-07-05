import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { WalletAdminService } from './wallet-admin.service';
import {
  WalletBalance,
  WalletMutation,
  WalletTransaction,
} from '../../shared/models/wallet.model';
import { environment } from '../../../environments/environment';

// ─── Test data ───────────────────────────────────────────────────────────────

const USER_ID = 'user-id-1';

const mockTx: WalletTransaction = {
  _id: 'tx-1',
  user: USER_ID,
  type: 'admin_credit',
  amountTetri: 5000,
  balanceAfterTetri: 5000,
  currency: 'GEL',
  note: 'Compensation',
  createdAt: '2026-07-05T10:00:00.000Z',
};

function wrapInApiResponse<T>(data: T, page?: { page: number; size: number; total: number }) {
  return { result: { data, ...(page ? { page } : {}) }, errors: [] };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('WalletAdminService', () => {
  let service: WalletAdminService;
  let httpMock: HttpTestingController;

  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WalletAdminService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(WalletAdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("GETs a user's balance", () => {
    let result: WalletBalance | undefined;
    service.getBalance(USER_ID).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${base}/um/${USER_ID}/wallet`);
    expect(req.request.method).toBe('GET');
    req.flush(wrapInApiResponse({ balanceTetri: 4200, currency: 'GEL' }));

    expect(result).toEqual({ balanceTetri: 4200, currency: 'GEL' });
  });

  it("GETs a user's transactions with paging meta", () => {
    let rows: WalletTransaction[] | undefined;
    let total: number | undefined;
    service.getTransactions(USER_ID, 2, 10).subscribe(({ data, page }) => {
      rows = data;
      total = page?.total;
    });

    const req = httpMock.expectOne(`${base}/um/${USER_ID}/wallet/transactions?page=2&limit=10`);
    expect(req.request.method).toBe('GET');
    req.flush(wrapInApiResponse([mockTx], { page: 2, size: 10, total: 15 }));

    expect(rows).toEqual([mockTx]);
    expect(total).toBe(15);
  });

  it('POSTs a signed adjustment with its reason', () => {
    let result: WalletMutation | undefined;
    service
      .adjust(USER_ID, { amountTetri: -2000, note: 'Chargeback' })
      .subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${base}/um/${USER_ID}/wallet/adjust`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ amountTetri: -2000, note: 'Chargeback' });
    req.flush(
      wrapInApiResponse({
        balanceTetri: 3000,
        transaction: { ...mockTx, type: 'admin_debit', amountTetri: -2000 },
      }),
    );

    expect(result?.balanceTetri).toBe(3000);
    expect(result?.transaction.type).toBe('admin_debit');
  });
});
