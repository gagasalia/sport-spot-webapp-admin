// time within a day, in local facility time
export interface TimeRangeDTO {
  start: string; // "HH:mm", e.g. "09:30"
  end: string; // "HH:mm", e.g. "22:00"
}

// 0 = Monday, 6 = Sunday
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type WeeklyHoursDTO = {
  [day in Weekday]: TimeRangeDTO[];
};

export interface HolidayDTO {
  date: string; // "YYYY-MM-DD" in facility local date
  reason?: string; // "New Year", "Renovation" etc
  isClosed: boolean; // true = fully closed
  timeRanges?: TimeRangeDTO[]; // optional special hours; ignored if isClosed = true
  isRecurring?: boolean; // true if every year on this month/day
}

export interface FacilityScheduleDTO {
  facilityId: string;
  timezone: string; // e.g. "Asia/Tbilisi"
  weeklyHours: WeeklyHoursDTO;
  holidays: HolidayDTO[];
}

// General schedule that applies to all facilities
export interface GeneralScheduleDTO {
  id: string;
  timezone: string; // e.g. "Asia/Tbilisi"
  weeklyHours: WeeklyHoursDTO;
  holidays: HolidayDTO[];
}
