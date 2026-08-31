/**
 * Booking domain models for the operator calendar (Phase 4).
 *
 * Mirrors the backend booking contract (see docs/10-booking-design.md §1):
 * a booking document occupies exactly one grid-aligned slot. Prices cross the
 * wire as integer **tetri** (1 GEL = 100 tetri); the UI converts at the edge
 * with `ScheduleService.tetriToGel`.
 */

/** A booking is a customer/player reservation; a block is an operator-made unbookable slot. */
export type BookingType = 'booking' | 'block';

/**
 * Populated player identity on operator booking reads (`user` is populated
 * server-side with a minimal projection so the calendar can show WHO booked
 * and link to /customers/:id). Manual bookings have no user at all.
 */
export interface BookingUserRef {
  _id: string;
  /** Public numeric member ID — absent on legacy docs until the API backfill. */
  memberId?: number;
  firstName?: string;
  lastName?: string;
  phone?: string;
  /** Profile picture (set by players in the player app). */
  avatarUrl?: string;
}

export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

export type PaymentStatus = 'pay_at_venue' | 'paid';

/**
 * One booking/block document as returned by
 * `GET /facilities/:facilityId/bookings`.
 *
 * The `court` field is a Mongo ObjectId string referencing the court; the
 * calendar groups bookings by `court` + `start` to place them in the grid.
 */
export interface Booking {
  _id: string;
  academy?: string;
  facility?: string;
  court: string; // ObjectId ref Court
  type: BookingType;
  date: string; // "YYYY-MM-DD" (facility-local)
  start: string; // "HH:mm" slot start
  end: string; // "HH:mm" slot end
  status: BookingStatus;
  /** Player bookings: populated identity on operator reads (see BookingUserRef). */
  user?: string | BookingUserRef;
  customerName?: string; // manual (phone/walk-in) booking
  customerPhone?: string;
  priceTetri?: number; // required for type=booking (snapshot)
  currency?: 'GEL';
  paymentStatus?: PaymentStatus;
  /**
   * Voluntary app-support tip left by the player at online payment. The API
   * includes these fields ONLY for superadmins — plain-admin responses omit
   * them, so the UI must also gate any tip display on `isSuperAdmin()`.
   */
  tipPercent?: number;
  tipTetri?: number;
  blockGroupId?: string; // groups a multi-slot block
  note?: string; // block reason / operator note
  createdAt?: string;
  updatedAt?: string;
}

/**
 * A single available slot for a court, from
 * `GET /facilities/:facilityId/availability?date=`. Free (bookable) slots only;
 * taken slots are absent from this list and present in the bookings response.
 */
export interface AvailabilitySlot {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  priceTetri: number; // price for this slot (off-peak resolved server-side)
}

/**
 * One court's availability inside the {@link AvailabilityResponse}: the court
 * identity plus its free slots for the requested day.
 */
export interface CourtAvailability {
  courtId: string;
  courtNumber: number;
  slots: AvailabilitySlot[];
}

/**
 * Raw availability response from `GET /facilities/:facilityId/availability?date=`
 * (inside the `ApiResponse` envelope). The backend returns a per-day descriptor
 * with an array of courts, each carrying its own free slots.
 */
export interface AvailabilityResponse {
  date: string; // "YYYY-MM-DD"
  timezone: string; // e.g. "Asia/Tbilisi"
  slotDurationMinutes: number;
  courts: CourtAvailability[];
}

/**
 * Internal per-court availability map keyed by court id (`{ [courtId]:
 * AvailabilitySlot[] }`). Derived from the {@link AvailabilityResponse} at the
 * service edge so the grid builders can do O(1) per-court slot lookups.
 */
export type AvailabilityByCourt = Record<string, AvailabilitySlot[]>;

/** Body for POST /facilities/:facilityId/bookings — operator manual booking. */
export interface CreateBookingDto {
  court: string;
  date: string; // "YYYY-MM-DD"
  start: string; // "HH:mm"
  /** 60 | 90 | 120; omitted → facility default duration. */
  durationMinutes?: number;
  customerName: string;
  customerPhone?: string;
  note?: string;
}

/** Body for POST /facilities/:facilityId/bookings — operator block (optionally multi-slot). */
export interface CreateBlockDto {
  type: 'block';
  court: string;
  date: string; // "YYYY-MM-DD"
  start: string; // "HH:mm"
  end?: string; // "HH:mm" — EXCLUSIVE end; span must divide by durationMinutes
  /** Slot size the block expands in (60 | 90 | 120); omitted → facility default. */
  durationMinutes?: number;
  note?: string;
}

/**
 * List-view sort orders (server-side; mirrors the API's BookingSort).
 * 'created' = reservation moment (createdAt), newest first — the default.
 * 'playing' = playing date with FUTURE slots on top (upcoming soonest-first,
 * then past most-recent-first).
 */
export type BookingSort = 'created' | 'playing';

/** Query params for GET /facilities/:facilityId/bookings (calendar + list reads). */
export interface BookingQuery {
  date?: string; // single-day (calendar)
  from?: string; // playing-date range start (list)
  to?: string; // playing-date range end (list)
  courtId?: string;
  status?: BookingStatus;
  type?: BookingType;
  /** Exact player id (list-view userId column filter). */
  userId?: string;
  /** Exact public member ID (list-view ID column filter; server drops leading zeros). */
  memberId?: number;
  /** Customer/player name search, case-insensitive (list-view user column filter). */
  customer?: string;
  /** Facility-local start hour 0–23 (list-view time column filter). */
  startHour?: number;
  /** Reservation-moment (createdAt) day range, "YYYY-MM-DD" inclusive. */
  createdFrom?: string;
  createdTo?: string;
  /** Price bounds in integer tetri, inclusive. */
  priceMinTetri?: number;
  priceMaxTetri?: number;
  /** Omitted = legacy {date, start} ascending (calendar/week reads). */
  sortBy?: BookingSort;
  page?: number;
  limit?: number;
}
