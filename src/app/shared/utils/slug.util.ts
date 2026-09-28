/**
 * Latin URL slugs from Georgian (or English) text — docs/26: a slug is the
 * Latin transliteration of the target query («პადელის წესები» →
 * `padelis-tsesebi`). Georgian letters follow the national romanization
 * system (2002), the one Georgian readers type into a search box.
 */

const GEORGIAN_TO_LATIN: Readonly<Record<string, string>> = {
  'ა': 'a',
  'ბ': 'b',
  'გ': 'g',
  'დ': 'd',
  'ე': 'e',
  'ვ': 'v',
  'ზ': 'z',
  'თ': 't',
  'ი': 'i',
  'კ': 'k',
  'ლ': 'l',
  'მ': 'm',
  'ნ': 'n',
  'ო': 'o',
  'პ': 'p',
  'ჟ': 'zh',
  'რ': 'r',
  'ს': 's',
  'ტ': 't',
  'უ': 'u',
  'ფ': 'p',
  'ქ': 'k',
  'ღ': 'gh',
  'ყ': 'q',
  'შ': 'sh',
  'ჩ': 'ch',
  'ც': 'ts',
  'ძ': 'dz',
  'წ': 'ts',
  'ჭ': 'ch',
  'ხ': 'kh',
  'ჯ': 'j',
  'ჰ': 'h',
};

/** Georgian letters → Latin; everything else passes through unchanged. */
export function transliterateGeorgian(text: string): string {
  let out = '';
  for (const ch of text) {
    out += GEORGIAN_TO_LATIN[ch] ?? ch;
  }
  return out;
}

/**
 * `'პადელის წესები — 2026!'` → `'padelis-tsesebi-2026'`: transliterated,
 * accents stripped, lower-cased, every other run of characters collapsed to
 * one hyphen. Longer slugs are cut at the last whole word within `maxLength`.
 */
export function slugify(text: string | null | undefined, maxLength = 100): string {
  const slug = transliterateGeorgian(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= maxLength) {
    return slug;
  }
  const cut = slug.slice(0, maxLength + 1);
  const lastHyphen = cut.lastIndexOf('-');
  return (lastHyphen > 0 ? cut.slice(0, lastHyphen) : slug.slice(0, maxLength)).replace(/-+$/, '');
}
