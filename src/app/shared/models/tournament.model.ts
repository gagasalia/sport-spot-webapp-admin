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

export interface Tournament {
  _id: string;
  academy: string;
  facility: string;
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
  createdAt?: string;
}

export interface CreateTournamentDto {
  facility: string;
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

export type UpdateTournamentDto = Partial<CreateTournamentDto>;

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
  createdAt?: string;
}
