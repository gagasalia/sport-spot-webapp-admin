import { countWords } from './word-count.util';

describe('countWords', () => {
  it('splits on any whitespace', () => {
    expect(countWords('')).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords(undefined)).toBe(0);
    expect(countWords(' a  b\nc\t d ')).toBe(4);
  });
});
