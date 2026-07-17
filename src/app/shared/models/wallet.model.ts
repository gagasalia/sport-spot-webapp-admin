/**
 * Wallet shapes for the superadmin balance management (`/um/:id/wallet*`).
 * Amounts are integer tetri on the wire (1 GEL = 100 tetri); ledger rows carry
 * SIGNED amounts — credits (topup / admin_credit / refund) positive, debits
 * (admin_debit / booking_payment) negative.
 */

export interface WalletBalance {
  balanceTetri: number;
  currency: 'GEL';
}

export type WalletTransactionType =
  | 'topup'
  | 'admin_credit'
  | 'admin_debit'
  | 'booking_payment'
  | 'refund';

/** One immutable ledger row. */
export interface WalletTransaction {
  _id: string;
  user: string;
  type: WalletTransactionType;
  /** Signed integer tetri. */
  amountTetri: number;
  /** Balance immediately after this row applied. */
  balanceAfterTetri: number;
  currency: 'GEL';
  reference?: string;
  booking?: string;
  /** App-support tip portion of a booking_payment debit (positive tetri). */
  tipTetri?: number;
  /** Admin reason or a booking display snapshot. */
  note?: string;
  /** Who initiated (player or superadmin). */
  actor?: string;
  createdAt?: string;
}

/** Body of `POST /um/:id/wallet/adjust` — signed tetri + mandatory reason. */
export interface AdjustBalanceDto {
  amountTetri: number;
  note: string;
}

/** `result.data` of a successful adjustment. */
export interface WalletMutation {
  balanceTetri: number;
  transaction: WalletTransaction;
}
