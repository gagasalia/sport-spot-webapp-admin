/**
 * Voucher domain models (design §21). A voucher is a prepaid, facility-scoped
 * balance stored server-side in integer **tetri** (1 GEL = 100 tetri). The admin
 * UI enters/edits amounts in GEL and converts at the edge (`gelToTetri`).
 */

/** Lifecycle status persisted on the doc. "depleted"/"expired" are DERIVED. */
export type VoucherStatus = 'active' | 'pending_activation';

export type VoucherSource = 'migration' | 'admin_grant' | 'purchase' | 'gift';

/** The four states the admin list surfaces as a chip (three derived). */
export type VoucherDerivedStatus = 'active' | 'depleted' | 'expired' | 'pending_activation';

/**
 * A voucher row as returned by `GET /vouchers?facilityId=` (admin-scoped). The
 * API snapshots `ownerEmail` for display; `owner` remains the raw user id.
 */
export interface Voucher {
  _id?: string;
  facility: string;
  academy?: string;
  owner?: string | null;
  ownerEmail?: string | null;
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
 * Returned by `GET /vouchers/grants?facilityId=`.
 */
export interface PendingGrant {
  _id?: string;
  email: string;
  facility: string;
  academy?: string;
  amountTetri: number;
  expiresAt?: string | null;
  note?: string;
  source: 'migration' | 'admin_grant';
  createdAt?: string;
}

/** `POST /vouchers/grant` body. `amountTetri` is integer tetri. */
export interface GrantVoucherDto {
  email: string;
  facilityId: string;
  amountTetri: number;
  expiresAt?: string;
  note?: string;
}

/** One entry of a bulk import (already converted to tetri). */
export interface ImportEntry {
  email: string;
  amountTetri: number;
}

/** `POST /vouchers/grants/import` body. */
export interface ImportVouchersDto {
  facilityId: string;
  expiresAt?: string;
  entries: ImportEntry[];
}

/** `POST /vouchers/grants/import` result: existing users vs unknown emails. */
export interface ImportResult {
  granted: number;
  pending: number;
}

/**
 * `POST /vouchers/grant` returns either an active `Voucher` (existing user →
 * immediate voucher, carries a `code`) or a `PendingGrant` (unknown email). The
 * presence of `code` discriminates the two.
 */
export type GrantResult = Voucher | PendingGrant;

/** Type guard: an active voucher was created (vs. a pending grant queued). */
export function isVoucher(result: GrantResult): result is Voucher {
  return typeof (result as Voucher).code === 'string';
}
