import { Booking } from '../../shared/models/booking.model';
import {
  FacilityScheduleDTO,
  HolidayDTO,
  PricingDTO,
  TimeRangeDTO,
} from '../../shared/models/schedule.model';

/**
 * Pure grid-building logic for the operator calendar.
 *
 * v2: the grid is a true **30-minute cell matrix** derived from the facility
 * SCHEDULE (weekly hours, holidays, pricing) plus the day's bookings — the
 * availability endpoint is no longer used (its windows are duration-sized and
 * cannot express partial gaps). A booking/block spanning N cells is ONE grid
 * cell with `span = N` (rendered via rowspan); the covered rows carry
 * `covered: true` markers so the template skips them. The rules mirror the
 * backend's `availability.core.ts` exactly: Monday=0 weekdays, holiday
 * isClosed/timeRanges (isRecurring matches MM-DD), past starts (`start <= now`)
 * dropped for today, per-cell pricing at half the applicable hourly rate.
 */

/** One 30-minute grid step (same as the backend's GRID_STEP_MINUTES). */
export const CELL_MINUTES = 30;

/** Durations (minutes) the backend accepts for a type=booking document. */
export const BOOKING_DURATIONS = [60, 90, 120] as const;

/** A court column in the day grid (active courts of the selected facility). */
export interface GridCourt {
  id: string;
  /** Georgian court name (the column label is derived from it). */
  name: string;
  label: string;
}

/**
 * What a single grid cell represents.
 * - `free`    — bookable 30-min cell inside open hours.
 * - `booking` — a customer/operator reservation occupies it (span ≥ 1).
 * - `block`   — an operator block occupies it (span ≥ 1; blockGroupId merged).
 * - `past`    — inside open hours but its start is now-or-earlier today.
 * - `closed`  — outside the facility's open hours for that day.
 */
export type CellKind = 'booking' | 'block' | 'free' | 'past' | 'closed';

export interface GridCell {
  kind: CellKind;
  courtId: string;
  date: string; // "YYYY-MM-DD" the cell belongs to
  start: string; // "HH:mm" — this cell's (or merged span's) start
  end: string; // "HH:mm" — cell end; for merged booking/block cells the SPAN end
  /** Rows this cell visually covers (rowspan). 1 for plain cells. */
  span: number;
  /** True → this row position is covered by a spanning cell above; skip it. */
  covered: boolean;
  /** Present on free cells: this 30-min cell's price (half the hourly rate). */
  priceTetri?: number;
  /** Present on booking/block cells (the FIRST doc of a merged block group). */
  booking?: Booking;
  /** Booking made by a player (has `user`) vs operator-made. */
  byUser?: boolean;
}

/** A row in the grid: one 30-min slot start across every column. */
export interface GridRow {
  start: string; // "HH:mm"
  end: string; // "HH:mm" (start + 30)
  cells: GridCell[]; // one per column, column-aligned
}

export interface DayGrid {
  courts: GridCourt[];
  rows: GridRow[];
}

/** Week view input: one court, seven days of bookings. */
export interface WeekDayData {
  date: string; // "YYYY-MM-DD"
  bookings: Booking[];
}

export interface WeekRow {
  start: string;
  end: string;
  cells: GridCell[]; // one per day column (cell.date identifies the column)
}

export interface WeekGrid {
  days: string[];
  rows: WeekRow[];
}

// ─── time helpers ─────────────────────────────────────────────────────────────

/**
 * "HH:mm" → minutes since midnight. Throws on malformed input rather than
 * silently coercing to 0, so garbage slot data fails loudly at the source.
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

/** Minutes since midnight → "HH:mm". */
export function minutesToHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Monday=0 weekday of a "YYYY-MM-DD" date (computed in UTC — no tz drift). */
export function mondayWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // Sunday = 0
  return (jsDay + 6) % 7;
}

interface MinuteRange {
  start: number;
  end: number; // exclusive
}

/** True when the holiday applies to `date` (exact match, or MM-DD if recurring). */
export function holidayApplies(holiday: HolidayDTO, date: string): boolean {
  if (holiday.isRecurring) {
    return holiday.date.slice(5) === date.slice(5);
  }
  return holiday.date === date;
}

/** Subtract `closed` ranges from `open` ranges (half-open [start, end)). */
function subtractRanges(open: MinuteRange[], closed: MinuteRange[]): MinuteRange[] {
  let result = open
    .filter((r) => r.end > r.start)
    .map((r) => ({ ...r }))
    .sort((a, b) => a.start - b.start);

  for (const block of closed) {
    if (block.end <= block.start) continue;
    const next: MinuteRange[] = [];
    for (const r of result) {
      if (block.end <= r.start || block.start >= r.end) {
        next.push(r);
        continue;
      }
      if (block.start > r.start) next.push({ start: r.start, end: block.start });
      if (block.end < r.end) next.push({ start: block.end, end: r.end });
    }
    result = next;
  }
  return result.sort((a, b) => a.start - b.start);
}

/**
 * The facility's open minute-ranges for a date: weeklyHours[Monday=0 weekday]
 * minus applicable holidays (isClosed wipes the day; timeRanges are subtracted
 * — the backend's `applyHolidays` semantics).
 */
export function openRangesFor(date: string, schedule: FacilityScheduleDTO): MinuteRange[] {
  const weekday = mondayWeekday(date);
  // JSON object keys arrive as strings; tolerate both string and number keys.
  const hours = schedule.weeklyHours ?? ({} as Record<string, TimeRangeDTO[]>);
  const ranges: TimeRangeDTO[] =
    (hours as Record<string, TimeRangeDTO[]>)[String(weekday)] ??
    (hours as Record<number, TimeRangeDTO[]>)[weekday] ??
    [];

  const open = ranges.map((r) => ({
    start: hhmmToMinutes(r.start),
    end: hhmmToMinutes(r.end),
  }));

  const applicable = (schedule.holidays ?? []).filter((h) => holidayApplies(h, date));
  if (applicable.some((h) => h.isClosed)) return [];

  const closed: MinuteRange[] = [];
  for (const h of applicable) {
    for (const r of h.timeRanges ?? []) {
      closed.push({ start: hhmmToMinutes(r.start), end: hhmmToMinutes(r.end) });
    }
  }
  return subtractRanges(open, closed);
}

/**
 * Price of the 30-min cell starting at `cellStartMin`: half the hourly rate,
 * off-peak when the CELL's start falls inside the off-peak window (half-open) —
 * the backend's per-cell pricing rule.
 */
export function cellPriceTetri(cellStartMin: number, pricing?: PricingDTO): number {
  if (!pricing) return 0;
  const off = pricing.offPeak;
  const hourly =
    off && cellStartMin >= hhmmToMinutes(off.start) && cellStartMin < hhmmToMinutes(off.end)
      ? off.priceTetri
      : pricing.generalPriceTetri;
  return Math.round((hourly || 0) / 2);
}

/**
 * Total price of a contiguous [startMin, endMin) window: halves summed first,
 * rounded ONCE at the total (mirrors the backend's `priceForWindow`).
 */
export function priceForWindow(startMin: number, endMin: number, pricing?: PricingDTO): number {
  if (!pricing) return 0;
  const off = pricing.offPeak;
  let sum = 0;
  for (let cell = startMin; cell < endMin; cell += CELL_MINUTES) {
    const hourly =
      off && cell >= hhmmToMinutes(off.start) && cell < hhmmToMinutes(off.end)
        ? off.priceTetri
        : pricing.generalPriceTetri;
    sum += (hourly || 0) / 2;
  }
  return Math.round(sum);
}

// ─── occupations (bookings/blocks painted onto the cell axis) ────────────────

/**
 * One painted occupation: a booking, or a run of adjacent block docs sharing a
 * blockGroupId merged into a single visual unit.
 */
export interface Occupation {
  startMin: number;
  endMin: number; // exclusive
  booking: Booking; // the (first) underlying doc
  isBlock: boolean;
  byUser: boolean;
}

/**
 * Active bookings/blocks of ONE court+day → sorted, merged occupations.
 * Cancelled docs are skipped (their cells are free again); completed bookings
 * still occupy (they must render as bookings, not free cells). Adjacent block
 * docs with the same blockGroupId merge into one occupation so a multi-slot
 * block reads as a single unit.
 */
export function buildOccupations(bookings: Booking[]): Occupation[] {
  const active = (bookings ?? [])
    .filter((b) => b.status !== 'cancelled')
    .map((b) => ({
      startMin: hhmmToMinutes(b.start),
      endMin: hhmmToMinutes(b.end),
      booking: b,
      isBlock: b.type === 'block',
      byUser: !!b.user,
    }))
    .filter((o) => o.endMin > o.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  const merged: Occupation[] = [];
  for (const occ of active) {
    const prev = merged[merged.length - 1];
    const sameGroup =
      prev &&
      prev.isBlock &&
      occ.isBlock &&
      !!prev.booking.blockGroupId &&
      prev.booking.blockGroupId === occ.booking.blockGroupId &&
      prev.endMin === occ.startMin;
    if (sameGroup) {
      prev.endMin = occ.endMin;
    } else {
      merged.push(occ);
    }
  }
  return merged;
}

// ─── grid assembly ────────────────────────────────────────────────────────────

/** Adds every 30-min cell start of [startMin, endMin) to the set. */
function collectCells(startMin: number, endMin: number, into: Set<number>): void {
  for (let m = startMin; m < endMin; m += CELL_MINUTES) into.add(m);
}

/**
 * Resolve the column of cells for one court+day along a given row axis.
 * `rowStarts` MUST contain every cell of every occupation passed in (the row
 * axis is built as that union), so spans are always contiguous rows.
 */
function columnCells(
  courtId: string,
  date: string,
  rowStarts: number[],
  occupations: Occupation[],
  open: MinuteRange[],
  pricing: PricingDTO | undefined,
  nowMinutes?: number,
): Map<number, GridCell> {
  const cells = new Map<number, GridCell>();

  for (const m of rowStarts) {
    const occ = occupations.find((o) => o.startMin <= m && m < o.endMin);
    if (occ) {
      if (occ.startMin === m) {
        cells.set(m, {
          kind: occ.isBlock ? 'block' : 'booking',
          courtId,
          date,
          start: minutesToHHmm(occ.startMin),
          end: minutesToHHmm(occ.endMin),
          span: Math.max(1, Math.ceil((occ.endMin - occ.startMin) / CELL_MINUTES)),
          covered: false,
          booking: occ.booking,
          byUser: occ.byUser,
        });
      } else {
        cells.set(m, {
          kind: occ.isBlock ? 'block' : 'booking',
          courtId,
          date,
          start: minutesToHHmm(m),
          end: minutesToHHmm(m + CELL_MINUTES),
          span: 1,
          covered: true,
          booking: occ.booking,
          byUser: occ.byUser,
        });
      }
      continue;
    }

    const isOpen = open.some((r) => m >= r.start && m + CELL_MINUTES <= r.end);
    if (!isOpen) {
      cells.set(m, {
        kind: 'closed',
        courtId,
        date,
        start: minutesToHHmm(m),
        end: minutesToHHmm(m + CELL_MINUTES),
        span: 1,
        covered: false,
      });
      continue;
    }

    // The backend drops starts at-or-before "now" for today (start <= now).
    if (nowMinutes !== undefined && m <= nowMinutes) {
      cells.set(m, {
        kind: 'past',
        courtId,
        date,
        start: minutesToHHmm(m),
        end: minutesToHHmm(m + CELL_MINUTES),
        span: 1,
        covered: false,
      });
      continue;
    }

    cells.set(m, {
      kind: 'free',
      courtId,
      date,
      start: minutesToHHmm(m),
      end: minutesToHHmm(m + CELL_MINUTES),
      span: 1,
      covered: false,
      priceTetri: cellPriceTetri(m, pricing),
    });
  }

  return cells;
}

/**
 * Build the day grid: active courts × the facility's 30-min cell axis. The row
 * axis is the union of open-hour cells and every occupation's cells (a booking
 * outside current hours still renders). `nowMinutes` is passed only when `date`
 * is today in facility time.
 */
export function buildDayGrid(
  courts: GridCourt[],
  date: string,
  schedule: FacilityScheduleDTO | null,
  bookings: Booking[],
  nowMinutes?: number,
): DayGrid {
  if (!schedule) return { courts, rows: [] };

  const open = openRangesFor(date, schedule);
  const starts = new Set<number>();
  for (const r of open) collectCells(r.start, r.end, starts);

  const byCourt = new Map<string, Occupation[]>();
  for (const court of courts) {
    const occ = buildOccupations(bookings.filter((b) => b.court === court.id));
    byCourt.set(court.id, occ);
    for (const o of occ) collectCells(o.startMin, o.endMin, starts);
  }

  const rowStarts = [...starts].sort((a, b) => a - b);
  const columns = new Map<string, Map<number, GridCell>>();
  for (const court of courts) {
    columns.set(
      court.id,
      columnCells(
        court.id,
        date,
        rowStarts,
        byCourt.get(court.id) ?? [],
        open,
        schedule.pricing,
        nowMinutes,
      ),
    );
  }

  const rows: GridRow[] = rowStarts.map((m) => ({
    start: minutesToHHmm(m),
    end: minutesToHHmm(m + CELL_MINUTES),
    cells: courts.map((c) => columns.get(c.id)!.get(m)!),
  }));

  return { courts, rows };
}

/**
 * Build the week grid: ONE court × 7 day columns. The row axis is the union of
 * open cells and occupation cells across the whole week. `todayIso` +
 * `nowMinutes` mark past cells in today's column only.
 */
export function buildWeekGrid(
  courtId: string,
  days: WeekDayData[],
  schedule: FacilityScheduleDTO | null,
  todayIso?: string,
  nowMinutes?: number,
): WeekGrid {
  if (!schedule || days.length === 0) return { days: [], rows: [] };

  const starts = new Set<number>();
  const perDay = days.map((day) => {
    const open = openRangesFor(day.date, schedule);
    for (const r of open) collectCells(r.start, r.end, starts);
    const occupations = buildOccupations(
      (day.bookings ?? []).filter((b) => b.court === courtId),
    );
    for (const o of occupations) collectCells(o.startMin, o.endMin, starts);
    return { date: day.date, open, occupations };
  });

  const rowStarts = [...starts].sort((a, b) => a - b);
  const columns = perDay.map((day) =>
    columnCells(
      courtId,
      day.date,
      rowStarts,
      day.occupations,
      day.open,
      schedule.pricing,
      day.date === todayIso ? nowMinutes : undefined,
    ),
  );

  const rows: WeekRow[] = rowStarts.map((m) => ({
    start: minutesToHHmm(m),
    end: minutesToHHmm(m + CELL_MINUTES),
    cells: columns.map((col) => col.get(m)!),
  }));

  return { days: days.map((d) => d.date), rows };
}

// ─── multi-cell selection (pure state transitions) ───────────────────────────

/** Identity of one selectable free cell. */
export interface CellRef {
  courtId: string;
  date: string;
  start: string; // "HH:mm"
}

/** Current selection: contiguous 30-min cells on ONE court+date, sorted. */
export type Selection = CellRef[];

const sameCell = (a: CellRef, b: CellRef): boolean =>
  a.courtId === b.courtId && a.date === b.date && a.start === b.start;

/**
 * Toggle a free cell in/out of the selection:
 * - empty, different court/date, or non-adjacent → restart with just `cell`;
 * - adjacent to either end → extend;
 * - the first/last selected cell → shrink (deselect it);
 * - a selected middle cell → restart with just `cell`.
 */
export function toggleCell(selection: Selection, cell: CellRef): Selection {
  if (selection.length === 0) return [cell];

  const first = selection[0];
  const last = selection[selection.length - 1];
  const sameGroup = first.courtId === cell.courtId && first.date === cell.date;
  if (!sameGroup) return [cell];

  if (sameCell(cell, first) && sameCell(cell, last)) return []; // the only cell
  if (sameCell(cell, first)) return selection.slice(1);
  if (sameCell(cell, last)) return selection.slice(0, -1);
  if (selection.some((c) => sameCell(c, cell))) return [cell]; // middle → restart

  const m = hhmmToMinutes(cell.start);
  if (m === hhmmToMinutes(first.start) - CELL_MINUTES) return [cell, ...selection];
  if (m === hhmmToMinutes(last.start) + CELL_MINUTES) return [...selection, cell];
  return [cell];
}

/** Selected span in minutes (0 for an empty selection). */
export function selectionMinutes(selection: Selection): number {
  return selection.length * CELL_MINUTES;
}

/** Whether the span is a duration the backend accepts for type=booking. */
export function isBookableDuration(minutes: number): boolean {
  return (BOOKING_DURATIONS as readonly number[]).includes(minutes);
}

/**
 * Decompose a block span into create-request chunks the backend accepts: each
 * request carries a uniform slot `durationMinutes` (60/90/120) that divides its
 * chunk. Uniform spans go as ONE request (one blockGroupId → one visual unit);
 * non-uniform spans (span ≡ 30 mod 60, e.g. 150/210) split into a 90-min head
 * + a 60-divisible tail (two requests). Spans < 60 are not blockable.
 */
export interface BlockChunk {
  start: string;
  end: string;
  durationMinutes: number;
}

export function blockChunks(startMin: number, endMin: number): BlockChunk[] {
  const span = endMin - startMin;
  if (span < 60 || span % CELL_MINUTES !== 0) return [];

  const one = (s: number, e: number, d: number): BlockChunk => ({
    start: minutesToHHmm(s),
    end: minutesToHHmm(e),
    durationMinutes: d,
  });

  for (const unit of [120, 90, 60]) {
    if (span % unit === 0) return [one(startMin, endMin, unit)];
  }
  // span ≡ 30 (mod 60): 90 head, the rest divides by 60 (span-90 ≥ 60 here).
  return [one(startMin, startMin + 90, 90), one(startMin + 90, endMin, 60)];
}
