export interface Academy {
  id: string;
  name: string;
  logo?: string;
  color: string;
  description?: string;
  contactInfo: ContactInfo;
  locations?: string[]; // Array of location IDs
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  socials?: SocialMedia;
}

export interface SocialMedia {
  facebook?: string;
  instagram?: string;
}
