/** Tournament shapes for the operator app (docs/13-tournaments-design.md). */

export type TournamentType = 'singles' | 'doubles';
export type TournamentFormat =
  | 'knockout'
  | 'round_robin'
  | 'groups_playoffs'
  | 'championship'
  | 'americano'
  | 'mexicano';
export type TournamentLevel = 'any' | 'beginner' | 'intermediate' | 'advanced';
export type TournamentCategory = 'men' | 'women' | 'mixed';
export type TournamentStatus = 'draft' | 'published' | 'completed' | 'cancelled';

/**
 * The off-site block of an EXTERNAL tournament (docs/26 §WP-1d): an event run
 * by a non-partner club, listed by a superadmin on the player site's
 * `/tournaments`, with registration on the organizer's own site. Where it is
 * played is a directory `venue` (docs/26 §WP-1b) or a free-text `venueName`.
 */
export interface TournamentExternal {
  /** Where players register (http/https). */
  registrationUrl: string;
  organizerName?: string;
  /** Directory venue id. */
  venue?: string | null;
  venueName?: string;
}

export interface Tournament {
  _id: string;
  /** Absent on an external tournament (it belongs to no academy). */
  academy?: string;
  /** Host facility; optional on an external tournament. */
  facility?: string;
  facilityName?: string;
  city?: string;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  sportType: string;
  type: TournamentType;
  format: TournamentFormat;
  level: TournamentLevel;
  category: TournamentCategory;
  startDate: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:mm'
  endDate?: string;
  startUtc?: string;
  registrationDeadline?: string; // ISO instant
  entryFeeTetri: number;
  currency: 'GEL';
  prizeDescription?: string;
  prizeDescriptionEn?: string;
  maxParticipants: number;
  registeredCount: number;
  status: TournamentStatus;
  /** Set = an external tournament (registration off-site, superadmin-managed). */
  external?: TournamentExternal | null;
  createdAt?: string;
}

export interface CreateTournamentDto {
  /** Required unless `external` is set (then it is left out). */
  facility?: string;
  /** SUPERADMIN only: makes it an external tournament. */
  external?: TournamentExternal;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  sportType?: string;
  type: TournamentType;
  format: TournamentFormat;
  level?: TournamentLevel;
  category?: TournamentCategory;
  startDate: string;
  startTime: string;
  endDate?: string;
  registrationDeadline?: string;
  entryFeeTetri: number;
  prizeDescription?: string;
  prizeDescriptionEn?: string;
  maxParticipants: number;
}

/** Every key optional; the kind (internal/external) is fixed at creation — `external` only replaces the block of an external one. */
export type UpdateTournamentDto = Partial<Omit<CreateTournamentDto, 'external'>> & {
  external?: TournamentExternal | null;
};

// Caps mirrored from the API (tournament.constants.ts).
export const EXTERNAL_REGISTRATION_URL_MAX = 500;
export const EXTERNAL_ORGANIZER_MAX = 120;
export const EXTERNAL_VENUE_NAME_MAX = 160;

export type RegistrationPaymentStatus = 'pay_at_venue' | 'paid' | 'refunded';

export interface TournamentRegistration {
  _id: string;
  tournament: string;
  user: string;
  status: 'registered' | 'cancelled';
  partnerName?: string;
  paymentStatus: RegistrationPaymentStatus;
  playerName?: string;
  playerEmail?: string;
  playerPhone?: string;
  /** Public numeric member ID snapshot (absent on legacy registrations). */
  playerMemberId?: number;
  /** Snapshot of the player's profile picture (refreshed on avatar change). */
  playerAvatar?: string;
  createdAt?: string;
}
