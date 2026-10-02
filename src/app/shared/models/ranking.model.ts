/**
 * Ranking wire shapes for the operator app (docs/25-ranking.md §5) — mirrors
 * sport-spot-api `modules/ranking/models/interfaces/ranking-views.interface.ts`
 * and the DTOs the admin sends. Operator/superadmin reads carry participant
 * phones; every response arrives inside the `ApiResponse` envelope.
 */

export type ScorecardSource = 'friendly' | 'open_match' | 'tournament';
export type ScorecardMode = 'doubles' | 'singles';
export type ScorecardStatus = 'pending' | 'confirmed' | 'rejected' | 'expired' | 'void';
export type ApprovalDecision = 'approve' | 'reject';
export type ParticipantKey = 'a' | 'b' | 'c' | 'd';
export type GameScoreType = 'sets' | 'points';

export const SCORECARD_STATUSES: readonly ScorecardStatus[] = [
  'pending',
  'confirmed',
  'rejected',
  'expired',
  'void',
];

/** Slots per mode — doubles A+B vs C+D, singles A vs B (API `keysForMode`). */
export const MODE_KEYS: Record<ScorecardMode, ParticipantKey[]> = {
  doubles: ['a', 'b', 'c', 'd'],
  singles: ['a', 'b'],
};

/** Calibration length (API `CALIBRATION_GAMES`) — display fallback only. */
export const CALIBRATION_GAMES = 8;

// Bounds mirrored from the API (ranking.constants.ts).
export const MAX_SETS_PER_GAME = 5;
export const MAX_POINTS_PER_GAME = 64;
export const PARTICIPANT_NAME_MIN = 2;
export const PARTICIPANT_NAME_MAX = 60;
export const VOID_REASON_MAX = 300;

/** The stable error code the API puts in front of a score-rule message. */
export const ERR_INVALID_SET = 'invalid_set_score';
export const ERR_NAME_REQUIRED = 'name_required_for_new_player';

export interface GameScore {
  type: GameScoreType;
  /** `[[6, 1], [6, 1]]` — team 0's games first in every pair. */
  sets?: number[][];
  /** `[16, 12]` — americano / mexicano. */
  points?: number[];
}

export interface ScorecardParticipantView {
  key: ParticipantKey;
  name: string;
  avatar?: string;
  memberId?: number;
  userId?: string;
  /** No account yet — results accrue under the phone until signup. */
  isShadow: boolean;
  isMe: boolean;
  /** Operator / superadmin reads only. */
  phone?: string;
}

export interface ScorecardGameView {
  n: number;
  teams: ParticipantKey[][];
  score: GameScore;
  /** 0 = first team, 1 = second team, null = points tie. */
  winner: 0 | 1 | null;
}

export interface ScorecardApprovalView {
  userId: string;
  decision: ApprovalDecision;
  reason?: string;
  at: string;
}

export interface ScorecardDeltaView {
  key: ParticipantKey;
  ratingBefore: number;
  ratingAfter: number;
  rdBefore: number;
  rdAfter: number;
  delta: number;
}

export interface ScorecardView {
  id: string;
  source: {
    type: ScorecardSource;
    matchId?: string;
    tournamentId?: string;
    academyId?: string;
  };
  mode: ScorecardMode;
  playedAt: string;
  facility?: { id?: string; name?: string; city?: string };
  participants: ScorecardParticipantView[];
  games: ScorecardGameView[];
  status: ScorecardStatus;
  approvalDeadline?: string;
  approvals: ScorecardApprovalView[];
  enteredBy: {
    userId?: string;
    adminId?: string;
    key?: ParticipantKey;
    name?: string;
  };
  flags: { shadowOnly?: boolean };
  ratedAt?: string;
  deltas?: ScorecardDeltaView[];
  expiredAt?: string;
  rejectedAt?: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
}

export interface RatingHistoryView {
  scorecardId: string;
  at: string;
  rating: number;
  rd: number;
  delta: number;
}

/** GET /ranking/customers/:userId/card — the customer-detail rating card. */
export interface RatingCardView {
  userId?: string;
  name: string;
  avatar?: string;
  memberId?: number;
  /** Fewer than CALIBRATION_GAMES rated games: number + tier hidden. */
  calibrating: boolean;
  calibration: { games: number; of: number };
  /** null while calibrating. */
  rating: number | null;
  /** Idle-inflated RD as of now. */
  rd: number;
  /** 0–100. */
  confidence: number;
  /** 1–7; null while calibrating. */
  tier: number | null;
  /** 1–5; null while calibrating. */
  stars: number | null;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  setsWon: number;
  setsLost: number;
  scorecards: number;
  visible: boolean;
  established: boolean;
  rank?: number;
  of?: number;
  trend: -1 | 0 | 1;
  peakRating?: number | null;
  lastRatedAt?: string;
  /** Oldest first (the API pushes and slices). */
  history: RatingHistoryView[];
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export interface TournamentResultParticipantDto {
  key: ParticipantKey;
  /** As typed / stored — the API normalizes to E.164 (TransformPhone). */
  phone: string;
  /** Needed when the phone has no account; ignored for accounts. */
  name?: string;
}

export interface TournamentResultGameDto {
  teams: ParticipantKey[][];
  score: GameScore;
}

/** POST /tournaments/:id/results — one pairing, created confirmed + rated. */
export interface TournamentResultDto {
  mode: ScorecardMode;
  participants: TournamentResultParticipantDto[];
  games: TournamentResultGameDto[];
  /** ISO instant; the API defaults to the tournament's start. */
  playedAt?: string;
}

/** GET /ranking/scorecards (superadmin moderation list). */
export interface ScorecardsAdminQuery {
  status?: ScorecardStatus;
  shadowOnly?: boolean;
  userId?: string;
  /** As typed (+995…, 995… or 9 digits) — finds shadows too. */
  phone?: string;
  page?: number;
  limit?: number;
}

/** GET /ranking/customers/:userId/scorecards (any operator). */
export interface CustomerScorecardsQuery {
  status?: ScorecardStatus;
  page?: number;
  limit?: number;
}

/** GET /ranking/customers/lookup?phone= — does this number have an account? */
export interface CustomerLookupView {
  found: boolean;
  userId?: string;
  name?: string;
  avatar?: string;
  memberId?: number;
}
