import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Court, CreateCourtDto, UpdateCourtDto } from '../../shared/models/court.model';
import { ApiResponse } from '../../shared/models/api-response.model';

/**
 * HTTP service for courts, scoped under a facility:
 * `/facilities/:facilityId/courts`. Replaces every `ConfigurationService`
 * court method (the old localStorage `sportify_courts` store is dev debris).
 */
@Injectable({
  providedIn: 'root',
})
export class CourtService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/facilities`;

  private courtsUrl(facilityId: string): string {
    return `${this.apiUrl}/${facilityId}/courts`;
  }

  /** GET /facilities/:facilityId/courts — admins see inactive courts too. */
  getCourts(facilityId: string): Observable<Court[]> {
    return this.http
      .get<ApiResponse<Court[]>>(this.courtsUrl(facilityId))
      .pipe(map((res) => res.result.data));
  }

  /**
   * GET /facilities/:facilityId/courts/:id
   *
   * @remarks Reserved for the future court-detail route; no caller wires it up yet.
   */
  getCourtById(facilityId: string, courtId: string): Observable<Court> {
    return this.http
      .get<ApiResponse<Court>>(`${this.courtsUrl(facilityId)}/${courtId}`)
      .pipe(map((res) => res.result.data));
  }

  /** POST /facilities/:facilityId/courts */
  createCourt(facilityId: string, dto: CreateCourtDto): Observable<Court> {
    return this.http
      .post<ApiResponse<Court>>(this.courtsUrl(facilityId), dto)
      .pipe(map((res) => res.result.data));
  }

  /** PUT /facilities/:facilityId/courts/:id */
  updateCourt(facilityId: string, courtId: string, dto: UpdateCourtDto): Observable<Court> {
    return this.http
      .put<ApiResponse<Court>>(`${this.courtsUrl(facilityId)}/${courtId}`, dto)
      .pipe(map((res) => res.result.data));
  }

  /** PATCH /facilities/:facilityId/courts/:id/status { activeState } */
  setCourtStatus(facilityId: string, courtId: string, activeState: boolean): Observable<Court> {
    return this.http
      .patch<ApiResponse<Court>>(`${this.courtsUrl(facilityId)}/${courtId}/status`, { activeState })
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /facilities/:facilityId/courts/:id */
  deleteCourt(facilityId: string, courtId: string): Observable<void> {
    // The DELETE response envelope body is intentionally ignored — callers only
    // care that it succeeded, so we type it as void and discard the payload.
    return this.http.delete<void>(`${this.courtsUrl(facilityId)}/${courtId}`);
  }
}
