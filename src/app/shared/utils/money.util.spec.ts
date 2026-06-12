import { gelToTetri, tetriToGel } from './money.util';

describe('money.util', () => {
  describe('tetriToGel', () => {
    it('converts integer tetri to decimal GEL', () => {
      expect(tetriToGel(2550)).toBe(25.5);
      expect(tetriToGel(5000)).toBe(50);
      expect(tetriToGel(0)).toBe(0);
    });

    it('coerces non-numeric input to 0', () => {
      expect(tetriToGel(NaN)).toBe(0);
      expect(tetriToGel(undefined as unknown as number)).toBe(0);
    });
  });

  describe('gelToTetri', () => {
    it('converts decimal GEL to rounded integer tetri', () => {
      expect(gelToTetri(25.5)).toBe(2550);
      expect(gelToTetri(50)).toBe(5000);
      expect(gelToTetri(25.555)).toBe(2556);
    });

    it('coerces non-numeric input to 0', () => {
      expect(gelToTetri(NaN)).toBe(0);
      expect(gelToTetri(undefined as unknown as number)).toBe(0);
    });
  });
});
