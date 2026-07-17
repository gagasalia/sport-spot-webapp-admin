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
 * Equipment snapshot frozen onto a player booking at create time: counts AND
 * unit prices as they were when the player booked, so the calendar renders
 * what was actually ordered/paid regardless of later rule edits.
 * `equipmentTetri` is the rent+sale subtotal included in `priceTetri`.
 */
export interface BookingEquipment {
  sportType: string;
  racketsIncluded: number; // "included in the court price" as of booking time
  racketsRented: number; // extra rackets rented by the player
  racketRentTetri?: number; // unit price; absent when nothing was rentable
  balls: number; // new-balls units bought
  ballsPriceTetri?: number; // unit price; absent when balls weren't sold
  equipmentTetri: number;
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
  user?: string; // ObjectId ref User (player bookings)
  customerName?: string; // manual (phone/walk-in) booking
  customerPhone?: string;
  priceTetri?: number; // required for type=booking; TOTAL incl. equipment (snapshot)
  equipment?: BookingEquipment; // player bookings with an applicable sport rule
  currency?: 'GEL';
  paymentStatus?: PaymentStatus;
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
  end?: string; // "HH:mm" — optional end slot for a multi-slot block
  note?: string;
}

/** Query params for GET /facilities/:facilityId/bookings (calendar + list reads). */
export interface BookingQuery {
  date?: string; // single-day (calendar)
  from?: string; // range start (list)
  to?: string; // range end (list)
  courtId?: string;
  status?: BookingStatus;
  type?: BookingType;
  page?: number;
  limit?: number;
}
