import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import {
  Coach,
  CoachListQuery,
  CoachStatus,
  CreateCoachDto,
  UpdateCoachDto,
} from '../../shared/models/coach.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';

export interface PaginatedCoaches {
  data: Coach[];
  page?: ApiPage;
}

/**
 * Coaches directory API (`/coaches`, docs/26 §WP-1d) for ADMIN and SUPERADMIN.
 * Tenancy is server-side: an operator only ever reads and writes their own
 * academy's coaches (403 otherwise). Every payload is the standard envelope
 * (`{ result: { data, page? }, errors }`); money is integer tetri. Mutations
 * opt out of the interceptor's generic error toast — the coaches pages always
 * surface their own message (slug conflict, forbidden, save / delete failure).
 */
@Injectable({ providedIn: 'root' })
export class CoachService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/coaches`;

  /** GET /coaches — paginated; unset and empty filters are left out of the URL. */
  getCoaches(query: CoachListQuery): Observable<PaginatedCoaches> {
    let params = new HttpParams().set('page', query.page).set('limit', query.limit);
    for (const key of ['q', 'status', 'city', 'academy'] as const) {
      const value = query[key];
      if (value !== undefined && value !== '') {
        params = params.set(key, value);
      }
    }
    return this.http
      .get<ApiResponse<Coach[]>>(this.apiUrl, { params })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }

  /** GET /coaches/:id */
  getCoach(id: string): Observable<Coach> {
    return this.http
      .get<ApiResponse<Coach>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => res.result.data));
  }

  /** POST /coaches — 409 means the slug is taken. */
  createCoach(dto: CreateCoachDto): Observable<Coach> {
    return this.http
      .post<ApiResponse<Coach>>(this.apiUrl, dto, { context: this.quiet() })
      .pipe(map((res) => res.result.data));
  }

  /** PUT /coaches/:id — partial; an explicit `null` clears an optional field. */
  updateCoach(id: string, dto: UpdateCoachDto): Observable<Coach> {
    return this.http
      .put<ApiResponse<Coach>>(`${this.apiUrl}/${id}`, dto, { context: this.quiet() })
      .pipe(map((res) => res.result.data));
  }

  /** PATCH /coaches/:id/status { status } — publish or hide (draft). */
  setStatus(id: string, status: CoachStatus): Observable<Coach> {
    return this.http
      .patch<ApiResponse<Coach>>(
        `${this.apiUrl}/${id}/status`,
        { status },
        { context: this.quiet() },
      )
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /coaches/:id — the response body is ignored. */
  deleteCoach(id: string): Observable<void> {
    return this.http
      .delete<unknown>(`${this.apiUrl}/${id}`, { context: this.quiet() })
      .pipe(map(() => undefined));
  }

  private quiet(): HttpContext {
    return new HttpContext().set(SKIP_ERROR_TOAST, true);
  }
}
