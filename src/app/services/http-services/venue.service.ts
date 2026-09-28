import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import {
  CreateVenueDto,
  UpdateVenueDto,
  Venue,
  VenueListQuery,
  VenueStatus,
} from '../../shared/models/venue.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';

export interface PaginatedVenues {
  data: Venue[];
  page?: ApiPage;
}

/**
 * Superadmin venues-directory API (`/venues`, docs/26 §WP-1b). Every payload
 * is the standard envelope (`{ result: { data, page? }, errors }`); money is
 * integer tetri. Mutations opt out of the interceptor's generic error toast —
 * the venues pages always surface their own message (slug conflict, save or
 * delete failure), so the generic one would only double it.
 */
@Injectable({ providedIn: 'root' })
export class VenueService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/venues`;

  /** GET /venues — paginated; unset and empty filters are left out of the URL. */
  getVenues(query: VenueListQuery): Observable<PaginatedVenues> {
    let params = new HttpParams().set('page', query.page).set('limit', query.limit);
    for (const key of ['q', 'city', 'district', 'landmark', 'kind', 'status'] as const) {
      const value = query[key];
      if (value !== undefined && value !== '') {
        params = params.set(key, value);
      }
    }
    return this.http
      .get<ApiResponse<Venue[]>>(this.apiUrl, { params })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }

  /** GET /venues/:id */
  getVenue(id: string): Observable<Venue> {
    return this.http
      .get<ApiResponse<Venue>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => res.result.data));
  }

  /** POST /venues — 409 means the slug is taken. */
  createVenue(dto: CreateVenueDto): Observable<Venue> {
    return this.http
      .post<ApiResponse<Venue>>(this.apiUrl, dto, { context: this.quiet() })
      .pipe(map((res) => res.result.data));
  }

  /** PUT /venues/:id — partial; an explicit `null` clears an optional field. */
  updateVenue(id: string, dto: UpdateVenueDto): Observable<Venue> {
    return this.http
      .put<ApiResponse<Venue>>(`${this.apiUrl}/${id}`, dto, { context: this.quiet() })
      .pipe(map((res) => res.result.data));
  }

  /** PATCH /venues/:id/status { status } */
  setStatus(id: string, status: VenueStatus): Observable<Venue> {
    return this.http
      .patch<ApiResponse<Venue>>(
        `${this.apiUrl}/${id}/status`,
        { status },
        { context: this.quiet() },
      )
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /venues/:id — the response body is ignored. */
  deleteVenue(id: string): Observable<void> {
    return this.http
      .delete<unknown>(`${this.apiUrl}/${id}`, { context: this.quiet() })
      .pipe(map(() => undefined));
  }

  private quiet(): HttpContext {
    return new HttpContext().set(SKIP_ERROR_TOAST, true);
  }
}
