import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../shared/models/api-response.model';
import {
  GrantResult,
  GrantVoucherDto,
  ImportEntry,
  ImportResult,
  ImportVouchersDto,
  PendingGrant,
  Voucher,
} from '../../shared/models/voucher.model';

/**
 * Admin voucher API (design §21.4). All amounts cross the wire as integer
 * **tetri**; the page converts to/from GEL at its edge. Every payload is the
 * standard `SsResponse` envelope (`{ result: { data }, errors }`).
 *
 * Two write endpoints (`grant`, `import`) and two facility-scoped reads
 * (`getVouchers`, `getGrants`), all roles-guarded + academy-scoped server-side.
 */
@Injectable({ providedIn: 'root' })
export class VoucherService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/vouchers`;

  /**
   * POST /vouchers/grant — grant to a single email. An existing user gets an
   * immediate active `Voucher` (carries `code`); an unknown email becomes a
   * `PendingGrant`. The caller discriminates via `isVoucher()`.
   */
  grant(dto: GrantVoucherDto): Observable<GrantResult> {
    return this.http
      .post<ApiResponse<GrantResult>>(`${this.apiUrl}/grant`, dto)
      .pipe(map((res) => res.result.data));
  }

  /**
   * POST /vouchers/grants/import — bulk grant for one facility. Existing users
   * are granted vouchers, unknown emails queued as pending grants; the result
   * reports the split `{ granted, pending }`.
   */
  import(facilityId: string, entries: ImportEntry[], expiresAt?: string): Observable<ImportResult> {
    const dto: ImportVouchersDto = { facilityId, entries };
    if (expiresAt) dto.expiresAt = expiresAt;
    return this.http
      .post<ApiResponse<ImportResult>>(`${this.apiUrl}/grants/import`, dto)
      .pipe(map((res) => res.result.data));
  }

  /** GET /vouchers?facilityId= — vouchers of a facility (admin-scoped). */
  getVouchers(facilityId: string): Observable<Voucher[]> {
    const params = new HttpParams().set('facilityId', facilityId);
    return this.http
      .get<ApiResponse<Voucher[]>>(this.apiUrl, { params })
      .pipe(map((res) => res.result.data ?? []));
  }

  /** GET /vouchers/grants?facilityId= — pending grants of a facility. */
  getGrants(facilityId: string): Observable<PendingGrant[]> {
    const params = new HttpParams().set('facilityId', facilityId);
    return this.http
      .get<ApiResponse<PendingGrant[]>>(`${this.apiUrl}/grants`, { params })
      .pipe(map((res) => res.result.data ?? []));
  }
}
