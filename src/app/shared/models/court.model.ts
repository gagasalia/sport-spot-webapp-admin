import {
  SportType,
  CourtLocationType,
  SurfaceMaterial,
  SurfaceColor,
} from '../enums/court-type.enum';

export interface CourtSurface {
  material: SurfaceMaterial;
  color: SurfaceColor;
}

export interface Court {
  id: string;
  facilityId: string; // Foreign key to Facility
  courtNumber: number; // Court number (e.g., 1, 2, 3)
  sportType: SportType;
  type: CourtLocationType; // Indoor / Outdoor / Covered
  courtSurface: CourtSurface;
  activeState: boolean;
}
