export interface Academy {
  _id?: string;
  owner: string;
  name: string;
  designPalette: string;
  description: string;
  logo?: IMedia;
  contactInfo?: IContactInfo;
}

export interface CreateAcademyDto {
  owner: string;
  name: string;
  designPalette: string;
  description: string;
  logo: IMedia;
  contactInfo: IContactInfo;
}

export interface UpdateAcademyDto {
  name: string;
  designPalette: string;
  description: string;
  logo: IMedia;
  contactInfo: IContactInfo;
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
