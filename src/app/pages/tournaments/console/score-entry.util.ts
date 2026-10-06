/**
 * The score dialog's brain (docs/33 §4 result entry, API `engine/match-score.ts`):
 * the entry state, its validation against the stage's scoring and the
 * PATCH …/result body. Set legality reuses the client mirror of the ranking
 * rules (score-rules.util); the stage adds best-of, the super-tiebreak rule
 * (deciding set only, when the structure allows it), the points target and
 * "a bracket match cannot end level". Pure; messages are RAW Georgian `Msg`s.
 */
import {
  MatchOutcome,
  MatchResultDto,
  MatchView,
  PARTIAL_GAMES_MAX,
  StageScoring,
} from '../../../shared/models/tournament-engine.model';
import { MAX_POINTS_PER_GAME } from '../../../shared/models/ranking.model';
import {
  ScoreRow,
  checkPoints,
  checkSets,
  isStandardSet,
  isSuperTiebreak,
} from '../../../shared/utils/score-rules.util';
import { Msg } from './msg.util';

export type Cell = number | null;

export interface ScoreEntryState {
  outcome: MatchOutcome;
  /** The awarded side of a walkover / retirement. */
  winner: 0 | 1 | null;
  /** One row per possible set (bestOf rows). */
  sets: [Cell, Cell][];
  points: [Cell, Cell];
}

export interface ScoreCheck {
  valid: boolean;
  /** Per set row; null = fine. */
  rowErrors: (Msg | null)[];
  /** Whole-result problem. */
  error: Msg | null;
  payload: MatchResultDto | null;
}

/** How many set rows the dialog shows. */
export function setRowCount(scoring: StageScoring): number {
  return scoring.type === 'sets' ? scoring.bestOf : 0;
}

/** The deciding set of a sets stage may be a super tiebreak (10-x). */
export function isTiebreakRow(scoring: StageScoring, row: number): boolean {
  return scoring.type === 'sets' && scoring.superTiebreak && scoring.bestOf > 1 && row === scoring.bestOf - 1;
}

/**
 * Focus moves on once a cell holds a complete number: any digit in a normal
 * set (games stop at 7); in a super-tiebreak cell a lone "1" may become 10–19,
 * so it waits for the second digit.
 */
export function shouldAdvance(raw: string, tiebreakCell: boolean): boolean {
  const value = (raw ?? '').trim();
  if (!/^\d+$/.test(value)) return false;
  if (value.length >= 2) return true;
  return !(tiebreakCell && value === '1');
}

/** Typing one side of a points game fills the other from the target. */
export function complementPoints(target: number | undefined, value: Cell): Cell {
  if (!target || value === null || !Number.isInteger(value) || value < 0 || value > target) {
    return null;
  }
  return target - value;
}

/** A finite whole number from an input, else null. */
export function toCell(value: unknown): Cell {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The dialog's first state: the stored result, or empty cells. */
export function initialEntry(scoring: StageScoring, match: MatchView): ScoreEntryState {
  const rows = Math.max(setRowCount(scoring), match.score?.sets?.length ?? 0);
  const sets: [Cell, Cell][] = Array.from({ length: rows }, (_, i) => {
    const set = match.score?.sets?.[i];
    return set ? [set[0] ?? null, set[1] ?? null] : [null, null];
  });
  const points: [Cell, Cell] = match.score?.points
    ? [match.score.points[0] ?? null, match.score.points[1] ?? null]
    : [null, null];
  const awarded = match.outcome === 'walkover' || match.outcome === 'retired';
  return {
    outcome: match.status === 'done' && match.outcome ? match.outcome : 'played',
    winner: awarded && (match.winner === 0 || match.winner === 1) ? match.winner : null,
    sets,
    points,
  };
}

const isBlank = (c: Cell): boolean => c === null || Number.isNaN(c);

/** Rows that carry something, trailing blank rows dropped. */
function usedRows(rows: [Cell, Cell][]): [Cell, Cell][] {
  let used = rows.length;
  while (used > 0 && isBlank(rows[used - 1][0]) && isBlank(rows[used - 1][1])) used--;
  return rows.slice(0, used);
}

const fail = (rowErrors: (Msg | null)[], error: Msg | null): ScoreCheck => ({
  valid: false,
  rowErrors,
  error,
  payload: null,
});

/**
 * Validates the entry for a match of this stage. `knockout` = a bracket match
 * (a points game there cannot end level).
 */
export function checkScoreEntry(
  scoring: StageScoring,
  state: ScoreEntryState,
  options: { knockout: boolean },
): ScoreCheck {
  const rowErrors: (Msg | null)[] = state.sets.map(() => null);

  if (state.outcome === 'walkover' || state.outcome === 'retired') {
    if (state.winner !== 0 && state.winner !== 1) {
      return fail(rowErrors, { key: 'აირჩიეთ, ვინ იმარჯვებს' });
    }
    const payload: MatchResultDto = { outcome: state.outcome, winner: state.winner };
    if (state.outcome === 'walkover') {
      return { valid: true, rowErrors, error: null, payload };
    }
    // A retirement may keep the score when play stopped (never rated).
    if (scoring.type === 'sets') {
      const rows = usedRows(state.sets);
      for (let i = 0; i < rows.length; i++) {
        const [a, b] = rows[i];
        if (isBlank(a) || isBlank(b)) {
          rowErrors[i] = { key: 'შეიყვანეთ ორივე რიცხვი' };
        } else if (![a, b].every((g) => Number.isInteger(g) && (g as number) >= 0 && (g as number) <= PARTIAL_GAMES_MAX)) {
          rowErrors[i] = { key: 'გეიმები — მთელი რიცხვები 0-დან 99-მდე' };
        }
      }
      if (rowErrors.some(Boolean)) return fail(rowErrors, null);
      if (rows.length) payload.sets = rows.map(([a, b]) => [a as number, b as number]);
    } else {
      const [a, b] = state.points;
      if (!isBlank(a) || !isBlank(b)) {
        if (isBlank(a) || isBlank(b)) return fail(rowErrors, { key: 'შეიყვანეთ ორივე რიცხვი' });
        if (![a, b].every((p) => Number.isInteger(p) && (p as number) >= 0 && (p as number) <= MAX_POINTS_PER_GAME)) {
          return fail(rowErrors, { key: 'ქულები — მთელი რიცხვები 0-დან 64-მდე' });
        }
        payload.points = [a as number, b as number];
      }
    }
    return { valid: true, rowErrors, error: null, payload };
  }

  if (scoring.type === 'points') {
    const check = checkPoints(state.points as ScoreRow);
    if (!check.valid || !check.points) {
      return fail(rowErrors, check.error ? { key: check.error } : null);
    }
    const [a, b] = check.points;
    if (scoring.pointsTarget && a + b !== scoring.pointsTarget) {
      return fail(rowErrors, { key: 'ორი ქულის ჯამი %s უნდა იყოს', args: [scoring.pointsTarget] });
    }
    if (a === b && options.knockout) {
      return fail(rowErrors, { key: 'ბადის მატჩი ფრედ ვერ დასრულდება' });
    }
    return { valid: true, rowErrors, error: null, payload: { points: [a, b] } };
  }

  // Sets.
  const rows = usedRows(state.sets);
  const check = checkSets(rows as ScoreRow[]);
  check.rowErrors.forEach((error, i) => (rowErrors[i] = error ? { key: error } : null));
  // The stage's own tiebreak rule: only in the deciding set, only when allowed.
  rows.forEach(([a, b], i) => {
    if (rowErrors[i] || isBlank(a) || isBlank(b)) return;
    if (isSuperTiebreak(a, b) && !isStandardSet(a, b)) {
      if (!scoring.superTiebreak) {
        rowErrors[i] = { key: 'ამ ეტაპზე სუპერ ტაიბრეიკი არ თამაშდება — შეიყვანეთ სრული სეტი' };
      } else if (i !== scoring.bestOf - 1) {
        rowErrors[i] = { key: 'სუპერ ტაიბრეიკი მხოლოდ გადამწყვეტ სეტშია' };
      }
    }
  });
  if (rowErrors.some(Boolean)) return fail(rowErrors, null);
  if (!check.valid) return fail(rowErrors, check.gameError ? { key: check.gameError } : null);

  const need = Math.ceil(scoring.bestOf / 2);
  const won = [0, 0];
  for (const [a, b] of check.sets) won[a > b ? 0 : 1]++;
  if (check.sets.length > scoring.bestOf || Math.max(won[0], won[1]) !== need) {
    return fail(rowErrors, {
      key:
        scoring.bestOf === 1
          ? 'ეს ეტაპი ერთი სეტით თამაშდება'
          : need === 2
            ? 'გამარჯვებულს ორი მოგებული სეტი სჭირდება'
            : 'გამარჯვებულს სამი მოგებული სეტი სჭირდება',
    });
  }
  return {
    valid: true,
    rowErrors,
    error: null,
    payload: { sets: check.sets.map(([a, b]) => [a, b]) },
  };
}

/** 0 / 1 = who the entered score makes the winner; null = undecided or a tie. */
export function previewWinner(
  scoring: StageScoring,
  state: ScoreEntryState,
  options: { knockout: boolean },
): 0 | 1 | null {
  if (state.outcome !== 'played') return state.winner;
  const check = checkScoreEntry(scoring, state, options);
  const payload = check.payload;
  if (!check.valid || !payload) return null;
  if (payload.points) {
    const [a, b] = payload.points;
    return a === b ? null : a > b ? 0 : 1;
  }
  const won = [0, 0];
  for (const [a, b] of payload.sets ?? []) won[a > b ? 0 : 1]++;
  return won[0] > won[1] ? 0 : 1;
}
