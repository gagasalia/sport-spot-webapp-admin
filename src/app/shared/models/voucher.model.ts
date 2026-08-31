/**
 * Voucher domain models (design §21). A voucher is a prepaid balance stored
 * server-side in integer **tetri** (1 GEL = 100 tetri), in one of three SCOPES:
 * facility-pinned, academy-wide (`facility` null) or universal (both null,
 * superadmin-only). The admin UI enters/edits amounts in GEL and converts at
 * the edge (`gelToTetri`).
 */

/** Lifecycle status persisted on the doc. "depleted"/"expired" are DERIVED.
 * `revoked` = a campaign reward clawed back after its qualifying bookings
 * were cancelled (docs/24 §3) — terminal, balance zeroed. */
export type VoucherStatus = 'active' | 'pending_activation' | 'revoked';

/** `campaign` = earned by completing a loyalty campaign (docs/24 §3). */
export type VoucherSource =
  | 'migration'
  | 'admin_grant'
  | 'purchase'
  | 'gift'
  | 'campaign';

/** The states the admin list surfaces as a chip (depleted/expired derived). */
export type VoucherDerivedStatus =
  | 'active'
  | 'depleted'
  | 'expired'
  | 'pending_activation'
  | 'revoked';

/**
 * One scope of the voucher lists/writes: a facility, an academy (its
 * academy-WIDE vouchers only), or — with neither — the universal pool
 * (superadmin-only).
 */
export interface VoucherScopeQuery {
  facilityId?: string;
  academyId?: string;
}

/**
 * A voucher row as returned by `GET /vouchers` (admin-scoped). The API
 * snapshots `ownerPhone` for display; `owner` remains the raw user id.
 */
export interface Voucher {
  _id?: string;
  facility?: string | null;
  academy?: string | null;
  facilityName?: string | null;
  academyName?: string | null;
  owner?: string | null;
  ownerPhone?: string | null;
  /** Public numeric member ID of the owner (absent on legacy docs). */
  ownerMemberId?: number | null;
  code: string;
  initialTetri: number;
  balanceTetri: number;
  currency: 'GEL';
  expiresAt?: string | null;
  status: VoucherStatus;
  source: VoucherSource;
  note?: string;
  createdAt?: string;
}

/**
 * A pending grant (`voucher_grants`) awaiting the recipient's registration/login.
 * Returned by `GET /vouchers/grants`.
 */
export interface PendingGrant {
  _id?: string;
  phone: string;
  facility?: string | null;
  academy?: string | null;
  amountTetri: number;
  expiresAt?: string | null;
  note?: string;
  source: 'migration' | 'admin_grant';
  createdAt?: string;
}

/**
 * `POST /vouchers/grant` body. `amountTetri` is integer tetri. Scope:
 * `facilityId` → facility voucher; `academyId` alone → academy-wide; neither →
 * universal (superadmin-only).
 */
export interface GrantVoucherDto {
  phone: string;
  facilityId?: string;
  academyId?: string;
  amountTetri: number;
  expiresAt?: string;
  note?: string;
}

/** One entry of a bulk import (already converted to tetri). */
export interface ImportEntry {
  phone: string;
  amountTetri: number;
}

/** `POST /vouchers/grants/import` body — same scope rules as the grant. */
export interface ImportVouchersDto {
  facilityId?: string;
  academyId?: string;
  expiresAt?: string;
  entries: ImportEntry[];
}

/** `POST /vouchers/grants/import` result: existing users vs unknown phones. */
export interface ImportResult {
  granted: number;
  pending: number;
}

/**
 * `POST /vouchers/grant` returns either an active `Voucher` (existing user →
 * immediate voucher, carries a `code`) or a `PendingGrant` (unknown phone). The
 * presence of `code` discriminates the two.
 */
export type GrantResult = { status: 'granted'; voucher: Voucher } | { status: 'pending'; grant: PendingGrant };

/** Type guard: an active voucher was created (vs. a pending grant queued). */
export function isVoucher(result: GrantResult): result is { status: 'granted'; voucher: Voucher } {
  return result.status === 'granted';
}
