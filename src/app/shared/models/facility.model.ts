import { Day } from '../enums/day.enum';
import { Amenity } from '../enums/amenity.enum';
import { SportType } from '../enums/court-type.enum';

export interface AddressPin {
  lat: number;
  lng: number;
}

export interface WorkingHours {
  day: Day;
  openTime: string; // Format: "HH:mm" (e.g., "09:00")
  closeTime: string; // Format: "HH:mm" (e.g., "22:00")
  isClosed: boolean;
}

// ── API types ────────────────────────────────────────────────────────────────

export interface IMedia {
  url: string;
  type: string;
  size: number;
  metadata?: unknown;
}

/**
 * Per-sport equipment rule (docs/20). Rules are a FACILITY property — venues
 * of one academy can differ (all rackets included vs. all for rent). Wire
 * prices are integer TETRI; the form edits GEL and converts at the edge
 * (money.util). A missing price means that offer doesn't exist.
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

export interface IAddress {
  street?: string;
  lat?: string;
  lng?: string;
  city?: string;
}

export interface IContactInfo {
  email?: string;
  phone?: string;
  address?: IAddress;
  website?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedIn?: string;
}

export interface CreateFacilityDto {
  owner?: string;
  academyId?: string;
  name: string;
  description: string;
  amenities: string[];
  country: string;
  city: string;
  media: IMedia[];
  contactInfo: IContactInfo;
  /** Sending this REPLACES the whole rule set (PUT semantics); omit = keep. */
  sportRules?: SportRule[];
}

export type UpdateFacilityDto = CreateFacilityDto;

// ── Facility entity ───────────────────────────────────────────────────────────

export interface Facility {
  _id?: string;
  id?: string; // kept for localStorage backward compatibility
  name?: string;
  academyId?: string;
  country: string;
  city: string;
  // Legacy fields (localStorage-based form)
  addressPin?: AddressPin;
  addressText?: string;
  photos?: string[];
  rules?: string;
  workingHours?: WorkingHours[];
  courts?: string[];
  // API fields
  media?: IMedia[];
  description: string;
  amenities: (Amenity | string)[];
  contactInfo?: IContactInfo;
  sportRules?: SportRule[];
  activeState?: boolean;
}
