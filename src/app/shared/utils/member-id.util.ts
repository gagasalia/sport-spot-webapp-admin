/**
 * Formats a public numeric member ID for display: zero-padded to 6 digits
 * ("000042"), matching the player app's profile rendering. Nullish (legacy
 * docs the API backfill has not reached, manual bookings) → ''.
 */
export function formatMemberId(memberId: number | null | undefined): string {
  return memberId == null ? '' : String(memberId).padStart(6, '0');
}

/**
 * Parses a member-ID filter input: digits-only text (leading zeros fine) →
 * the numeric ID; anything else → null. '' is null (no filter), not 0.
 */
export function parseMemberId(raw: string): number | null {
  const trimmed = raw.trim();
  return /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : null;
}
