import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { take } from 'rxjs';
import { TuiAlertService, TuiCalendar } from '@taiga-ui/core';
import { type TuiStringHandler, EMPTY_ARRAY, TuiDay } from '@taiga-ui/cdk';
import { type TuiMarkerHandler } from '@taiga-ui/core';
import { TuiInputDateMulti } from '@taiga-ui/kit';
import { SHARED_TAIGA_IMPORTS } from '../../../shared/shared.module';
import { ScheduleService } from '../../../services/http-services/schedule.service';
import { GeneralScheduleDTO, TimeRangeDTO, Weekday } from '../../../shared/models/schedule.model';
import { Day, DAY_LABELS } from '../../../shared/enums/day.enum';

@Component({
  selector: 'app-working-hours-and-prices',
  standalone: true,
  imports: [
    ...SHARED_TAIGA_IMPORTS,
    ReactiveFormsModule,
    CommonModule,
    FormsModule,
    TuiInputDateMulti,
    TuiCalendar,
  ],
  templateUrl: './working-hours-and-prices.component.html',
  styleUrls: ['./working-hours-and-prices.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkingHoursAndPricesComponent implements OnInit {
  scheduleForm!: FormGroup;
  pricesForm!: FormGroup;
  schedule = signal<GeneralScheduleDTO | null>(null);
  isLoading = signal<boolean>(false);

  // Holidays
  holidays: TuiDay[] = [];
  private readonly HOLIDAYS_STORAGE_KEY = 'sportify_holidays';
  private readonly PRICES_STORAGE_KEY = 'sportify_prices';

  readonly markerHandler: TuiMarkerHandler = (day: TuiDay) =>
    this.holidays.some((holiday) => holiday.daySame(day))
      ? ['var(--tui-status-negative)']
      : EMPTY_ARRAY;

  // Group days: Weekdays (Mon-Fri), Saturday, Sunday
  readonly dayGroups = [
    {
      key: 'weekdays',
      label: 'კვირის დღეები',
      days: [Day.Monday, Day.Tuesday, Day.Wednesday, Day.Thursday, Day.Friday],
    },
    { key: 'saturday', label: 'შაბათი', days: [Day.Saturday] },
    { key: 'sunday', label: 'კვირა', days: [Day.Sunday] },
  ];

  readonly days = [
    Day.Monday,
    Day.Tuesday,
    Day.Wednesday,
    Day.Thursday,
    Day.Friday,
    Day.Saturday,
    Day.Sunday,
  ];
  readonly dayLabels = DAY_LABELS;

  // Hour options: 00 to 23
  readonly hours = Array.from({ length: 24 }, (_, i) => i);
  // Minute options: 00 or 30
  readonly minutes = [0, 30];

  readonly stringifyHour: TuiStringHandler<number> = (hour) => hour.toString().padStart(2, '0');
  readonly stringifyMinute: TuiStringHandler<number> = (minute) =>
    minute.toString().padStart(2, '0');

  constructor(
    private fb: FormBuilder,
    private scheduleService: ScheduleService,
    private alerts: TuiAlertService
  ) {}

  ngOnInit(): void {
    this.loadSchedule();
    this.loadHolidays();
    this.initializePricesForm();
    this.loadPrices();
  }

  private loadHolidays(): void {
    const stored = localStorage.getItem(this.HOLIDAYS_STORAGE_KEY);
    if (stored) {
      try {
        const dates: string[] = JSON.parse(stored);
        this.holidays = dates.map((dateStr) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return new TuiDay(year, month - 1, day);
        });
      } catch (error) {
        console.error('Error loading holidays:', error);
      }
    }
  }

  private initializePricesForm(): void {
    this.pricesForm = this.fb.group({
      generalPrice: [0, [Validators.required, Validators.min(0)]],
      offPeakStartHour: [0, Validators.required],
      offPeakStartMinute: [0, Validators.required],
      offPeakEndHour: [0, Validators.required],
      offPeakEndMinute: [0, Validators.required],
      offPeakPrice: [0, [Validators.required, Validators.min(0)]],
    });
  }

  private loadPrices(): void {
    const stored = localStorage.getItem(this.PRICES_STORAGE_KEY);
    if (stored) {
      try {
        const prices = JSON.parse(stored);
        this.pricesForm.patchValue(prices);
      } catch (error) {
        console.error('Error loading prices:', error);
      }
    }
  }

  private loadSchedule(): void {
    this.isLoading.set(true);
    this.scheduleService
      .getGeneralSchedule()
      .pipe(take(1))
      .subscribe({
        next: (schedule) => {
          this.schedule.set(schedule);
          this.initializeForm(schedule);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading schedule:', error);
          this.isLoading.set(false);
          this.alerts
            .open('შეცდომა გრაფიკის ჩატვირთვისას', { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  private initializeForm(schedule: GeneralScheduleDTO): void {
    const formGroups: any = {};

    // Initialize weekdays group (Monday to Friday with same time)
    const weekdayRange = schedule.weeklyHours[Day.Monday as Weekday]?.[0] || {
      start: '09:00',
      end: '22:00',
    };
    const [weekdayStartHour, weekdayStartMinute] = weekdayRange.start.split(':').map(Number);
    const [weekdayEndHour, weekdayEndMinute] = weekdayRange.end.split(':').map(Number);

    formGroups['weekdays'] = this.fb.group({
      startHour: [weekdayStartHour, Validators.required],
      startMinute: [weekdayStartMinute, Validators.required],
      endHour: [weekdayEndHour, Validators.required],
      endMinute: [weekdayEndMinute, Validators.required],
    });

    // Initialize Saturday
    const saturdayRange = schedule.weeklyHours[Day.Saturday as Weekday]?.[0] || {
      start: '09:00',
      end: '22:00',
    };
    const [satStartHour, satStartMinute] = saturdayRange.start.split(':').map(Number);
    const [satEndHour, satEndMinute] = saturdayRange.end.split(':').map(Number);

    formGroups['saturday'] = this.fb.group({
      startHour: [satStartHour, Validators.required],
      startMinute: [satStartMinute, Validators.required],
      endHour: [satEndHour, Validators.required],
      endMinute: [satEndMinute, Validators.required],
    });

    // Initialize Sunday
    const sundayRange = schedule.weeklyHours[Day.Sunday as Weekday]?.[0] || {
      start: '09:00',
      end: '22:00',
    };
    const [sunStartHour, sunStartMinute] = sundayRange.start.split(':').map(Number);
    const [sunEndHour, sunEndMinute] = sundayRange.end.split(':').map(Number);

    formGroups['sunday'] = this.fb.group({
      startHour: [sunStartHour, Validators.required],
      startMinute: [sunStartMinute, Validators.required],
      endHour: [sunEndHour, Validators.required],
      endMinute: [sunEndMinute, Validators.required],
    });

    this.scheduleForm = this.fb.group(formGroups);
  }

  onSave(): void {
    if (this.scheduleForm.valid) {
      const formValue = this.scheduleForm.value;
      const weeklyHours: any = {};

      // Map weekdays (Mon-Fri) to backend
      const weekdaysValue = formValue.weekdays;
      const weekdaysStart = `${weekdaysValue.startHour
        .toString()
        .padStart(2, '0')}:${weekdaysValue.startMinute.toString().padStart(2, '0')}`;
      const weekdaysEnd = `${weekdaysValue.endHour
        .toString()
        .padStart(2, '0')}:${weekdaysValue.endMinute.toString().padStart(2, '0')}`;

      [Day.Monday, Day.Tuesday, Day.Wednesday, Day.Thursday, Day.Friday].forEach((day) => {
        weeklyHours[day] = [{ start: weekdaysStart, end: weekdaysEnd }];
      });

      // Map Saturday
      const saturdayValue = formValue.saturday;
      const saturdayStart = `${saturdayValue.startHour
        .toString()
        .padStart(2, '0')}:${saturdayValue.startMinute.toString().padStart(2, '0')}`;
      const saturdayEnd = `${saturdayValue.endHour
        .toString()
        .padStart(2, '0')}:${saturdayValue.endMinute.toString().padStart(2, '0')}`;
      weeklyHours[Day.Saturday] = [{ start: saturdayStart, end: saturdayEnd }];

      // Map Sunday
      const sundayValue = formValue.sunday;
      const sundayStart = `${sundayValue.startHour
        .toString()
        .padStart(2, '0')}:${sundayValue.startMinute.toString().padStart(2, '0')}`;
      const sundayEnd = `${sundayValue.endHour.toString().padStart(2, '0')}:${sundayValue.endMinute
        .toString()
        .padStart(2, '0')}`;
      weeklyHours[Day.Sunday] = [{ start: sundayStart, end: sundayEnd }];

      this.isLoading.set(true);
      this.scheduleService
        .updateWeeklyHours(weeklyHours)
        .pipe(take(1))
        .subscribe({
          next: (updatedSchedule) => {
            this.schedule.set(updatedSchedule);
            this.isLoading.set(false);
            this.alerts
              .open('გრაფიკი წარმატებით შეინახა!', { appearance: 'success' })
              .pipe(take(1))
              .subscribe();
          },
          error: (error) => {
            console.error('Error saving schedule:', error);
            this.isLoading.set(false);
            this.alerts
              .open('შეცდომა გრაფიკის შენახვისას', { appearance: 'error' })
              .pipe(take(1))
              .subscribe();
          },
        });
    }
  }

  onSaveHolidays(): void {
    // Convert TuiDay[] to date strings for local storage
    const holidayDates = this.holidays.map((day) => {
      const date = day.toLocalNativeDate();
      return date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    });

    // Save to localStorage
    localStorage.setItem(this.HOLIDAYS_STORAGE_KEY, JSON.stringify(holidayDates));

    console.log('Saving holidays:', holidayDates);
    this.alerts
      .open('დასვენების დღეები წარმატებით შეინახა!', { appearance: 'success' })
      .pipe(take(1))
      .subscribe();

    // TODO: Implement actual API call when backend is ready
    // this.scheduleService.saveHolidays(holidayDates).pipe(take(1)).subscribe({
    //   next: () => {
    //     this.alerts.open('დასვენების დღეები წარმატებით შეინახა!', { appearance: 'success' }).pipe(take(1)).subscribe();
    //   },
    //   error: (error) => {
    //     console.error('Error saving holidays:', error);
    //     this.alerts.open('შეცდომა დასვენების დღეების შენახვისას', { appearance: 'error' }).pipe(take(1)).subscribe();
    //   },
    // });
  }

  onSavePrices(): void {
    if (this.pricesForm.valid) {
      const pricesData = this.pricesForm.value;

      // Save to localStorage
      localStorage.setItem(this.PRICES_STORAGE_KEY, JSON.stringify(pricesData));

      console.log('Saving prices:', pricesData);
      this.alerts
        .open('ფასები წარმატებით შეინახა!', { appearance: 'success' })
        .pipe(take(1))
        .subscribe();

      // TODO: Implement actual API call when backend is ready
      // this.scheduleService.savePrices(pricesData).pipe(take(1)).subscribe({
      //   next: () => {
      //     this.alerts.open('ფასები წარმატებით შეინახა!', { appearance: 'success' }).pipe(take(1)).subscribe();
      //   },
      //   error: (error) => {
      //     console.error('Error saving prices:', error);
      //     this.alerts.open('შეცდომა ფასების შენახვისას', { appearance: 'error' }).pipe(take(1)).subscribe();
      //   },
      // });
    }
  }
}
