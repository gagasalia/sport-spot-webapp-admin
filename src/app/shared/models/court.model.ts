export type CourtSportType = 'Padel' | 'Tennis' | 'Football' | 'Basketball' | 'Volleyball';

export type CourtType = 'Indoor' | 'Outdoor' | 'Covered';

export type CourtSurfaceMaterial = 'Clay' | 'Grass' | 'Concrete' | 'Synthetic';

export interface CourtSurface {
  material: CourtSurfaceMaterial;
  color: string;
}

export interface Court {
  id: string;
  locationId: string;
  photos: string[];
  description: string;
  sportType: CourtSportType;
  type: CourtType;
  courtSurface: CourtSurface;
  activeState: boolean;
}
