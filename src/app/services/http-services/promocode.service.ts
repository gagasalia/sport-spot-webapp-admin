import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import {
  CreatePromocodeDto,
  Promocode,
  PromoRedemption,
  UpdatePromocodeDto,
} from '../../shared/models/promocode.model';

export interface PaginatedPromocodes {
  data: Promocode[];
  page?: ApiPage;
}

export interface PaginatedRedemptions {
  data: PromoRedemption[];
  page?: ApiPage;
}

/** Query options for `getPromocodes`; undefined keys are omitted from the URL. */
export interface PromocodeListOpts {
  page: number;
  limit: number;
  /** Superadmin-only filter; admins are auto-scoped server-side. */
  academyId?: string;
  q?: string;
  active?: boolean;
}

/**
 * Admin promocode API. Money crosses the wire as integer **tetri**; the pages
 * convert to/from GEL at their edge. Every payload is the standard envelope
 * (`{ result: { data, page? }, errors }`). Admins are auto-scoped to their own
 * academy server-side; the `academyId` filter and the create-time `academyId`
 * are superadmin-only.
 */
@Injectable({ providedIn: 'root' })
export class PromocodeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/promocodes`;

  /** GET /promocodes — paginated list with optional q/active/academyId filters. */
  getPromocodes(opts: PromocodeListOpts): Observable<PaginatedPromocodes> {
    let params = new HttpParams().set('page', opts.page).set('limit', opts.limit);
    if (opts.academyId !== undefined) params = params.set('academyId', opts.academyId);
    if (opts.q !== undefined) params = params.set('q', opts.q);
    if (opts.active !== undefined) params = params.set('active', opts.active);
    return this.http
      .get<ApiResponse<Promocode[]>>(this.apiUrl, { params })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }

  /** POST /promocodes — 409 means the code already exists. */
  createPromocode(dto: CreatePromocodeDto): Observable<Promocode> {
    return this.http
      .post<ApiResponse<Promocode>>(this.apiUrl, dto)
      .pipe(map((res) => res.result.data));
  }

  /**
   * PATCH /promocodes/:id — partial update; explicit `null` clears an optional
   * bound. 409 means the discount terms are locked (the code was already used).
   */
  updatePromocode(id: string, dto: UpdatePromocodeDto): Observable<Promocode> {
    return this.http
      .patch<ApiResponse<Promocode>>(`${this.apiUrl}/${id}`, dto)
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /promocodes/:id — 409 means the code was used (deactivate instead). */
  deletePromocode(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<{ deleted: boolean }>>(`${this.apiUrl}/${id}`)
      .pipe(map(() => undefined));
  }

  /** GET /promocodes/:id/redemptions — paginated, user populated for display. */
  getRedemptions(id: string, page = 1, limit = 20): Observable<PaginatedRedemptions> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<ApiResponse<PromoRedemption[]>>(`${this.apiUrl}/${id}/redemptions`, { params })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }
}
