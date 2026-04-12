export enum AcademyStatus {
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
}

export interface Academy {
  _id?: string;
  admins: any[];
  name: string;
  status: AcademyStatus;
  designPalette: string;
  description: string;
  logo?: IMedia;
  contactInfo?: IContactInfo;
}

export interface CreateAcademyDto {
  admins: string[];
  name: string;
  status?: string;
}

export interface UpdateAcademyDto {
  name: string;
  admins?: string[];
  status?: string;
}

export interface IMedia {
  url: string;
  type: string;
  size: number;
  metadata?: any;
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

export interface IAddress {
  street?: string;
  lng?: string;
  lat?: string;
  city?: string;
}
