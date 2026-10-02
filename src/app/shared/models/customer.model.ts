/**
 * Customer-management models — mirrors the API's /customers responses
 * (CustomersService interfaces). A "customer" is a player account with at
 * least one booking_event in the caller's scope; a plain admin only ever sees
 * (and moderates) the players of their own academy.
 */

export type CustomerFlagFilter = 'banned' | 'flagged';

export interface CustomersQuery {
  q?: string;
  flag?: CustomerFlagFilter;
  academyId?: string;
  page?: number;
  limit?: number;
}

/** One list row: identity + per-scope stats from the booking_events log. */
export interface CustomerRow {
  userId: string;
  /** Public numeric member ID — absent on legacy docs until the API backfill. */
  memberId?: number;
  firstName?: string;
  lastName?: string;
  /**
   * External sign-in email — Google (docs/29) always brings one, Facebook
   * (docs/30) only when the Facebook account shares it; phone-only players
   * and hard-deleted accounts have none.
   */
  email?: string;
  /**
   * Absent on an external-only player (transitional: the webapp asks for a
   * phone right after the first Google/Facebook sign-in) and on a
   * hard-deleted account.
   */
  phone?: string;
  /** True when the account can sign in with Google (docs/29). */
  googleLinked?: boolean;
  /** True when the account can sign in with Facebook (docs/30). */
  facebookLinked?: boolean;
  avatarUrl?: string;
  banned: boolean;
  flagged: boolean;
  banReason?: string;
  flagReason?: string;
  bookings: number;
  cancelled: number;
  noShows: number;
  spentTetri: number;
  lastBookingAt: string | null;
  lastActivityAt: string | null;
}

export type ModerationActionType =
  | 'ban'
  | 'unban'
  | 'flag'
  | 'unflag'
  | 'contact_fix';

export interface ModerationEntry {
  action: ModerationActionType;
  reason?: string;
  at: string;
  actorEmail?: string;
}

export interface CustomerModeration {
  banned: boolean;
  banReason?: string;
  bannedAt?: string;
  flagged: boolean;
  flagReason?: string;
  flaggedAt?: string;
  /** Newest first (the API serves it reversed). */
  history: ModerationEntry[];
}

export interface CustomerProfile {
  _id: string;
  /** Public numeric member ID — absent on legacy docs until the API backfill. */
  memberId?: number;
  /**
   * External sign-in email (Google docs/29, Facebook docs/30) — absent on
   * phone-only players and on Facebook accounts that share no email.
   */
  email?: string;
  firstName?: string;
  lastName?: string;
  /** Absent on an external-only (Google/Facebook) player without a phone yet. */
  phone?: string;
  /** True when the account can sign in with Google (docs/29). */
  googleLinked?: boolean;
  /** True when the account can sign in with Facebook (docs/30). */
  facebookLinked?: boolean;
  avatarUrl?: string;
  /** Legacy (pre phone-only) flag — no longer served; optional for old payloads. */
  emailVerified?: boolean;
  phoneVerified: boolean;
  dateOfBirth?: string;
  /** Registration instant ("member since"). */
  createdAt?: string;
  /** Superadmin-only fields — absent in plain-admin responses. */
  balanceTetri?: number;
  pid?: string;
}

export interface CustomerStats {
  bookings: number;
  cancelled: number;
  cancelRate: number | null;
  noShows: number;
  noShowRate: number | null;
  spentTetri: number;
  upcoming: number;
  firstBookingAt: string | null;
  lastBookingAt: string | null;
}

export interface CustomerDetail {
  profile: CustomerProfile;
  moderation: CustomerModeration;
  stats: CustomerStats;
}

/** One booking-history row (tips are never present in operator reads). */
export interface CustomerBookingRow {
  _id: string;
  date: string;
  start: string;
  end: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  paymentStatus?: string;
  paymentMethod?: string;
  priceTetri?: number;
  currency?: string;
  facility?: string;
  facilityName?: string;
  courtName?: string;
  courtNameEn?: string;
  /** Legacy snapshot — pre-rename bookings only; superseded by `courtName`. */
  courtNumber?: number;
  createdAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
}

export interface UpdateCustomerContactDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  /** Superadmin only — the API 403s a plain admin sending it. */
  email?: string;
}
