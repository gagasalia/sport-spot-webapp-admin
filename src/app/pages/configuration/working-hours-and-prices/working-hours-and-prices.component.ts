import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
  FormControl,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { TuiAlertService, TuiCalendar } from '@taiga-ui/core';
import { type TuiStringHandler, EMPTY_ARRAY, TuiDay } from '@taiga-ui/cdk';
import { type TuiMarkerHandler } from '@taiga-ui/core';
import { TuiInputDateMulti } from '@taiga-ui/kit';
import { SHARED_TAIGA_IMPORTS } from '../../../shared/shared.module';
import { ScheduleService } from '../../../services/http-services/schedule.service';
import { ConfigurationService } from '../../../services/http-services/configuration.service';
import { GeneralScheduleDTO, TimeRangeDTO, Weekday } from '../../../shared/models/schedule.model';
import { Facility } from '../../../shared/models/facility.model';
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
  facilities = signal<Facility[]>([]);
  selectedFacilityId = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  isLoadingFacilities = signal<boolean>(false);

  facilityControl = new FormControl<string | null>(null);

  readonly stringifyFacility: TuiStringHandler<string> = (id) => {
    const facility = this.facilities().find((f) => f.id === id);
    if (!facility) return '';
    return facility.description || facility.addressText || 'უსახელო ობიექტი';
  };

  // Holidays
  holidays: TuiDay[] = [];
  private readonly HOLIDAYS_STORAGE_KEY = 'sportify_holidays';
  private readonly PRICES_STORAGE_KEY = 'sportify_prices';
  private readonly WORKING_DAYS_STORAGE_KEY = 'sportify_working_days';

  // Working days selection
  workingDays: { [key in Day]?: boolean } = {
    [Day.Monday]: true,
    [Day.Tuesday]: true,
    [Day.Wednesday]: true,
    [Day.Thursday]: true,
    [Day.Friday]: true,
    [Day.Saturday]: true,
    [Day.Sunday]: false,
  };

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
    private configurationService: ConfigurationService,
    private alerts: TuiAlertService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Subscribe to form control changes
    this.facilityControl.valueChanges.subscribe((facilityId) => {
      this.onFacilityChange(facilityId);
    });
  }

  ngOnInit(): void {
    this.loadFacilities();
    this.initializePricesForm();
  }

  private loadFacilities(): void {
    this.isLoadingFacilities.set(true);
    this.configurationService
      .getFacilities()
      .pipe(take(1))
      .subscribe({
        next: (facilities) => {
          this.facilities.set(facilities);
          this.isLoadingFacilities.set(false);

          // Handle facility selection based on the query param or number of facilities
          this.route.queryParams.pipe(take(1)).subscribe((params) => {
            const facilityIdFromQuery = params['facilityId'];

            if (facilities.length === 0) {
              // No facilities, do nothing
              this.selectedFacilityId.set(null);
              this.facilityControl.setValue(null, { emitEvent: false });
            } else if (facilities.length === 1) {
              // Exactly 1 facility, auto-select it
              const facility = facilities[0];
              const fId = facility.id ?? null;
              this.selectedFacilityId.set(fId);
              this.facilityControl.setValue(fId, { emitEvent: false });
              // Update query param if not already set
              if (facilityIdFromQuery !== fId) {
                this.updateQueryParam(fId);
              }
              if (fId) this.loadScheduleForFacility(fId);
            } else {
              // More than 1 facility
              if (facilityIdFromQuery) {
                // If there's a query param, use it
                const facility = facilities.find((f) => f.id === facilityIdFromQuery);
                if (facility) {
                  const fId = facility.id ?? null;
                  this.selectedFacilityId.set(fId);
                  this.facilityControl.setValue(fId, { emitEvent: false });
                  if (fId) this.loadScheduleForFacility(fId);
                } else {
                  // Invalid facilityId in query param, clear it
                  this.selectedFacilityId.set(null);
                  this.facilityControl.setValue(null, { emitEvent: false });
                  this.updateQueryParam(null);
                }
              } else {
                // No query param, user needs to select
                this.selectedFacilityId.set(null);
                this.facilityControl.setValue(null, { emitEvent: false });
              }
            }
          });
        },
        error: (error) => {
          console.error('Error loading facilities:', error);
          this.isLoadingFacilities.set(false);
        },
      });
  }

  onFacilityChange(facilityId: string | null): void {
    this.selectedFacilityId.set(facilityId);
    this.updateQueryParam(facilityId);
    if (facilityId) {
      this.loadScheduleForFacility(facilityId);
    } else {
      this.schedule.set(null);
      this.scheduleForm = null!;
    }
  }

  private updateQueryParam(facilityId: string | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { facilityId: facilityId || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  navigateToFacilities(): void {
    this.router.navigate(['/configuration/facilities']);
  }

  private loadScheduleForFacility(facilityId: string): void {
    this.loadSchedule();
    this.loadHolidays(facilityId);
    this.loadPrices(facilityId);
    this.loadWorkingDays(facilityId);
  }

  private loadWorkingDays(facilityId: string): void {
    const stored = localStorage.getItem(`${this.WORKING_DAYS_STORAGE_KEY}_${facilityId}`);
    if (stored) {
      try {
        this.workingDays = JSON.parse(stored);
      } catch (error) {
        console.error('Error loading working days:', error);
      }
    } else {
      // Reset to default values
      this.workingDays = {
        [Day.Monday]: true,
        [Day.Tuesday]: true,
        [Day.Wednesday]: true,
        [Day.Thursday]: true,
        [Day.Friday]: true,
        [Day.Saturday]: true,
        [Day.Sunday]: false,
      };
    }
  }

  onSaveWorkingDays(): void {
    const facilityId = this.selectedFacilityId();
    if (!facilityId) return;

    localStorage.setItem(
      `${this.WORKING_DAYS_STORAGE_KEY}_${facilityId}`,
      JSON.stringify(this.workingDays)
    );

    console.log('Saving working days for facility:', facilityId, this.workingDays);
    this.alerts
      .open('სამუშაო დღეები წარმატებით შეინახა!', { appearance: 'success' })
      .pipe(take(1))
      .subscribe();
  }

  toggleWorkingDay(day: Day): void {
    this.workingDays[day] = !this.workingDays[day];
  }

  private loadHolidays(facilityId: string): void {
    const stored = localStorage.getItem(`${this.HOLIDAYS_STORAGE_KEY}_${facilityId}`);
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
    } else {
      this.holidays = [];
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

  private loadPrices(facilityId: string): void {
    const stored = localStorage.getItem(`${this.PRICES_STORAGE_KEY}_${facilityId}`);
    if (stored) {
      try {
        const prices = JSON.parse(stored);
        this.pricesForm.patchValue(prices);
      } catch (error) {
        console.error('Error loading prices:', error);
      }
    } else {
      // Reset to default values if no data
      this.pricesForm.reset({
        generalPrice: 0,
        offPeakStartHour: 0,
        offPeakStartMinute: 0,
        offPeakEndHour: 0,
        offPeakEndMinute: 0,
        offPeakPrice: 0,
      });
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
    const facilityId = this.selectedFacilityId();
    if (!facilityId) return;

    // Convert TuiDay[] to date strings for local storage
    const holidayDates = this.holidays.map((day) => {
      // Format directly from TuiDay to avoid timezone issues
      const year = day.year;
      const month = (day.month + 1).toString().padStart(2, '0'); // TuiDay month is 0-indexed
      const dayNum = day.day.toString().padStart(2, '0');
      return `${year}-${month}-${dayNum}`; // Format: YYYY-MM-DD
    });

    // Save to localStorage with facility-specific key
    localStorage.setItem(
      `${this.HOLIDAYS_STORAGE_KEY}_${facilityId}`,
      JSON.stringify(holidayDates)
    );

    console.log('Saving holidays for facility:', facilityId, holidayDates);
    this.alerts
      .open('დასვენების დღეები წარმატებით შეინახა!', { appearance: 'success' })
      .pipe(take(1))
      .subscribe();

    // TODO: Implement actual API call when backend is ready
    // this.scheduleService.saveHolidays(facilityId, holidayDates).pipe(take(1)).subscribe({
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
    const facilityId = this.selectedFacilityId();
    if (!facilityId) return;

    if (this.pricesForm.valid) {
      const pricesData = this.pricesForm.value;

      // Save to localStorage with facility-specific key
      localStorage.setItem(`${this.PRICES_STORAGE_KEY}_${facilityId}`, JSON.stringify(pricesData));

      console.log('Saving prices for facility:', facilityId, pricesData);
      this.alerts
        .open('ფასები წარმატებით შეინახა!', { appearance: 'success' })
        .pipe(take(1))
        .subscribe();

      // TODO: Implement actual API call when backend is ready
      // this.scheduleService.savePrices(facilityId, pricesData).pipe(take(1)).subscribe({
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
