import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import {
  AvailabilityByCourt,
  AvailabilityResponse,
  Booking,
  BookingQuery,
  CreateBlockDto,
  CreateBookingDto,
} from '../../shared/models/booking.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';

/** Paginated list result for the calendar list-view tab. */
export interface BookingsPage {
  data: Booking[];
  page?: ApiPage;
}

/**
 * HTTP service for the booking domain (Phase 4). Two URL families:
 *
 * - facility-scoped reads/creates: `/facilities/:facilityId/{availability,bookings}`
 * - booking-scoped mutations:      `/bookings/:id/{cancel,payment}`
 *
 * Prices cross the wire as integer **tetri**; conversion to GEL happens in the
 * components via `ScheduleService.tetriToGel` (the shared Phase 3 helper).
 */
@Injectable({
  providedIn: 'root',
})
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly facilitiesUrl = `${environment.apiUrl}/facilities`;
  private readonly bookingsUrl = `${environment.apiUrl}/bookings`;

  private facilityScoped(facilityId: string, resource: string): string {
    return `${this.facilitiesUrl}/${facilityId}/${resource}`;
  }

  /**
   * GET /facilities/:facilityId/availability?date= — per-court free slots for a day.
   *
   * The wire shape is `{ date, timezone, slotDurationMinutes, courts: [{ courtId,
   * courtNumber, slots }] }` (inside the `ApiResponse` envelope). We flatten the
   * `courts` array into the internal `{ [courtId]: AvailabilitySlot[] }` map so
   * the grid builders can do O(1) per-court slot lookups.
   */
  getAvailability(facilityId: string, date: string): Observable<AvailabilityByCourt> {
    const params = new HttpParams().set('date', date);
    return this.http
      .get<ApiResponse<AvailabilityResponse>>(this.facilityScoped(facilityId, 'availability'), {
        params,
      })
      .pipe(map((res) => this.toAvailabilityMap(res.result.data)));
  }

  /** Flatten the availability response's `courts` array into a court-id → slots map. */
  private toAvailabilityMap(data?: AvailabilityResponse): AvailabilityByCourt {
    const map: AvailabilityByCourt = {};
    for (const court of data?.courts ?? []) {
      if (court?.courtId) map[court.courtId] = court.slots ?? [];
    }
    return map;
  }

  /**
   * GET /facilities/:facilityId/bookings — calendar + list reads.
   * Pass `date` for a single-day calendar fetch, or `from`/`to` for the list view.
   */
  getBookings(facilityId: string, query: BookingQuery = {}): Observable<BookingsPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http
      .get<ApiResponse<Booking[]>>(this.facilityScoped(facilityId, 'bookings'), { params })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }

  /**
   * POST /facilities/:facilityId/bookings — operator manual booking.
   * A 409 means the slot was taken concurrently; the generic error toast is
   * suppressed so the caller can show the Georgian "slot already taken" message.
   */
  createBooking(facilityId: string, dto: CreateBookingDto): Observable<Booking> {
    return this.http
      .post<ApiResponse<Booking>>(this.facilityScoped(facilityId, 'bookings'), dto, {
        context: new HttpContext().set(SKIP_ERROR_TOAST, true),
      })
      .pipe(map((res) => res.result.data));
  }

  /**
   * POST /facilities/:facilityId/bookings — operator block (expanded server-side
   * into N single-slot docs for a multi-slot block). 409 handled like createBooking.
   */
  createBlock(facilityId: string, dto: CreateBlockDto): Observable<Booking | Booking[]> {
    return this.http
      .post<ApiResponse<Booking | Booking[]>>(this.facilityScoped(facilityId, 'bookings'), dto, {
        context: new HttpContext().set(SKIP_ERROR_TOAST, true),
      })
      .pipe(map((res) => res.result.data));
  }

  /** PATCH /bookings/:id/cancel — operators cancel anytime (status → cancelled). */
  cancelBooking(bookingId: string): Observable<Booking> {
    return this.http
      .patch<ApiResponse<Booking>>(`${this.bookingsUrl}/${bookingId}/cancel`, {})
      .pipe(map((res) => res.result.data));
  }

  /** PATCH /bookings/:id/payment { paymentStatus: 'paid' } — mark paid at venue. */
  markPaid(bookingId: string): Observable<Booking> {
    return this.http
      .patch<ApiResponse<Booking>>(`${this.bookingsUrl}/${bookingId}/payment`, {
        paymentStatus: 'paid',
      })
      .pipe(map((res) => res.result.data));
  }
}
