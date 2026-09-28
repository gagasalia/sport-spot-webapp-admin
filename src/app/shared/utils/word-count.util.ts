/**
 * Words in a plain text, the way a reader counts them (whitespace-separated).
 * Backs the live «N სიტყვა» counters the SEO guidance is measured against
 * (venue descriptions, coach bios).
 */
export function countWords(text: string | null | undefined): number {
  return (text ?? '').trim().split(/\s+/).filter(Boolean).length;
}
