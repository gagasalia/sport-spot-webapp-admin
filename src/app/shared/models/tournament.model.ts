/** Tournament shapes for the operator app (docs/13-tournaments-design.md). */
import type {
  DrawStatus,
  TournamentCategoryDto,
  TournamentStructure,
} from './tournament-engine.model';

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
  /** Set = one CATEGORY of a multi-category event (docs/33 §2.5). */
  event?: TournamentEvent;
  /** The engine configuration (docs/33 §2.1); absent = not configured yet. */
  structure?: TournamentStructure | null;
  /** Draw state (docs/33 §2.2); absent = never drawn. */
  draw?: { status: DrawStatus } | null;
  /** Organizer accounts running this tournament (docs/33 §6). */
  organizers?: string[];
  createdAt?: string;
}

/** Sibling tournaments sharing `id` are the categories of one event. */
export interface TournamentEvent {
  id: string;
  /** The category's display name ("კაცები A"); absent = category + level. */
  label?: string;
  labelEn?: string;
  order: number;
  primary?: boolean;
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
  /** Required unless `categories` describes the event's categories. */
  type?: TournamentType;
  /** Required unless `categories` is set. */
  format?: TournamentFormat;
  level?: TournamentLevel;
  category?: TournamentCategory;
  startDate: string;
  startTime: string;
  endDate?: string;
  registrationDeadline?: string;
  /** Required unless `categories` is set. */
  entryFeeTetri?: number;
  prizeDescription?: string;
  prizeDescriptionEn?: string;
  /** Required unless `categories` is set. */
  maxParticipants?: number;
  /**
   * A multi-category EVENT (docs/33 §2.5, ≥ 2 entries): one tournament per
   * category sharing every event-level field; the top-level type / format /
   * level / category / fee / capacity are then left out.
   */
  categories?: TournamentCategoryDto[];
}

/**
 * Every key optional; the kind (internal/external) is fixed at creation —
 * `external` only replaces the block of an external one. `label` / `labelEn`
 * name this category inside its event; categories are added through
 * POST /tournaments/:id/categories, never by an update.
 */
export type UpdateTournamentDto = Partial<Omit<CreateTournamentDto, 'external' | 'categories'>> & {
  external?: TournamentExternal | null;
  label?: string;
  labelEn?: string;
};

// Caps mirrored from the API (tournament.constants.ts).
export const EXTERNAL_REGISTRATION_URL_MAX = 500;
export const EXTERNAL_ORGANIZER_MAX = 120;
export const EXTERNAL_VENUE_NAME_MAX = 160;

export type RegistrationPaymentStatus = 'pay_at_venue' | 'paid' | 'refunded';

export interface TournamentRegistration {
  _id: string;
  tournament: string;
  /** Absent on an entrant the organizer added by hand without an account (docs/33 D7). */
  user?: string;
  /** Who created the row: the player, or the organizer by hand (absent on legacy rows = player). */
  source?: 'player' | 'operator';
  /** Draw seed (1 = top); absent = unseeded. */
  seed?: number;
  /** The partner's account when the partner phone belongs to one. */
  partnerUser?: string;
  status: 'registered' | 'cancelled';
  partnerName?: string;
  /**
   * Doubles partner's phone, E.164 (docs/25 §3) — lets the results dialog
   * rate both members of the pair. Absent on legacy/singles registrations.
   */
  partnerPhone?: string;
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

/**
 * PATCH /tournaments/:id/registrations/:registrationId — empty fields are
 * ignored. `playerName` / `playerPhone` only on an entrant the organizer added
 * by hand (`source: 'operator'`).
 */
export interface UpdateRegistrationDto {
  partnerPhone?: string;
  partnerName?: string;
  playerName?: string;
  playerPhone?: string;
}

/** API bound on `partnerName` (UpdateRegistrationDTO). */
export const PARTNER_NAME_MAX = 120;
