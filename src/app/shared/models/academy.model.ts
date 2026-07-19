import { User } from './user.model';
import { SportType } from '../enums/court-type.enum';

export enum AcademyStatus {
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
}

/**
 * Per-sport equipment rule (docs/20). Wire prices are integer TETRI; the form
 * edits GEL and converts at the edge (money.util). A missing price means that
 * offer doesn't exist (rent/sale not available).
 */
export interface SportRule {
  sportType: SportType;
  /** Rackets included in the court price (padel: 0..4 of the 4 a game needs). */
  racketsIncluded: number;
  /** Rent per EXTRA racket per game (duration-flat), integer tetri. */
  racketRentTetri?: number;
  /** Sale price per new-balls unit, integer tetri. */
  ballsPriceTetri?: number;
}

export interface Academy {
  _id?: string;
  // The API may return admins as raw id strings or fully populated User docs.
  admins: (string | User)[];
  name: string;
  status: AcademyStatus;
  descriptionGeorgian?: string;
  descriptionEnglish?: string;
  logo?: IMedia;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  sportRules?: SportRule[];
}

export interface CreateAcademyDto {
  admins: string[];
  name: string;
}

export interface UpdateAcademyDto {
  name?: string;
  admins?: string[];
  status?: AcademyStatus;
  descriptionGeorgian?: string;
  descriptionEnglish?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  logo?: IMedia;
  /** Sending this REPLACES the whole rule set (PUT semantics); omit = keep. */
  sportRules?: SportRule[];
}

export interface IMedia {
  url: string;
  type: string;
  size: number;
  metadata?: Record<string, unknown>;
}
