import { slugify, transliterateGeorgian } from './slug.util';

describe('slug.util', () => {
  it('transliterates Georgian with the national romanization', () => {
    expect(transliterateGeorgian('პადელის წესები')).toBe('padelis tsesebi');
    expect(transliterateGeorgian('ჩოგბურთი თბილისში')).toBe('chogburti tbilisshi');
    expect(transliterateGeorgian('ჟღერს ყველა ხე ჯერ ჰო')).toBe('zhghers qvela khe jer ho');
  });

  it('builds docs/26 style slugs', () => {
    expect(slugify('პადელის წესები')).toBe('padelis-tsesebi');
    expect(slugify('როგორ ვითამაშოთ პადელი?')).toBe('rogor-vitamashot-padeli');
    expect(slugify('Padel Rules for Beginners — 2026!')).toBe('padel-rules-for-beginners-2026');
    expect(slugify('  Crème brûlée  ')).toBe('creme-brulee');
  });

  it('returns an empty slug for empty or symbol-only input', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
    expect(slugify(' — !! ')).toBe('');
  });

  it('cuts long slugs at a word boundary', () => {
    const slug = slugify('ერთი ორი სამი ოთხი ხუთი', 16);
    expect(slug).toBe('erti-ori-sami');
    expect(slug.length).toBeLessThanOrEqual(16);
    expect(slugify('abcdefghijklmnopqrstuvwxyz', 10)).toBe('abcdefghij');
  });
});
