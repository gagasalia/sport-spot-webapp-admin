/**
 * Chart-ready response shapes of the /statistics endpoints. All money is
 * integer tetri (1 GEL = 100); rates are 0..1 fractions or null when the
 * denominator is empty; buckets are 'YYYY-MM-DD' (day/week start) or
 * 'YYYY-MM' (month) strings.
 */

export type StatsGranularity = 'day' | 'week' | 'month';

export interface StatsQuery {
  from: string;
  to: string;
  academyId?: string;
  facilityId?: string;
  courtId?: string;
  sportType?: string;
  granularity?: StatsGranularity;
}

export interface OverviewSummary {
  occupancy: number | null;
  netRevenueTetri: number;
  totalBookings: number;
  cancelRate: number | null;
  newUsers: number;
  returningUsers: number;
}

export interface StatsOverview {
  current: OverviewSummary;
  previous: OverviewSummary;
  previousRange: { from: string; to: string };
}

export interface OccupancyCourtRow {
  courtId: string;
  courtName: string;
  courtNameEn?: string;
  sportType: string;
  facilityId: string;
  facilityName: string;
  bookedMinutes: number;
  blockedMinutes: number;
  availableMinutes: number;
  occupancy: number | null;
}

export interface OccupancyRollupRow {
  facilityId: string;
  facilityName: string;
  bookedMinutes: number;
  availableMinutes: number;
  occupancy: number | null;
}

export interface StatsOccupancy {
  courts: OccupancyCourtRow[];
  facilities: OccupancyRollupRow[];
  total: {
    bookedMinutes: number;
    availableMinutes: number;
    occupancy: number | null;
  };
}

export interface StatsHeatmap {
  /** Sparse cells; dow is Monday=0 … Sunday=6, hour is facility-local 0–23. */
  cells: { dow: number; hour: number; count: number }[];
  max: number;
}

export interface RevenueSeriesPoint {
  bucket: string;
  capturedTetri: number;
  refundedTetri: number;
  netTetri: number;
}

export interface StatsRevenue {
  series: RevenueSeriesPoint[];
  byFacility: { facilityId: string; facilityName: string; netTetri: number }[];
  bySport: { sportType: string; netTetri: number }[];
  byHour: { hour: number; netTetri: number }[];
  totals: { capturedTetri: number; refundedTetri: number; netTetri: number };
}

export type UserSegmentKey = 'casual' | 'regular' | 'power';

export interface StatsUsers {
  totals: {
    activeUsers: number;
    newUsers: number;
    returningUsers: number;
    retentionRate: number | null;
    medianBookingsPerUser: number | null;
    arpuTetri: number | null;
    ltvTetri: number | null;
  };
  trend: { bucket: string; newUsers: number; returningUsers: number }[];
  segments: {
    key: UserSegmentKey;
    users: number;
    netTetri: number;
    revenueShare: number | null;
  }[];
}

export interface StatsCancellations {
  perFacility: {
    facilityId: string;
    facilityName: string;
    total: number;
    cancelled: number;
    noShow: number;
    cancelRate: number | null;
    noShowRate: number | null;
  }[];
  trend: { bucket: string; total: number; cancelled: number; noShow: number }[];
  leadBuckets: { key: string; count: number }[];
  totals: {
    total: number;
    cancelled: number;
    noShow: number;
    cancelRate: number | null;
    noShowRate: number | null;
  };
}
