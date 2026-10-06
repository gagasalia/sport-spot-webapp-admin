/**
 * Tournament ENGINE shapes for the organizer console (docs/33): the structure
 * an organizer configures, the DRAW VIEW every engine read/write answers with
 * (mirrors sport-spot-api `tournaments/draw-view.util.ts`), the request bodies
 * of the engine routes and the API's bounds + error codes
 * (`models/tournament-engine.constants.ts`).
 */
import type {
  TournamentCategory,
  TournamentFormat,
  TournamentLevel,
  TournamentType,
} from './tournament.model';

// ─── Enums (string unions, as on the wire) ────────────────────────────────────

export type DrawStatus = 'none' | 'draft' | 'published';
export type MatchStage = 'group' | 'knockout' | 'social';
/** pending = a side is still unknown; ready = both known; done = result in. */
export type MatchStatus = 'pending' | 'ready' | 'done';
export type MatchOutcome = 'played' | 'walkover' | 'retired';
export type ScoringType = 'sets' | 'points';
export type Advancement = 'direct' | 'playoff' | 'out';
export type StandingZone = 'direct' | 'playoff' | 'wildcard' | 'out';
/** Mexicano (individual) pairing inside a ranked group of four. */
export type MexicanoPairing = '1-4_2-3' | '1-3_2-4';
export type BestOf = 1 | 3 | 5;
export type DrawStage = 'registration' | 'groups' | 'knockout' | 'social' | 'finished';
export type RegistrationSource = 'player' | 'operator';
export type SideSourceType = 'group' | 'wildcard' | 'winner' | 'loser';

export const MATCH_KIND_THIRD_PLACE = 'third_place';

// ─── Structure (docs/33 §2.1) ─────────────────────────────────────────────────

export interface SetsScoring {
  type: 'sets';
  bestOf: BestOf;
  superTiebreak: boolean;
}

export interface PointsScoring {
  type: 'points';
  /** Both scores add up to this; absent = timed rounds. */
  pointsTarget?: number;
}

export type StageScoring = SetsScoring | PointsScoring;

/** The stored (normalized) structure, as `tournament.structure` / `draw.structure`. */
export interface TournamentStructure {
  scoring: StageScoring;
  /** Bracket scoring of a groups + knockout draw (sets). */
  knockoutScoring?: StageScoring;
  groups?: {
    count: number;
    /** 1 = everyone meets once, 2 = home and away. */
    rounds: number;
    /** What each group position earns; index = position − 1. */
    advancement: Advancement[];
    wildcards: number;
  };
  knockout?: { thirdPlace: boolean };
  social?: { rounds: number; courts: number; pairing: MexicanoPairing };
  rated: boolean;
}

/** PUT /tournaments/:id/structure — missing blocks take the format's defaults. */
export interface StructureDto {
  scoring?: {
    type?: ScoringType;
    bestOf?: number;
    superTiebreak?: boolean;
    /** null = timed rounds (no target). */
    pointsTarget?: number | null;
  };
  knockoutScoring?: { type?: ScoringType; bestOf?: number; superTiebreak?: boolean };
  groups?: { count?: number; rounds?: number; advancement?: Advancement[]; wildcards?: number };
  knockout?: { thirdPlace?: boolean };
  social?: { rounds?: number; courts?: number; pairing?: MexicanoPairing };
  rated?: boolean;
}

// ─── The draw view (docs/33 §5 "The draw view") ───────────────────────────────

export interface EntrantPlayerView {
  name: string;
  avatar?: string;
  userId?: string;
  memberId?: number;
  /** Operator reads only. */
  phone?: string;
}

export interface EntrantView {
  id: string;
  /** "ნინო / ლუკა" for a pair. */
  name: string;
  players: EntrantPlayerView[];
  seed?: number;
}

export interface StandingRowView {
  entrant: string;
  rank: number;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
  zone: StandingZone | null;
}

export interface GroupView {
  key: string;
  entrants: string[];
  standings: StandingRowView[];
  closed: boolean;
}

/** Where a side comes from while it is unknown ("A1", "W1", "winner of …"). */
export interface SideSource {
  type: SideSourceType | string;
  group?: string;
  position?: number;
  rank?: number;
  round?: number;
  order?: number;
}

export interface MatchSideView {
  entrants: string[];
  placeholder?: SideSource;
}

export interface MatchScore {
  type: ScoringType;
  sets?: number[][];
  points?: number[];
}

export interface MatchView {
  id: string;
  stage: MatchStage;
  group?: string;
  round: number;
  order: number;
  kind?: string;
  sides: MatchSideView[];
  status: MatchStatus;
  outcome?: MatchOutcome;
  score?: MatchScore;
  /** 0 | 1, null = a points tie; only on done matches. */
  winner?: number | null;
  court?: string;
  courtId?: string;
  /** ISO instant. */
  scheduledAt?: string;
  rated: boolean;
}

export interface KnockoutRoundView {
  round: number;
  /** 'playin' | 'r64' | 'r32' | 'r16' | 'quarter' | 'semi' | 'final'. */
  name: string;
  /** Tree positions of the round (round 1 may hold fewer matches: byes). */
  slots: number;
  matches: string[];
}

export interface KnockoutView {
  rounds: KnockoutRoundView[];
  thirdPlace: string | null;
}

export interface SocialRoundView {
  round: number;
  matches: string[];
  resting: string[];
}

export interface SocialView {
  rounds: SocialRoundView[];
  leaderboard: StandingRowView[];
  plannedRounds: number;
  canGenerateNext: boolean;
}

export interface PodiumPlace {
  place: number;
  entrants: string[];
}

export interface DrawView {
  structure: TournamentStructure | null;
  status: DrawStatus;
  stage: DrawStage;
  entrants: EntrantView[];
  groups: GroupView[];
  knockout: KnockoutView | null;
  social: SocialView | null;
  matches: MatchView[];
  podium: PodiumPlace[];
}

// ─── Request bodies ───────────────────────────────────────────────────────────

/** POST /tournaments/:id/registrations — an entrant added by hand. */
export interface AddEntrantDto {
  playerName: string;
  playerPhone?: string;
  partnerName?: string;
  partnerPhone?: string;
}

/** PUT /tournaments/:id/seeds — an explicit order (best first) or a method. */
export type SeedsDto = { order: string[] } | { method: 'rating' | 'random' | 'clear' };

/** POST /tournaments/:id/draw/groups/close. */
export interface CloseGroupsDto {
  orders?: Record<string, string[]>;
  force?: boolean;
}

/** PATCH /tournaments/:id/matches/:matchId/result. */
export interface MatchResultDto {
  outcome?: MatchOutcome;
  winner?: 0 | 1;
  sets?: number[][];
  points?: number[];
}

/** PATCH /tournaments/:id/matches/:matchId — null clears a field. */
export interface ScheduleMatchDto {
  court?: string | null;
  courtId?: string | null;
  scheduledAt?: string | null;
}

export interface ScheduleCourtDto {
  name: string;
  courtId?: string;
}

/** Facility-local wall clock: 'YYYY-MM-DD' + 'HH:mm'. */
export interface ScheduleSessionDto {
  date: string;
  from: string;
  to: string;
}

/** POST /tournaments/:id/schedule/auto. */
export interface AutoScheduleDto {
  courts: ScheduleCourtDto[];
  sessions: ScheduleSessionDto[];
  matchMinutes: number;
  onlyUnscheduled?: boolean;
  /** API default: true (every category of the event together). */
  wholeEvent?: boolean;
}

export interface AutoScheduleResult {
  scheduled: number;
  /** Matches that did not fit into the sessions. */
  unplaced: number;
  draw: DrawView;
}

/** POST /tournaments/:id/schedule/shift. */
export interface ShiftScheduleDto {
  minutes: number;
  from?: string;
  wholeEvent?: boolean;
}

/** One category of a multi-category event (POST /tournaments, POST …/categories). */
export interface TournamentCategoryDto {
  label?: string;
  labelEn?: string;
  type: TournamentType;
  format: TournamentFormat;
  level?: TournamentLevel;
  category?: TournamentCategory;
  entryFeeTetri: number;
  maxParticipants: number;
}

/** GET /tournaments/venues — where the caller may host. */
export interface TournamentVenue {
  _id: string;
  name: string;
  nameEn?: string;
  city?: string;
}

/** GET /tournaments/:id/courts — the host facility's courts. */
export interface TournamentCourt {
  _id: string;
  name: string;
  nameEn?: string;
}

// ─── Bounds (tournament-engine.constants.ts) ──────────────────────────────────

export const GROUPS_MAX = 16;
export const GROUP_POSITIONS_MAX = 8;
export const WILDCARDS_MAX = 8;
export const SOCIAL_ROUNDS_MAX = 30;
export const SOCIAL_COURTS_MAX = 12;
export const POINTS_TARGET_MIN = 8;
export const POINTS_TARGET_MAX = 64;
export const DEFAULT_POINTS_TARGET = 24;
/** Individual americano / mexicano needs a full court. */
export const SOCIAL_INDIVIDUAL_MIN = 4;
export const MATCH_MINUTES_MIN = 10;
export const MATCH_MINUTES_MAX = 240;
export const SCHEDULE_SESSIONS_MAX = 14;
export const SCHEDULE_COURTS_MAX = 24;
export const COURT_NAME_MAX = 60;
export const PLAYER_NAME_MAX = 120;
/** create-tournament.dto.ts */
export const CATEGORY_LABEL_MAX = 60;
export const EVENT_CATEGORIES_MAX = 12;
/** A retired match's partial set score: whole numbers 0…99. */
export const PARTIAL_GAMES_MAX = 99;

// ─── Error codes (the `<code>: <text>` prefix of a 400 / 409 message) ─────────

export const ERR_NO_STRUCTURE = 'structure_required';
export const ERR_DRAW_EXISTS = 'draw_exists';
export const ERR_NO_DRAW = 'draw_required';
export const ERR_DRAW_HAS_RESULTS = 'draw_has_results';
export const ERR_NOT_ENOUGH_ENTRANTS = 'not_enough_entrants';
export const ERR_MATCH_NOT_READY = 'match_not_ready';
export const ERR_DOWNSTREAM_RESULT = 'downstream_has_result';
export const ERR_GROUPS_CLOSED = 'groups_closed';
export const ERR_GROUPS_PENDING = 'group_matches_pending';
export const ERR_GROUPS_NOT_CLOSED = 'groups_not_closed';
export const ERR_ROUND_PENDING = 'round_matches_pending';
export const ERR_INVALID_RESULT = 'invalid_result';
export const ERR_INVALID_STRUCTURE = 'invalid_structure';
export const ERR_SWAP_NOT_ALLOWED = 'swap_not_allowed';
