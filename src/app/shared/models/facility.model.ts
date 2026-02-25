import { Day } from '../enums/day.enum';
import { Amenity } from '../enums/amenity.enum';

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
  tenantId?: string;
  name: string;
  description: string;
  amenities: string[];
  country: string;
  city: string;
  media: IMedia[];
  contactInfo: IContactInfo;
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
  activeState?: boolean;
}
