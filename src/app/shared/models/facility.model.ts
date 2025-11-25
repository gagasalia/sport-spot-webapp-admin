import { City } from '../enums/city.enum';
import { Country } from '../enums/country.enum';
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

export interface Facility {
  id: string;
  academyId: string; // Foreign key to Academy
  country: Country;
  city: City;
  addressPin: AddressPin; // GPS coordinates
  addressText: string; // Street name, building number, etc.
  photos: string[]; // Array of image URLs
  description: string;
  amenities: Amenity[]; // Facility amenities using predefined enum values
  rules: string; // Free text or HTML block
  workingHours: WorkingHours[]; // Per day schedule
  courts: string[]; // Array of Court IDs (one-to-many relationship)
  activeState: boolean;
}
