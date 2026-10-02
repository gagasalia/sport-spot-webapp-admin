import {
  MSG_NO_SETS,
  MSG_POINTS_RANGE,
  MSG_POINTS_ZERO,
  MSG_ROW_INCOMPLETE,
  MSG_SET_ILLEGAL,
  MSG_SET_ILLEGAL_DECIDER,
  MSG_TIEBREAK_PLACE,
  MSG_TOO_MANY_SETS,
  MSG_UNFINISHED,
  ScoreRow,
  checkPoints,
  checkSets,
  isStandardSet,
  isSuperTiebreak,
} from './score-rules.util';

// Mirrors sport-spot-api engine/score-rules.spec — the same vocabulary of
// legal padel sets, so the form never lets through what the API 400s.
describe('score-rules.util', () => {
  describe('isStandardSet', () => {
    it('accepts 6-0…6-4, 7-5 and 7-6 either way round', () => {
      for (const [a, b] of [
        [6, 0],
        [6, 4],
        [7, 5],
        [7, 6],
        [3, 6],
        [6, 7],
      ]) {
        expect(isStandardSet(a, b)).withContext(`${a}-${b}`).toBeTrue();
      }
    });

    it('rejects 6-5, 7-4, 8-6, ties, negatives and fractions', () => {
      for (const [a, b] of [
        [6, 5],
        [7, 4],
        [8, 6],
        [6, 6],
        [-1, 6],
        [6, 2.5],
      ]) {
        expect(isStandardSet(a, b)).withContext(`${a}-${b}`).toBeFalse();
      }
    });
  });

  describe('isSuperTiebreak', () => {
    it('accepts 10-x (x ≤ 8) and win-by-two above ten', () => {
      expect(isSuperTiebreak(10, 0)).toBeTrue();
      expect(isSuperTiebreak(8, 10)).toBeTrue();
      expect(isSuperTiebreak(11, 9)).toBeTrue();
      expect(isSuperTiebreak(14, 12)).toBeTrue();
    });

    it('rejects 10-9, 12-9 and 9-7', () => {
      expect(isSuperTiebreak(10, 9)).toBeFalse();
      expect(isSuperTiebreak(12, 9)).toBeFalse();
      expect(isSuperTiebreak(9, 7)).toBeFalse();
    });
  });

  describe('checkSets', () => {
    it('6-1 6-1 → team 0 wins; trailing blank rows are ignored', () => {
      const check = checkSets([
        [6, 1],
        [6, 1],
        [null, null],
      ]);
      expect(check.valid).toBeTrue();
      expect(check.winner).toBe(0);
      expect(check.sets).toEqual([
        [6, 1],
        [6, 1],
      ]);
      expect(check.rowErrors).toEqual([null, null, null]);
    });

    it('a three-setter with a super tiebreak decider is legal', () => {
      const check = checkSets([
        [6, 4],
        [4, 6],
        [8, 10],
      ]);
      expect(check.valid).toBeTrue();
      expect(check.winner).toBe(1);
    });

    it('flags an illegal row in place', () => {
      const check = checkSets([
        [6, 5],
        [6, 1],
      ]);
      expect(check.valid).toBeFalse();
      expect(check.rowErrors).toEqual([MSG_SET_ILLEGAL, null]);
    });

    it('a super tiebreak before the third set says where it belongs', () => {
      const check = checkSets([
        [10, 8],
        [6, 1],
      ]);
      expect(check.rowErrors[0]).toBe(MSG_TIEBREAK_PLACE);
    });

    it('a super tiebreak in the third set but not the last one is illegal', () => {
      const check = checkSets([
        [6, 4],
        [4, 6],
        [10, 7],
        [6, 2],
      ]);
      expect(check.rowErrors[2]).toBe(MSG_TIEBREAK_PLACE);
    });

    it('an illegal decider names the tiebreak option', () => {
      const check = checkSets([
        [6, 4],
        [4, 6],
        [9, 7],
      ]);
      expect(check.rowErrors[2]).toBe(MSG_SET_ILLEGAL_DECIDER);
    });

    it('1-1 in sets is an unfinished game', () => {
      const check = checkSets([
        [6, 4],
        [4, 6],
      ]);
      expect(check.valid).toBeFalse();
      expect(check.gameError).toBe(MSG_UNFINISHED);
    });

    it('a half-filled or blank-in-the-middle row is incomplete', () => {
      expect(
        checkSets([
          [6, null],
          [6, 1],
        ]).rowErrors[0],
      ).toBe(MSG_ROW_INCOMPLETE);
      expect(
        checkSets([
          [null, null],
          [6, 1],
        ]).rowErrors[0],
      ).toBe(MSG_ROW_INCOMPLETE);
    });

    it('needs 1–5 sets', () => {
      expect(checkSets([[null, null]]).gameError).toBe(MSG_NO_SETS);
      const six: ScoreRow[] = Array.from({ length: 6 }, () => [6, 0]);
      expect(checkSets(six).gameError).toBe(MSG_TOO_MANY_SETS);
    });
  });

  describe('checkPoints', () => {
    it('16-12 → team 0; a 16-16 tie is a legal result with no winner', () => {
      expect(checkPoints([16, 12])).toEqual({
        error: null,
        points: [16, 12],
        winner: 0,
        valid: true,
      });
      const tie = checkPoints([16, 16]);
      expect(tie.valid).toBeTrue();
      expect(tie.winner).toBeNull();
    });

    it('rejects 0-0, out-of-range and incomplete rows', () => {
      expect(checkPoints([0, 0]).error).toBe(MSG_POINTS_ZERO);
      expect(checkPoints([65, 3]).error).toBe(MSG_POINTS_RANGE);
      expect(checkPoints([-1, 3]).error).toBe(MSG_POINTS_RANGE);
      expect(checkPoints([12, null]).error).toBe(MSG_ROW_INCOMPLETE);
    });
  });
});
