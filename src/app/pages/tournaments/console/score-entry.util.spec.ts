import { MatchView, StageScoring } from '../../../shared/models/tournament-engine.model';
import {
  ScoreEntryState,
  checkScoreEntry,
  complementPoints,
  initialEntry,
  isTiebreakRow,
  previewWinner,
  setRowCount,
  shouldAdvance,
} from './score-entry.util';

const bo3: StageScoring = { type: 'sets', bestOf: 3, superTiebreak: true };
const bo3NoTb: StageScoring = { type: 'sets', bestOf: 3, superTiebreak: false };
const bo1: StageScoring = { type: 'sets', bestOf: 1, superTiebreak: false };
const bo5: StageScoring = { type: 'sets', bestOf: 5, superTiebreak: true };
const to24: StageScoring = { type: 'points', pointsTarget: 24 };
const timed: StageScoring = { type: 'points' };

function sets(rows: [number | null, number | null][], outcome: ScoreEntryState['outcome'] = 'played'): ScoreEntryState {
  return { outcome, winner: null, sets: rows, points: [null, null] };
}

function points(a: number | null, b: number | null): ScoreEntryState {
  return { outcome: 'played', winner: null, sets: [], points: [a, b] };
}

const group = { knockout: false };
const bracket = { knockout: true };

/** The score dialog's validation + payload (API engine/match-score.ts). */
describe('score-entry.util', () => {
  describe('sets', () => {
    it('a two-set win → { sets }', () => {
      const check = checkScoreEntry(bo3, sets([[6, 4], [6, 3], [null, null]]), bracket);
      expect(check.valid).toBeTrue();
      expect(check.payload).toEqual({ sets: [[6, 4], [6, 3]] });
    });

    it('a super-tiebreak decider is fine in the deciding set when allowed', () => {
      const check = checkScoreEntry(bo3, sets([[6, 4], [3, 6], [10, 8]]), bracket);
      expect(check.valid).toBeTrue();
      expect(previewWinner(bo3, sets([[6, 4], [3, 6], [10, 8]]), bracket)).toBe(0);
    });

    it('refuses a super tiebreak when the stage plays none', () => {
      const check = checkScoreEntry(bo3NoTb, sets([[6, 4], [3, 6], [10, 8]]), bracket);
      expect(check.valid).toBeFalse();
      expect(check.rowErrors[2]?.key).toBe('ამ ეტაპზე სუპერ ტაიბრეიკი არ თამაშდება — შეიყვანეთ სრული სეტი');
    });

    it('best of 5: a super tiebreak only as the fifth set', () => {
      const early = checkScoreEntry(bo5, sets([[6, 4], [6, 4], [10, 8], [null, null], [null, null]]), group);
      expect(early.valid).toBeFalse();
      expect(early.rowErrors[2]?.key).toBe('სუპერ ტაიბრეიკი მხოლოდ გადამწყვეტ სეტშია');
      const decider = checkScoreEntry(bo5, sets([[6, 4], [4, 6], [6, 4], [4, 6], [10, 7]]), group);
      expect(decider.valid).toBeTrue();
    });

    it('the winner must take exactly ceil(bestOf / 2) sets', () => {
      const short = checkScoreEntry(bo3, sets([[6, 4], [null, null], [null, null]]), group);
      expect(short.error?.key).toBe('გამარჯვებულს ორი მოგებული სეტი სჭირდება');
      const tooMany = checkScoreEntry(bo3, sets([[6, 4], [6, 4], [6, 4]]), group);
      expect(tooMany.valid).toBeFalse();
      const one = checkScoreEntry(bo1, sets([[6, 4]]), group);
      expect(one.payload).toEqual({ sets: [[6, 4]] });
      expect(checkScoreEntry(bo5, sets([[6, 4], [6, 4], [null, null], [null, null], [null, null]]), group).error?.key).toBe(
        'გამარჯვებულს სამი მოგებული სეტი სჭირდება',
      );
    });

    it('illegal sets and half-typed rows are row errors', () => {
      const illegal = checkScoreEntry(bo3, sets([[6, 5], [6, 3], [null, null]]), group);
      expect(illegal.rowErrors[0]?.key).toBe('დაუშვებელი სეტი — 6-0…6-4, 7-5 ან 7-6');
      const half = checkScoreEntry(bo3, sets([[6, null], [6, 3], [null, null]]), group);
      expect(half.rowErrors[0]?.key).toBe('შეიყვანეთ ორივე რიცხვი');
    });
  });

  describe('points', () => {
    it('must add up to the target', () => {
      expect(checkScoreEntry(to24, points(15, 9), group).payload).toEqual({ points: [15, 9] });
      const wrong = checkScoreEntry(to24, points(15, 8), group);
      expect(wrong.error).toEqual({ key: 'ორი ქულის ჯამი %s უნდა იყოს', args: [24] });
    });

    it('a tie is a result in a group / social stage, never in the bracket', () => {
      expect(checkScoreEntry(to24, points(12, 12), group).valid).toBeTrue();
      expect(previewWinner(to24, points(12, 12), group)).toBeNull();
      expect(checkScoreEntry(to24, points(12, 12), bracket).error?.key).toBe('ბადის მატჩი ფრედ ვერ დასრულდება');
    });

    it('timed rounds take any whole numbers 0–64 (not 0-0)', () => {
      expect(checkScoreEntry(timed, points(17, 9), group).valid).toBeTrue();
      expect(checkScoreEntry(timed, points(0, 0), group).valid).toBeFalse();
      expect(checkScoreEntry(timed, points(70, 1), group).valid).toBeFalse();
    });

    it('typing one side fills the other from the target', () => {
      expect(complementPoints(24, 15)).toBe(9);
      expect(complementPoints(24, 30)).toBeNull();
      expect(complementPoints(undefined, 15)).toBeNull();
      expect(complementPoints(24, null)).toBeNull();
    });
  });

  describe('walkover / retired', () => {
    it('needs the winner; a walkover carries no score', () => {
      const missing = checkScoreEntry(bo3, { ...sets([[6, 4], [null, null], [null, null]], 'walkover') }, bracket);
      expect(missing.error?.key).toBe('აირჩიეთ, ვინ იმარჯვებს');
      const walkover = checkScoreEntry(bo3, { ...sets([[6, 4], [null, null], [null, null]], 'walkover'), winner: 1 }, bracket);
      expect(walkover.payload).toEqual({ outcome: 'walkover', winner: 1 });
    });

    it('a retirement keeps the score when play stopped (loosely checked)', () => {
      const retired = checkScoreEntry(bo3, { ...sets([[6, 4], [2, 1], [null, null]], 'retired'), winner: 0 }, bracket);
      expect(retired.payload).toEqual({ outcome: 'retired', winner: 0, sets: [[6, 4], [2, 1]] });
      const bare = checkScoreEntry(to24, { outcome: 'retired', winner: 1, sets: [], points: [null, null] }, group);
      expect(bare.payload).toEqual({ outcome: 'retired', winner: 1 });
      const half = checkScoreEntry(to24, { outcome: 'retired', winner: 1, sets: [], points: [5, null] }, group);
      expect(half.valid).toBeFalse();
    });
  });

  describe('cells', () => {
    it('one row per possible set; the deciding row may be a super tiebreak', () => {
      expect(setRowCount(bo5)).toBe(5);
      expect(setRowCount(to24)).toBe(0);
      expect(isTiebreakRow(bo3, 2)).toBeTrue();
      expect(isTiebreakRow(bo3, 1)).toBeFalse();
      expect(isTiebreakRow(bo3NoTb, 2)).toBeFalse();
    });

    it('focus moves on when a cell is complete ("1" waits in a tiebreak cell)', () => {
      expect(shouldAdvance('6', false)).toBeTrue();
      expect(shouldAdvance('1', false)).toBeTrue();
      expect(shouldAdvance('1', true)).toBeFalse();
      expect(shouldAdvance('10', true)).toBeTrue();
      expect(shouldAdvance('7', true)).toBeTrue();
      expect(shouldAdvance('', false)).toBeFalse();
    });

    it('prefills the stored result', () => {
      const done: MatchView = {
        id: 'm1',
        stage: 'knockout',
        round: 1,
        order: 0,
        sides: [{ entrants: ['a'] }, { entrants: ['b'] }],
        status: 'done',
        outcome: 'retired',
        winner: 1,
        score: { type: 'sets', sets: [[6, 4]] },
        rated: false,
      };
      expect(initialEntry(bo3, done)).toEqual({
        outcome: 'retired',
        winner: 1,
        sets: [[6, 4], [null, null], [null, null]],
        points: [null, null],
      });
    });
  });
});
