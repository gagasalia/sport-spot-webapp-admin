import { MAX_POINTS_PER_GAME, MAX_SETS_PER_GAME } from '../models/ranking.model';

/**
 * Client mirror of the API's score rules (sport-spot-api
 * `modules/ranking/engine/score-rules.ts`, docs/25 §4.1 "Score validation"),
 * so the results form flags an illegal row before the request. The server
 * stays the authority; its `invalid_set_score` message is surfaced when the
 * two ever disagree.
 *
 * Every message is RAW Georgian — callers render it through `| t` / `tr()`.
 */

/** One score row as typed: two numeric inputs, `null` while empty. */
export type ScoreCell = number | null | undefined;
export type ScoreRow = [ScoreCell, ScoreCell];

export const MSG_ROW_INCOMPLETE = 'შეიყვანეთ ორივე რიცხვი';
export const MSG_SET_ILLEGAL = 'დაუშვებელი სეტი — 6-0…6-4, 7-5 ან 7-6';
export const MSG_SET_ILLEGAL_DECIDER =
  'დაუშვებელი სეტი — 6-0…6-4, 7-5, 7-6 ან სუპერ ტაიბრეიკი 10-x';
export const MSG_TIEBREAK_PLACE = 'სუპერ ტაიბრეიკი მხოლოდ ბოლო, მესამე ან შემდეგი სეტია';
export const MSG_NO_SETS = 'შეიყვანეთ მინიმუმ ერთი სეტი';
export const MSG_TOO_MANY_SETS = 'თამაშში 1–5 სეტია';
export const MSG_UNFINISHED = 'თამაში დაუმთავრებელია — ერთმა მხარემ მეტი სეტი უნდა მოიგოს';
export const MSG_POINTS_RANGE = 'ქულები — მთელი რიცხვები 0-დან 64-მდე';
export const MSG_POINTS_ZERO = '0-0 შედეგად არ ჩაითვლება';

function isInt(n: ScoreCell): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

function isBlank(n: ScoreCell): boolean {
  return n === null || n === undefined || (typeof n === 'number' && Number.isNaN(n));
}

/** A legal padel set: 6-0 … 6-4, 7-5, 7-6, either way round. */
export function isStandardSet(a: ScoreCell, b: ScoreCell): boolean {
  if (!isInt(a) || !isInt(b) || a === b || a < 0 || b < 0) return false;
  const [w, l] = a > b ? [a, b] : [b, a];
  if (w === 6) return l <= 4;
  if (w === 7) return l === 5 || l === 6;
  return false;
}

/** A super tiebreak: 10-x with x ≤ 8, or win-by-two above ten (11-9, 12-10 …). */
export function isSuperTiebreak(a: ScoreCell, b: ScoreCell): boolean {
  if (!isInt(a) || !isInt(b) || a === b || a < 0 || b < 0) return false;
  const [w, l] = a > b ? [a, b] : [b, a];
  if (w === 10) return l <= 8;
  if (w > 10) return l === w - 2;
  return false;
}

export interface SetsCheck {
  /** Same indexes as the input rows; RAW Georgian or null. */
  rowErrors: (string | null)[];
  /** Whole-game problem (count, unfinished game); RAW Georgian or null. */
  gameError: string | null;
  /** What would be sent — trailing blank rows dropped. */
  sets: [number, number][];
  /** 0 = the first team won, 1 = the second; null while invalid. */
  winner: 0 | 1 | null;
  valid: boolean;
}

/**
 * Validates a sets score. Trailing fully-blank rows are ignored (the form
 * starts with spare rows); a blank row before a filled one is incomplete.
 * Rules: 1–5 sets; each set standard; a super tiebreak only as the LAST set
 * and only from the third set on; the winner must have more sets.
 */
export function checkSets(rows: readonly ScoreRow[]): SetsCheck {
  const rowErrors: (string | null)[] = rows.map(() => null);
  let used = rows.length;
  while (used > 0 && isBlank(rows[used - 1][0]) && isBlank(rows[used - 1][1])) {
    used--;
  }
  const fail = (gameError: string | null): SetsCheck => ({
    rowErrors,
    gameError,
    sets: [],
    winner: null,
    valid: false,
  });

  if (used === 0) return fail(MSG_NO_SETS);
  if (used > MAX_SETS_PER_GAME) return fail(MSG_TOO_MANY_SETS);

  const sets: [number, number][] = [];
  let won0 = 0;
  let won1 = 0;
  for (let index = 0; index < used; index++) {
    const [a, b] = rows[index];
    if (isBlank(a) || isBlank(b)) {
      rowErrors[index] = MSG_ROW_INCOMPLETE;
      continue;
    }
    const tiebreakAllowed = index === used - 1 && index >= 2;
    if (isStandardSet(a, b) || (tiebreakAllowed && isSuperTiebreak(a, b))) {
      sets.push([a as number, b as number]);
      if ((a as number) > (b as number)) won0++;
      else won1++;
      continue;
    }
    rowErrors[index] = tiebreakAllowed
      ? MSG_SET_ILLEGAL_DECIDER
      : isSuperTiebreak(a, b)
        ? MSG_TIEBREAK_PLACE
        : MSG_SET_ILLEGAL;
  }

  if (rowErrors.some(Boolean)) return fail(null);
  if (won0 === won1) return fail(MSG_UNFINISHED);
  return { rowErrors, gameError: null, sets, winner: won0 > won1 ? 0 : 1, valid: true };
}

export interface PointsCheck {
  /** RAW Georgian or null. */
  error: string | null;
  points: [number, number] | null;
  /** 0 / 1, or null on a tie (a legal result) or while invalid. */
  winner: 0 | 1 | null;
  valid: boolean;
}

/** Points mode (americano / mexicano): whole numbers 0–64, a tie is legal, 0-0 is not. */
export function checkPoints(row: ScoreRow): PointsCheck {
  const [a, b] = row;
  const fail = (error: string): PointsCheck => ({
    error,
    points: null,
    winner: null,
    valid: false,
  });
  if (isBlank(a) || isBlank(b)) return fail(MSG_ROW_INCOMPLETE);
  for (const p of [a, b]) {
    if (!isInt(p) || p < 0 || p > MAX_POINTS_PER_GAME) return fail(MSG_POINTS_RANGE);
  }
  const x = a as number;
  const y = b as number;
  if (x === 0 && y === 0) return fail(MSG_POINTS_ZERO);
  return { error: null, points: [x, y], winner: x === y ? null : x > y ? 0 : 1, valid: true };
}
