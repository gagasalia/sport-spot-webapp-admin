/**
 * Money conversion helpers for the price representation edge.
 *
 * Prices cross the wire as integer **tetri** (1 GEL = 100 tetri); the UI works
 * in decimal GEL. These are standalone pure functions so any component can
 * convert without depending on a service. `ScheduleService` keeps thin static
 * wrappers for backwards compatibility with the schedule/pricing pages.
 */

/** Integer tetri → GEL decimal. e.g. 2550 → 25.5. */
export function tetriToGel(tetri: number): number {
  return (Number(tetri) || 0) / 100;
}

/** GEL decimal → integer tetri (rounded). e.g. 25.5 → 2550. */
export function gelToTetri(gel: number): number {
  return Math.round((Number(gel) || 0) * 100);
}
