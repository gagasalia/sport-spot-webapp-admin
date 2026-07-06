/** Open-match shapes for the operator app (docs/15-open-matches-design.md). */

export type MatchVisibility = 'public' | 'private';
export type MatchStatus = 'open' | 'cancelled';
export type MatchPlayerRole = 'owner' | 'player';
export type MatchPlayerStatus = 'joined' | 'left' | 'removed';
export type MatchLevel = 'any' | 'beginner' | 'intermediate' | 'advanced';
export type MatchCategory = 'men' | 'women' | 'mixed';

export interface AdminMatch {
  _id: string;
  owner: string;
  ownerName?: string;
  academy: string;
  facility: string;
  facilityName?: string;
  city?: string;
  sportType: string;
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:mm'
  durationMinutes: number;
  startUtc?: string;
  level: MatchLevel;
  category: MatchCategory;
  visibility: MatchVisibility;
  maxPlayers: number;
  playersCount: number;
  pricePerPlayerTetri?: number;
  description?: string;
  status: MatchStatus;
  cancelledBy?: 'owner' | 'admin';
  createdAt?: string;
}

/** Full membership row — operators see contact snapshots. */
export interface AdminMatchPlayer {
  _id: string;
  match: string;
  user: string;
  role: MatchPlayerRole;
  status: MatchPlayerStatus;
  playerName?: string;
  playerEmail?: string;
  playerPhone?: string;
  createdAt?: string;
}
