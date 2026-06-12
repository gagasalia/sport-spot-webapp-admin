export enum AcademyStatus {
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
}

export interface Academy {
  _id?: string;
  admins: any[];
  name: string;
  status: AcademyStatus;
  color?: string;
  descriptionGeorgian?: string;
  descriptionEnglish?: string;
  logo?: IMedia;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
}

export interface CreateAcademyDto {
  admins: string[];
  name: string;
}

export interface UpdateAcademyDto {
  name?: string;
  admins?: string[];
  status?: AcademyStatus;
  color?: string;
  descriptionGeorgian?: string;
  descriptionEnglish?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  logo?: IMedia;
}

export interface IMedia {
  url: string;
  type: string;
  size: number;
  metadata?: any;
}
