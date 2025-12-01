import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import {
  GeneralScheduleDTO,
  WeeklyHoursDTO,
  HolidayDTO,
  Weekday,
} from '../../shared/models/schedule.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root',
})
export class ScheduleService {
  private readonly SCHEDULE_STORAGE_KEY = 'sportify_general_schedule';

  constructor() {}

  private getScheduleFromStorage(): GeneralScheduleDTO | null {
    const stored = localStorage.getItem(this.SCHEDULE_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  }

  private saveScheduleToStorage(schedule: GeneralScheduleDTO): void {
    try {
      localStorage.setItem(this.SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
    } catch (error) {
      console.error('Failed to save schedule to localStorage:', error);
    }
  }

  private getDefaultSchedule(): GeneralScheduleDTO {
    // Create default weekly hours (9:00 - 22:00 for all days)
    const defaultTimeRange = [{ start: '09:00', end: '22:00' }];
    const weeklyHours: WeeklyHoursDTO = {
      0: [...defaultTimeRange], // Monday
      1: [...defaultTimeRange], // Tuesday
      2: [...defaultTimeRange], // Wednesday
      3: [...defaultTimeRange], // Thursday
      4: [...defaultTimeRange], // Friday
      5: [...defaultTimeRange], // Saturday
      6: [...defaultTimeRange], // Sunday
    };

    return {
      id: uuidv4(),
      timezone: 'Asia/Tbilisi',
      weeklyHours,
      holidays: [],
    };
  }

  getGeneralSchedule(): Observable<GeneralScheduleDTO> {
    let schedule = this.getScheduleFromStorage();

    // If no schedule exists, create and save default
    if (!schedule) {
      schedule = this.getDefaultSchedule();
      this.saveScheduleToStorage(schedule);
    }

    return of(schedule).pipe(delay(300));
  }

  updateGeneralSchedule(schedule: Partial<GeneralScheduleDTO>): Observable<GeneralScheduleDTO> {
    let currentSchedule = this.getScheduleFromStorage();

    if (!currentSchedule) {
      currentSchedule = this.getDefaultSchedule();
    }

    const updatedSchedule = {
      ...currentSchedule,
      ...schedule,
      id: currentSchedule.id, // Preserve ID
    };

    this.saveScheduleToStorage(updatedSchedule);
    return of(updatedSchedule).pipe(delay(300));
  }

  updateWeeklyHours(weeklyHours: WeeklyHoursDTO): Observable<GeneralScheduleDTO> {
    return this.updateGeneralSchedule({ weeklyHours });
  }

  addHoliday(holiday: HolidayDTO): Observable<GeneralScheduleDTO> {
    const schedule = this.getScheduleFromStorage();
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const updatedHolidays = [...schedule.holidays, holiday];
    return this.updateGeneralSchedule({ holidays: updatedHolidays });
  }

  updateHoliday(index: number, holiday: HolidayDTO): Observable<GeneralScheduleDTO> {
    const schedule = this.getScheduleFromStorage();
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const updatedHolidays = [...schedule.holidays];
    updatedHolidays[index] = holiday;
    return this.updateGeneralSchedule({ holidays: updatedHolidays });
  }

  deleteHoliday(index: number): Observable<GeneralScheduleDTO> {
    const schedule = this.getScheduleFromStorage();
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const updatedHolidays = schedule.holidays.filter((_, i) => i !== index);
    return this.updateGeneralSchedule({ holidays: updatedHolidays });
  }

  resetToDefault(): Observable<GeneralScheduleDTO> {
    const defaultSchedule = this.getDefaultSchedule();
    this.saveScheduleToStorage(defaultSchedule);
    return of(defaultSchedule).pipe(delay(300));
  }
}
