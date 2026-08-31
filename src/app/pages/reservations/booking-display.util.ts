import { Booking, BookingUserRef } from '../../shared/models/booking.model';

/**
 * Booking display-identity helpers shared by the calendar views and the list
 * module (who a slot belongs to, and whether a player profile is linkable).
 */

/** The populated player ref, or null for manual/legacy rows. */
export function bookingPlayer(b: Booking): BookingUserRef | null {
  return b.user && typeof b.user === 'object' ? b.user : null;
}

/** Who the slot belongs to: manual customerName or the player's name. */
export function bookingDisplayName(b: Booking): string | null {
  if (b.customerName) return b.customerName;
  const u = bookingPlayer(b);
  if (!u) return null;
  const parts = [u.firstName, u.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}
