import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../shared/models/api-response.model';
import {
  FacilityScheduleDTO,
  HolidayDTO,
  PricingDTO,
  UpdateScheduleDTO,
  WeeklyHoursDTO,
} from '../../shared/models/schedule.model';

/**
 * Real HTTP service for the per-facility schedule resource
 * (`/facilities/:facilityId/schedule`). Replaces the old global localStorage
 * store (`sportify_general_schedule` + `sportify_*_<facilityId>` keys) — the
 * working-hours page now loads/saves hours, holidays and pricing **per selected
 * facility**, fixing the global-schedule scoping bug.
 *
 * Prices cross the wire as integer **tetri** (1 GEL = 100 tetri). Conversion to
 * GEL happens here so the UI works purely in decimal GEL.
 */
@Injectable({
  providedIn: 'root',
})
export class ScheduleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/facilities`;

  private scheduleUrl(facilityId: string): string {
    return `${this.apiUrl}/${facilityId}/schedule`;
  }

  // ── tetri ↔ GEL conversion (the price representation edge) ──────────────────

  /** GEL decimal → integer tetri (rounded). e.g. 25.5 → 2550. */
  static gelToTetri(gel: number): number {
    return Math.round((Number(gel) || 0) * 100);
  }

  /** Integer tetri → GEL decimal. e.g. 2550 → 25.5. */
  static tetriToGel(tetri: number): number {
    return (Number(tetri) || 0) / 100;
  }

  // ── reads ───────────────────────────────────────────────────────────────────

  /**
   * GET /facilities/:facilityId/schedule — returns the doc, or the server's
   * default shape (09:00–22:00 all days, zeroed pricing) if none exists.
   */
  getSchedule(facilityId: string): Observable<FacilityScheduleDTO> {
    return this.http
      .get<ApiResponse<FacilityScheduleDTO>>(this.scheduleUrl(facilityId))
      .pipe(map((res) => res.result.data));
  }

  // ── writes ────────────────────────────────────────────────────────────────

  /** PUT /facilities/:facilityId/schedule — upsert weekly hours (+ optional meta). */
  updateWeeklyHours(
    facilityId: string,
    weeklyHours: WeeklyHoursDTO,
    meta?: { timezone?: string; slotDurationMinutes?: number },
  ): Observable<FacilityScheduleDTO> {
    const body: UpdateScheduleDTO = { weeklyHours, ...meta };
    return this.http
      .put<ApiResponse<FacilityScheduleDTO>>(this.scheduleUrl(facilityId), body)
      .pipe(map((res) => res.result.data));
  }

  /** PATCH /facilities/:facilityId/schedule/pricing — pricing only (tetri on wire). */
  updatePricing(facilityId: string, pricing: PricingDTO): Observable<FacilityScheduleDTO> {
    return this.http
      .patch<ApiResponse<FacilityScheduleDTO>>(`${this.scheduleUrl(facilityId)}/pricing`, pricing)
      .pipe(map((res) => res.result.data));
  }

  /** POST /facilities/:facilityId/schedule/holidays — add a holiday subdocument. */
  addHoliday(facilityId: string, holiday: HolidayDTO): Observable<FacilityScheduleDTO> {
    return this.http
      .post<ApiResponse<FacilityScheduleDTO>>(`${this.scheduleUrl(facilityId)}/holidays`, holiday)
      .pipe(map((res) => res.result.data));
  }

  /**
   * PUT /facilities/:facilityId/schedule/holidays/:holidayId — address by server _id.
   *
   * @remarks Unused until the holiday-editing UI ships (planned with per-day hours
   * editing); do not remove.
   */
  updateHoliday(
    facilityId: string,
    holidayId: string,
    holiday: HolidayDTO,
  ): Observable<FacilityScheduleDTO> {
    return this.http
      .put<ApiResponse<FacilityScheduleDTO>>(
        `${this.scheduleUrl(facilityId)}/holidays/${holidayId}`,
        holiday,
      )
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /facilities/:facilityId/schedule/holidays/:holidayId — address by server _id. */
  deleteHoliday(facilityId: string, holidayId: string): Observable<FacilityScheduleDTO> {
    return this.http
      .delete<ApiResponse<FacilityScheduleDTO>>(
        `${this.scheduleUrl(facilityId)}/holidays/${holidayId}`,
      )
      .pipe(map((res) => res.result.data));
  }
}
