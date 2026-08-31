import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import {
  GrantResult,
  GrantVoucherDto,
  ImportEntry,
  ImportResult,
  ImportVouchersDto,
  PendingGrant,
  Voucher,
  VoucherScopeQuery,
} from '../../shared/models/voucher.model';

export interface PaginatedVouchers {
  data: Voucher[];
  page?: ApiPage;
}

export interface PaginatedGrants {
  data: PendingGrant[];
  page?: ApiPage;
}

/**
 * Admin voucher API (design §21.4). All amounts cross the wire as integer
 * **tetri**; the page converts to/from GEL at its edge. Every payload is the
 * standard `SsResponse` envelope (`{ result: { data }, errors }`).
 *
 * Two write endpoints (`grant`, `import`) and two scope-filtered reads
 * (`getVouchers`, `getGrants`). One SCOPE per request: `facilityId` → that
 * facility's vouchers; `academyId` → the academy-WIDE ones; neither → the
 * universal pool (superadmin-only). All roles-guarded + tenancy-checked
 * server-side.
 */
@Injectable({ providedIn: 'root' })
export class VoucherService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/vouchers`;

  /**
   * POST /vouchers/grant — grant to a single phone. An existing user gets an
   * immediate active `Voucher` (carries `code`); an unknown phone becomes a
   * `PendingGrant`. The caller discriminates via `isVoucher()`.
   */
  grant(dto: GrantVoucherDto): Observable<GrantResult> {
    return this.http
      .post<ApiResponse<GrantResult>>(`${this.apiUrl}/grant`, dto)
      .pipe(map((res) => res.result.data));
  }

  /**
   * POST /vouchers/grants/import — bulk grant under one scope. Existing users
   * are granted vouchers, unknown phones queued as pending grants; the result
   * reports the split `{ granted, pending }`.
   */
  import(
    scope: VoucherScopeQuery,
    entries: ImportEntry[],
    expiresAt?: string,
  ): Observable<ImportResult> {
    const dto: ImportVouchersDto = { ...scope, entries };
    if (expiresAt) dto.expiresAt = expiresAt;
    return this.http
      .post<ApiResponse<ImportResult>>(`${this.apiUrl}/grants/import`, dto)
      .pipe(map((res) => res.result.data));
  }

  /** GET /vouchers — vouchers of one scope (admin-scoped, paginated). */
  getVouchers(scope: VoucherScopeQuery, page = 1, limit = 20): Observable<PaginatedVouchers> {
    return this.http
      .get<ApiResponse<Voucher[]>>(this.apiUrl, { params: this.scopeParams(scope, page, limit) })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }

  /** GET /vouchers/grants — pending grants of one scope (paginated). */
  getGrants(scope: VoucherScopeQuery, page = 1, limit = 20): Observable<PaginatedGrants> {
    return this.http
      .get<ApiResponse<PendingGrant[]>>(`${this.apiUrl}/grants`, {
        params: this.scopeParams(scope, page, limit),
      })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }

  private scopeParams(scope: VoucherScopeQuery, page: number, limit: number): HttpParams {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (scope.facilityId) params = params.set('facilityId', scope.facilityId);
    else if (scope.academyId) params = params.set('academyId', scope.academyId);
    return params;
  }
}
