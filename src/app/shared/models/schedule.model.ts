// time within a day, in local facility time
export interface TimeRangeDTO {
  start: string; // "HH:mm", e.g. "09:30"
  end: string; // "HH:mm", e.g. "22:00"
}

// 0 = Monday, 6 = Sunday
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type WeeklyHoursDTO = Record<Weekday, TimeRangeDTO[]>;

export interface HolidayDTO {
  _id?: string; // server subdocument id
  date: string; // "YYYY-MM-DD" in facility local date
  reason?: string; // "New Year", "Renovation" etc
  isClosed: boolean; // true = fully closed
  timeRanges?: TimeRangeDTO[]; // optional special hours; ignored if isClosed = true
  isRecurring?: boolean; // true if every year on this month/day
}

/**
 * Pricing block. Prices are integer **tetri** (1 GEL = 100 tetri) on the wire —
 * the working-hours page converts GEL ↔ tetri at the UI edge.
 */
export interface PricingDTO {
  currency: 'GEL';
  generalPriceTetri: number;
  offPeak?: {
    start: string; // "HH:mm"
    end: string; // "HH:mm"
    priceTetri: number;
  };
}

/**
 * One schedule document per facility (1:1), as returned by
 * `GET /facilities/:facilityId/schedule`.
 */
export interface FacilityScheduleDTO {
  _id?: string;
  facility?: string;
  facilityId?: string; // legacy alias
  academy?: string;
  timezone: string; // e.g. "Asia/Tbilisi"
  slotDurationMinutes?: number;
  weeklyHours: WeeklyHoursDTO;
  holidays: HolidayDTO[];
  pricing?: PricingDTO;
}

/** Body for PUT /facilities/:facilityId/schedule (hours upsert). */
export interface UpdateScheduleDTO {
  timezone?: string;
  slotDurationMinutes?: number;
  weeklyHours: WeeklyHoursDTO;
}
