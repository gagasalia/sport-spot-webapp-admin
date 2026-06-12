import { TuiDay } from '@taiga-ui/cdk/date-time';

/**
 * Date helpers for the operator calendar. Dates are facility-local "YYYY-MM-DD"
 * wall-clock strings (conventions §2) — we deliberately avoid `Date`'s timezone
 * surprises by formatting/parsing the local Y-M-D directly.
 */

/** `TuiDay` → "YYYY-MM-DD" (facility-local date string). */
export function tuiDayToIso(day: TuiDay): string {
  const y = day.year;
  const m = (day.month + 1).toString().padStart(2, '0');
  const d = day.day.toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" → `TuiDay`. */
export function isoToTuiDay(iso: string): TuiDay {
  const [y, m, d] = iso.split('-').map(Number);
  return new TuiDay(y, m - 1, d);
}

/** Today's local date as "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Shift an ISO date by `days` (can be negative), returning a new ISO string. */
export function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const ny = dt.getUTCFullYear();
  const nm = (dt.getUTCMonth() + 1).toString().padStart(2, '0');
  const nd = dt.getUTCDate().toString().padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/**
 * The Monday-anchored week (7 ISO dates) containing `iso`. Conventions §1:
 * Monday = 0. Returns Monday … Sunday.
 */
export function weekDates(iso: string): string[] {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const jsDay = dt.getUTCDay(); // 0 = Sunday
  const mondayIndexed = (jsDay + 6) % 7; // 0 = Monday
  const monday = shiftIso(iso, -mondayIndexed);
  return Array.from({ length: 7 }, (_, i) => shiftIso(monday, i));
}
