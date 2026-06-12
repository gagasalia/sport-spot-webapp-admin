import { AvailabilityByCourt, Booking } from '../../shared/models/booking.model';

/**
 * Pure grid-building logic for the operator calendar (Phase 4, design §5).
 *
 * Kept as a standalone, dependency-free module so the slot×court matrix
 * derivation is exhaustively unit-testable in isolation from Angular. The day
 * view consumes {@link buildDayGrid}; the week view reuses {@link buildSlotRows}
 * + {@link cellFor} per day column.
 */

/** A court column in the day grid (active courts of the selected facility). */
export interface GridCourt {
  id: string;
  courtNumber: number;
  label: string;
}

/**
 * What a single grid cell represents.
 * - `free`    — bookable: availability offers this slot for this court/day.
 * - `booking` — an active customer reservation occupies the slot.
 * - `block`   — an operator block occupies the slot.
 * - `closed`  — the slot row exists in the grid (some other court/day offers it)
 *               but this court/day has no such availability slot and no booking,
 *               so it must render greyed and non-clickable (not a phantom free cell).
 */
export type CellKind = 'booking' | 'block' | 'free' | 'closed';

/**
 * One cell in the calendar grid. `free` cells carry the slot price (tetri) so the
 * UI can render it; `booking`/`block` cells carry the underlying document.
 */
export interface GridCell {
  kind: CellKind;
  courtId: string;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  /** Present on free cells (price snapshot for this slot, in tetri). */
  priceTetri?: number;
  /** Present on booking/block cells. */
  booking?: Booking;
}

/** A row in the day grid: one slot start across every court column. */
export interface GridRow {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  cells: GridCell[]; // one per court, column-aligned
}

/** The full day grid: ordered court columns + ordered slot rows. */
export interface DayGrid {
  courts: GridCourt[];
  rows: GridRow[];
}

/**
 * "HH:mm" → minutes since midnight. Throws on malformed input rather than
 * silently coercing to 0, so ragged/garbage slot data fails loudly at the source
 * instead of corrupting the row ordering.
 */
export function hhmmToMinutes(hhmm: string): number {
  const parts = (hhmm ?? '').split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (parts.length !== 2 || !Number.isFinite(h) || !Number.isFinite(m)) {
    throw new Error(`hhmmToMinutes: invalid "HH:mm" input: ${JSON.stringify(hhmm)}`);
  }
  return h * 60 + m;
}

/** Slot rows are sorted by start; an `end` accompanies each for display/overlap. */
export interface SlotRow {
  start: string;
  end: string;
}

/**
 * Derive the facility's distinct slot grid (the row axis) from the availability
 * response **and** the confirmed bookings/blocks. A slot can be present in either
 * source — free slots come from availability, taken slots only appear in bookings
 * (the backend drops taken slots from availability) — so the union is required to
 * avoid losing rows for fully-booked time bands.
 *
 * Edge handling:
 * - de-duplicates by `start` (a slot is one row regardless of how many courts share it),
 * - keeps the longest `end` seen for a given start (defensive against ragged data),
 * - sorts ascending by start-of-day minutes.
 */
export function buildSlotRows(
  availability: AvailabilityByCourt,
  bookings: Booking[],
): SlotRow[] {
  const byStart = new Map<string, SlotRow>();

  const consider = (start: string, end: string): void => {
    if (!start || !end) return;
    const existing = byStart.get(start);
    if (!existing) {
      byStart.set(start, { start, end });
    } else if (hhmmToMinutes(end) > hhmmToMinutes(existing.end)) {
      existing.end = end;
    }
  };

  for (const slots of Object.values(availability ?? {})) {
    for (const slot of slots ?? []) {
      consider(slot.start, slot.end);
    }
  }
  for (const b of bookings ?? []) {
    consider(b.start, b.end);
  }

  return [...byStart.values()].sort((a, b) => hhmmToMinutes(a.start) - hhmmToMinutes(b.start));
}

/**
 * Index active bookings/blocks by `court|start` for O(1) cell lookup.
 *
 * Only `cancelled` docs are skipped (a cancelled slot is free again). `confirmed`
 * **and** `completed` bookings both occupy their slot — a completed booking must
 * still render as a booking cell, not a free clickable one. If two active docs
 * collide on the same key (shouldn't happen given the backend's partial unique
 * index), the first wins deterministically.
 */
export function indexBookings(bookings: Booking[]): Map<string, Booking> {
  const map = new Map<string, Booking>();
  for (const b of bookings ?? []) {
    if (b.status === 'cancelled') continue;
    const key = `${b.court}|${b.start}`;
    if (!map.has(key)) map.set(key, b);
  }
  return map;
}

/**
 * Resolve the cell for a given court + slot: an active booking/block if one
 * occupies the slot, otherwise a free cell carrying the availability price (when
 * the slot is actually offered for that court). If a slot is neither booked nor
 * in availability for this court (e.g. a time band that exists for another court
 * or day but is outside this one's open hours), it is a `closed` cell — rendered
 * greyed and non-clickable rather than as a phantom free/clickable slot.
 */
export function cellFor(
  courtId: string,
  slot: SlotRow,
  bookingIndex: Map<string, Booking>,
  availability: AvailabilityByCourt,
): GridCell {
  const booking = bookingIndex.get(`${courtId}|${slot.start}`);
  if (booking) {
    return {
      kind: booking.type === 'block' ? 'block' : 'booking',
      courtId,
      start: slot.start,
      end: booking.end || slot.end,
      booking,
    };
  }

  const free = (availability?.[courtId] ?? []).find((s) => s.start === slot.start);
  if (!free) {
    return { kind: 'closed', courtId, start: slot.start, end: slot.end };
  }
  return {
    kind: 'free',
    courtId,
    start: slot.start,
    end: free.end,
    priceTetri: free.priceTetri,
  };
}

/**
 * Build the full day grid (column-aligned matrix of cells) for the day view.
 * `courts` is the ordered list of active court columns; only their availability
 * and bookings are considered for the cell axis, but slot rows are derived from
 * the full availability/bookings union so no time band is dropped.
 */
export function buildDayGrid(
  courts: GridCourt[],
  availability: AvailabilityByCourt,
  bookings: Booking[],
): DayGrid {
  const rows = buildSlotRows(availability, bookings);
  const bookingIndex = indexBookings(bookings);

  const gridRows: GridRow[] = rows.map((slot) => ({
    start: slot.start,
    end: slot.end,
    cells: courts.map((court) => cellFor(court.id, slot, bookingIndex, availability)),
  }));

  return { courts, rows: gridRows };
}

/**
 * Build a one-court × 7-days grid for the week view. `days` is the ordered list
 * of "YYYY-MM-DD" strings; each entry carries that day's availability + bookings.
 * Slot rows are the union across all seven days so a row exists if any day offers
 * or has a booking at that start.
 */
export interface WeekDayData {
  date: string; // "YYYY-MM-DD"
  availability: AvailabilityByCourt;
  bookings: Booking[];
}

export interface WeekRow {
  start: string;
  end: string;
  cells: (GridCell & { date: string })[]; // one per day column
}

export interface WeekGrid {
  days: string[];
  rows: WeekRow[];
}

export function buildWeekGrid(courtId: string, days: WeekDayData[]): WeekGrid {
  // Union of slot rows across the whole week.
  const merged: AvailabilityByCourt = {};
  const allBookings: Booking[] = [];
  for (const day of days) {
    for (const [cId, slots] of Object.entries(day.availability ?? {})) {
      merged[`${day.date}|${cId}`] = slots;
    }
    allBookings.push(...(day.bookings ?? []));
  }
  const rows = buildSlotRows(merged, allBookings);

  const weekRows: WeekRow[] = rows.map((slot) => ({
    start: slot.start,
    end: slot.end,
    cells: days.map((day) => {
      const index = indexBookings(day.bookings);
      const cell = cellFor(courtId, slot, index, day.availability);
      return { ...cell, date: day.date };
    }),
  }));

  return { days: days.map((d) => d.date), rows: weekRows };
}
