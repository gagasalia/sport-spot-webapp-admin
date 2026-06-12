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

/**
 * Court entity as returned by the API.
 *
 * The backend contract is:
 * `{ _id, facility, academy, courtNumber, sportType, locationType,
 *    surface: { material, color }, activeState }`.
 *
 * The admin UI historically used a flatter shape (`id`, `facilityId`, `type`,
 * `courtSurface`). The legacy aliases are kept optional for backward
 * compatibility while components are migrated, but new code should read/write
 * the API field names.
 */
export interface Court {
  _id?: string;
  facility?: string; // ObjectId ref Facility (API)
  academy?: string; // ObjectId ref Academy (API, denormalized)
  courtNumber: number;
  sportType: SportType;
  locationType?: CourtLocationType; // Indoor / Outdoor / Covered (API)
  surface?: CourtSurface; // API surface shape
  activeState: boolean;

  // ── Legacy aliases (pre-API admin shape) ────────────────────────────────────
  id?: string;
  facilityId?: string;
  type?: CourtLocationType;
  courtSurface?: CourtSurface;
}

/** Body for POST /facilities/:facilityId/courts */
export interface CreateCourtDto {
  courtNumber: number;
  sportType: SportType;
  locationType: CourtLocationType;
  surface: CourtSurface;
  activeState?: boolean;
}

export type UpdateCourtDto = Partial<CreateCourtDto>;
