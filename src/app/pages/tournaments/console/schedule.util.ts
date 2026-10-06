/**
 * Schedule helpers for the «განრიგი» step (docs/33 §3 scheduler, §5 routes):
 * facility wall clock ↔ instants, the default sessions of an auto-schedule,
 * and the time × court GRID of the scheduled matches. Pure.
 *
 * Single-timezone MVP (API `TOURNAMENT_TIMEZONE = 'Asia/Tbilisi'`): Georgia
 * keeps UTC+4 all year (no DST since 2005), so the wall clock is a fixed
 * offset — the grid reads the same on any operator's machine.
 */
import {
  MATCH_MINUTES_MAX,
  MATCH_MINUTES_MIN,
  MatchView,
  ScheduleSessionDto,
  TournamentStructure,
} from '../../../shared/models/tournament-engine.model';

export const TOURNAMENT_UTC_OFFSET_MINUTES = 240;

/** The default session length of an auto-schedule (8 hours from the start). */
export const DEFAULT_SESSION_MINUTES = 8 * 60;

const pad = (n: number): string => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' + 'HH:mm' (facility wall clock) → ISO instant. */
export function wallClockToIso(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const utc = Date.UTC(y, m - 1, d, hh, mm) - TOURNAMENT_UTC_OFFSET_MINUTES * 60_000;
  return new Date(utc).toISOString();
}

/** ISO instant → facility wall clock { date: 'YYYY-MM-DD', time: 'HH:mm' }. */
export function isoToWallClock(iso: string): { date: string; time: string } {
  const shifted = new Date(Date.parse(iso) + TOURNAMENT_UTC_OFFSET_MINUTES * 60_000);
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
  };
}

/** 'HH:mm' → minutes after midnight (NaN when malformed). */
export function toMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
}

/** Minutes after midnight → 'HH:mm', capped at 23:59 (a session never crosses midnight). */
export function fromMinutes(minutes: number): string {
  const capped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${pad(Math.floor(capped / 60))}:${pad(capped % 60)}`;
}

/** One session: the tournament's start day, from its start time for 8 hours. */
export function defaultSessions(startDate: string, startTime: string): ScheduleSessionDto[] {
  const from = toMinutes(startTime);
  const start = Number.isNaN(from) ? 10 * 60 : from;
  return [
    {
      date: startDate,
      from: fromMinutes(start),
      to: fromMinutes(start + DEFAULT_SESSION_MINUTES),
    },
  ];
}

/** Slot length: a sets match ≈ 45 minutes, a points game ≈ 15. */
export function defaultMatchMinutes(structure: TournamentStructure | null | undefined): number {
  return structure?.scoring?.type === 'points' ? 15 : 45;
}

/** RAW-Georgian problem of the sessions / slot length, or null. */
export function sessionsError(sessions: ScheduleSessionDto[], matchMinutes: number): string | null {
  if (!sessions.length) return 'დაამატეთ ერთი სესია მაინც';
  for (const session of sessions) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date)) return 'მიუთითეთ სესიის თარიღი';
    const from = toMinutes(session.from);
    const to = toMinutes(session.to);
    if (Number.isNaN(from) || Number.isNaN(to)) return 'მიუთითეთ სესიის დასაწყისი და დასასრული';
    if (to - from < matchMinutes) return 'სესიაში ერთი მატჩიც ვერ ეტევა';
  }
  if (
    !Number.isInteger(matchMinutes) ||
    matchMinutes < MATCH_MINUTES_MIN ||
    matchMinutes > MATCH_MINUTES_MAX
  ) {
    return 'მატჩის ხანგრძლივობა — 10-დან 240 წუთამდე';
  }
  return null;
}

// ─── The grid ─────────────────────────────────────────────────────────────────

export interface ScheduleRow {
  /** The slot's instant (ISO). */
  at: string;
  /** 'HH:mm' wall clock. */
  time: string;
  /** One list per court column (several = a clash the organizer should fix). */
  cells: MatchView[][];
}

export interface ScheduleDay {
  /** 'YYYY-MM-DD' wall clock. */
  date: string;
  rows: ScheduleRow[];
}

export interface ScheduleGrid {
  /** Column headers in order; '' = scheduled without a court. */
  courts: string[];
  days: ScheduleDay[];
  /** Matches without a time. */
  unscheduled: MatchView[];
}

/**
 * Rows = slot times grouped by day, columns = the courts in use (the
 * facility's court order first, then any free-text court A→Z, then "no
 * court"), cell = the matches at that time on that court.
 */
export function buildScheduleGrid(matches: MatchView[], courtOrder: string[] = []): ScheduleGrid {
  const scheduled = matches.filter((m) => !!m.scheduledAt);
  const unscheduled = matches.filter((m) => !m.scheduledAt);

  const used = [...new Set(scheduled.map((m) => m.court?.trim() ?? ''))];
  const rank = (court: string): number => {
    if (!court) return Number.MAX_SAFE_INTEGER;
    const index = courtOrder.indexOf(court);
    return index === -1 ? courtOrder.length : index;
  };
  const courts = used.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const column = new Map(courts.map((court, i) => [court, i]));

  const byInstant = new Map<number, MatchView[]>();
  for (const match of scheduled) {
    const at = Date.parse(match.scheduledAt as string);
    byInstant.set(at, [...(byInstant.get(at) ?? []), match]);
  }

  const days: ScheduleDay[] = [];
  for (const at of [...byInstant.keys()].sort((a, b) => a - b)) {
    const iso = new Date(at).toISOString();
    const { date, time } = isoToWallClock(iso);
    const cells: MatchView[][] = courts.map(() => []);
    for (const match of byInstant.get(at) ?? []) {
      cells[column.get(match.court?.trim() ?? '') ?? 0].push(match);
    }
    let day = days[days.length - 1];
    if (!day || day.date !== date) {
      day = { date, rows: [] };
      days.push(day);
    }
    day.rows.push({ at: iso, time, cells });
  }
  return { courts, days, unscheduled };
}

/** "18.10" — the day header of the grid. */
export function shortDay(date: string): string {
  const [, m, d] = date.split('-');
  return d && m ? `${d}.${m}` : date;
}
