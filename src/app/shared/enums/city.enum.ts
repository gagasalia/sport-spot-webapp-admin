export enum City {
  Tbilisi = 1,
  Tskneti = 2,
}

/**
 * Canonical city list — the latin `id` is the stored facility `city` value
 * (sent to the API verbatim), `name` is the Georgian display label.
 */
export const CITY_OPTIONS: readonly { id: string; name: string }[] = [
  { id: 'Tbilisi', name: 'თბილისი' },
  { id: 'Tskneti', name: 'წყნეთი' },
];

/** Georgian label for a stored city value, falling back to the raw value. */
export function cityName(city: string | undefined): string {
  return CITY_OPTIONS.find((c) => c.id === city)?.name ?? city ?? 'თბილისი';
}
