import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  Injector,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, of, take } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TuiAlertService } from '@taiga-ui/core';
import { type TuiStringHandler, TuiDay } from '@taiga-ui/cdk';
import { TuiInputDate } from '@taiga-ui/kit/components/input-date';
import { TUI_CONFIRM, type TuiConfirmData } from '@taiga-ui/kit';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { TuiDialogService } from '@taiga-ui/experimental';
import { SHARED_TAIGA_IMPORTS } from '../../shared/shared.module';
import { BookingService } from '../../services/http-services/booking.service';
import { CourtService } from '../../services/http-services/court.service';
import { FacilityService } from '../../services/http-services/facility.service';
import { TenantService } from '../../shared/services/tenant.service';
import { tetriToGel } from '../../shared/utils/money.util';
import { Court } from '../../shared/models/court.model';
import { Facility } from '../../shared/models/facility.model';
import {
  AvailabilityByCourt,
  Booking,
  BookingStatus,
} from '../../shared/models/booking.model';
import {
  DayGrid,
  GridCell,
  GridCourt,
  WeekDayData,
  WeekGrid,
  buildDayGrid,
  buildWeekGrid,
} from './calendar-grid';
import {
  isoToTuiDay,
  shiftIso,
  todayIso,
  tuiDayToIso,
  weekDates,
} from './calendar-date.util';
import {
  BookingDialogComponent,
  BookingDialogData,
  SlotOption,
} from './booking-dialog/booking-dialog.component';

type CalendarTab = 'day' | 'week' | 'list';

/**
 * Operator calendar (Phase 4, design §5). Resurrects the `/reservations` nav
 * item. Day view is the primary surface: a CSS-grid table of active courts ×
 * the facility's slot grid. Week view (one court × 7 days) and a filtered list
 * view are secondary tabs. All grid math lives in the pure `calendar-grid`
 * module; this component owns I/O, state signals and the create/cancel/pay flows.
 */
@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [
    ...SHARED_TAIGA_IMPORTS,
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ...TuiInputDate,
  ],
  templateUrl: './reservations.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationsComponent implements OnInit {
  private readonly bookingService = inject(BookingService);
  private readonly courtService = inject(CourtService);
  private readonly facilityService = inject(FacilityService);
  private readonly tenant = inject(TenantService);
  private readonly alerts = inject(TuiAlertService);
  private readonly dialogs = inject(TuiDialogService);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // ── selection / facility state ───────────────────────────────────────────────
  readonly facilities = signal<Facility[]>([]);
  readonly courts = signal<Court[]>([]);
  readonly selectedFacilityId = signal<string | null>(null);
  readonly facilityControl = new FormControl<string | null>(null);

  readonly tab = signal<CalendarTab>('day');
  readonly isMobile = signal(false);

  // ── day view state ───────────────────────────────────────────────────────────
  readonly selectedDate = signal<string>(todayIso());
  // Nullable + non-null-asserted initial TuiDay so the TuiInputDate control
  // accessor renders the selected date (today by default) in the textfield —
  // previously typed as `FormControl<TuiDay>`, which left the field blank.
  readonly dateControl = new FormControl<TuiDay | null>(isoToTuiDay(todayIso()));
  readonly dayBookings = signal<Booking[]>([]);
  readonly dayAvailability = signal<AvailabilityByCourt>({});

  // ── week view state ──────────────────────────────────────────────────────────
  readonly selectedCourtId = signal<string | null>(null);
  // A real reactive control backs the week / mobile court selectors so the
  // selected court number renders in the textfield (via `stringifyCourt`). A
  // one-way `[ngModel]` left the field blank; `[formControl]` + the textfield
  // `[stringify]` reliably shows the value, mirroring the facility selector.
  readonly courtControl = new FormControl<string | null>(null);
  readonly weekData = signal<WeekDayData[]>([]);

  // ── list view state ──────────────────────────────────────────────────────────
  readonly listBookings = signal<Booking[]>([]);
  readonly listTotal = signal<number>(0);
  /** One-based page index (matches the `/um/find` + `result.page` convention). */
  readonly listPage = signal<number>(1);
  readonly listLimit = 20;
  readonly listFrom = new FormControl<TuiDay | null>(null);
  readonly listTo = new FormControl<TuiDay | null>(null);
  readonly listCourt = new FormControl<string | null>(null);
  readonly listStatus = new FormControl<BookingStatus | null>(null);

  // ── ui state ─────────────────────────────────────────────────────────────────
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  // ── derived ──────────────────────────────────────────────────────────────────
  /** Active courts only, ordered by court number — the day-grid column axis. */
  readonly activeCourts = computed<GridCourt[]>(() =>
    this.courts()
      .filter((c) => c.activeState)
      .map((c) => ({
        id: c._id ?? c.id ?? '',
        courtNumber: c.courtNumber,
        label: `კორტი ${c.courtNumber}`,
      }))
      .sort((a, b) => a.courtNumber - b.courtNumber),
  );

  /** On mobile the day view shows a single court; default to the first active one. */
  readonly visibleDayCourts = computed<GridCourt[]>(() => {
    const all = this.activeCourts();
    if (!this.isMobile()) return all;
    const selected = this.selectedCourtId();
    const one = all.find((c) => c.id === selected) ?? all[0];
    return one ? [one] : [];
  });

  readonly dayGrid = computed<DayGrid>(() =>
    buildDayGrid(this.visibleDayCourts(), this.dayAvailability(), this.dayBookings()),
  );

  readonly weekGrid = computed<WeekGrid>(() => {
    const courtId = this.selectedCourtId();
    if (!courtId) return { days: [], rows: [] };
    return buildWeekGrid(courtId, this.weekData());
  });

  readonly statusOptions: BookingStatus[] = ['confirmed', 'cancelled', 'completed'];

  readonly statusLabels: Record<BookingStatus, string> = {
    confirmed: 'დადასტურებული',
    cancelled: 'გაუქმებული',
    completed: 'დასრულებული',
  };

  private facilityIdOf(f: Facility): string | null {
    return f._id ?? f.id ?? null;
  }

  readonly stringifyFacility: TuiStringHandler<string> = (id) => {
    const facility = this.facilities().find((f) => this.facilityIdOf(f) === id);
    if (!facility) return '';
    return facility.name || facility.description || 'უსახელო ობიექტი';
  };

  readonly stringifyCourt: TuiStringHandler<string> = (id) => {
    const court = this.activeCourts().find((c) => c.id === id);
    return court ? court.label : '';
  };

  readonly stringifyStatus: TuiStringHandler<BookingStatus> = (s) => this.statusLabels[s] ?? '';

  constructor() {
    this.checkMobile();
    this.facilityControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.onFacilityChange(id);
    });
    this.dateControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((day) => {
      if (day) {
        this.selectedDate.set(tuiDayToIso(day));
        this.loadDay();
      }
    });
    // User-driven court changes from the week / mobile selectors flow through
    // here; programmatic updates use `{ emitEvent: false }` to avoid re-entry.
    this.courtControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.onCourtSwitch(id);
    });
  }

  ngOnInit(): void {
    // Resolve the tenant first so a hard refresh / deep link onto /reservations
    // waits for `/academy/my` before reading `academyId()`.
    this.tenant
      .ensure()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadFacilities());
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.checkMobile();
  }

  private checkMobile(): void {
    this.isMobile.set(typeof window !== 'undefined' && window.innerWidth <= 768);
  }

  setTab(tab: CalendarTab): void {
    this.tab.set(tab);
    if (tab === 'week') this.loadWeek();
    if (tab === 'list') this.loadList();
  }

  // ── facility resolution (same pattern as the courts page) ────────────────────
  private loadFacilities(): void {
    const academyId = this.tenant.academyId();
    if (!academyId) {
      this.facilities.set([]);
      this.selectedFacilityId.set(null);
      return;
    }
    this.facilityService
      .getFacilitiesByAcademy(academyId)
      .pipe(take(1))
      .subscribe({
        next: (facilities) => {
          this.facilities.set(facilities);
          this.resolveSelection(facilities);
        },
        error: () => this.hasError.set(true),
      });
  }

  private resolveSelection(facilities: Facility[]): void {
    this.route.queryParams.pipe(take(1)).subscribe((params) => {
      const fromQuery = params['facilityId'];
      if (facilities.length === 0) {
        this.selectFacility(null);
      } else if (facilities.length === 1) {
        const fId = this.facilityIdOf(facilities[0]);
        this.facilityControl.setValue(fId, { emitEvent: false });
        if (fromQuery !== fId) this.updateQueryParam(fId);
        this.selectFacility(fId);
      } else if (fromQuery) {
        const facility = facilities.find((f) => this.facilityIdOf(f) === fromQuery);
        const fId = facility ? this.facilityIdOf(facility) : null;
        this.facilityControl.setValue(fId, { emitEvent: false });
        if (!facility) this.updateQueryParam(null);
        this.selectFacility(fId);
      } else {
        this.facilityControl.setValue(null, { emitEvent: false });
        this.selectFacility(null);
      }
    });
  }

  onFacilityChange(facilityId: string | null): void {
    this.updateQueryParam(facilityId);
    this.selectFacility(facilityId);
  }

  private selectFacility(facilityId: string | null): void {
    this.selectedFacilityId.set(facilityId);
    this.courts.set([]);
    this.setSelectedCourt(null);
    if (facilityId) {
      this.loadCourtsThenData(facilityId);
    }
  }

  /** Sets the selected court signal and keeps the backing control in sync. */
  private setSelectedCourt(courtId: string | null): void {
    this.selectedCourtId.set(courtId);
    if (this.courtControl.value !== courtId) {
      this.courtControl.setValue(courtId, { emitEvent: false });
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

  private loadCourtsThenData(facilityId: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.courtService
      .getCourts(facilityId)
      .pipe(take(1))
      .subscribe({
        next: (courts) => {
          this.courts.set(courts);
          const firstActive = this.activeCourts()[0]?.id ?? null;
          this.setSelectedCourt(firstActive);
          this.loadDay();
        },
        error: () => {
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  // ── day view ─────────────────────────────────────────────────────────────────
  private loadDay(): void {
    const facilityId = this.selectedFacilityId();
    if (!facilityId) return;
    const date = this.selectedDate();
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      availability: this.bookingService
        .getAvailability(facilityId, date)
        .pipe(catchError(() => of<AvailabilityByCourt>({}))),
      bookings: this.bookingService.getBookings(facilityId, { date }),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ availability, bookings }) => {
          this.dayAvailability.set(availability);
          this.dayBookings.set(bookings.data);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  prevDay(): void {
    // In week view the step is a whole week so the user pages between weeks.
    this.goToDate(shiftIso(this.selectedDate(), this.tab() === 'week' ? -7 : -1));
  }

  nextDay(): void {
    this.goToDate(shiftIso(this.selectedDate(), this.tab() === 'week' ? 7 : 1));
  }

  today(): void {
    this.goToDate(todayIso());
  }

  private goToDate(iso: string): void {
    this.selectedDate.set(iso);
    this.dateControl.setValue(isoToTuiDay(iso), { emitEvent: false });
    if (this.tab() === 'week') this.loadWeek();
    else this.loadDay();
  }

  // ── week view ────────────────────────────────────────────────────────────────
  private loadWeek(): void {
    const facilityId = this.selectedFacilityId();
    const courtId = this.selectedCourtId();
    if (!facilityId || !courtId) return;
    const dates = weekDates(this.selectedDate());
    this.isLoading.set(true);
    this.hasError.set(false);

    // One forkJoin over a flat list of [availability, bookings] pairs (two per day);
    // we re-associate each result with its date by index, avoiding a nested forkJoin
    // and the extra `of(date)` inner stream.
    const requests = dates.flatMap((date) => [
      this.bookingService
        .getAvailability(facilityId, date)
        .pipe(catchError(() => of<AvailabilityByCourt>({}))),
      this.bookingService
        .getBookings(facilityId, { date, courtId })
        .pipe(catchError(() => of({ data: [] as Booking[] }))),
    ]);

    forkJoin(requests)
      .pipe(take(1))
      .subscribe({
        next: (results) => {
          this.weekData.set(
            dates.map((date, i) => ({
              date,
              availability: results[i * 2] as AvailabilityByCourt,
              bookings: (results[i * 2 + 1] as { data: Booking[] }).data,
            })),
          );
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  onCourtSwitch(courtId: string | null): void {
    // Guard against redundant 14-call week reloads when a rapid toggle re-selects
    // the already-active court (distinctUntilChanged for an imperative handler).
    if (courtId === this.selectedCourtId()) return;
    this.setSelectedCourt(courtId);
    if (this.tab() === 'week') this.loadWeek();
  }

  // ── list view ────────────────────────────────────────────────────────────────
  /** `page` is one-based (page 1 = first page), matching the backend contract. */
  loadList(page = 1): void {
    const facilityId = this.selectedFacilityId();
    if (!facilityId) return;
    this.listPage.set(page);
    const from = this.listFrom.value ? tuiDayToIso(this.listFrom.value) : undefined;
    const to = this.listTo.value ? tuiDayToIso(this.listTo.value) : undefined;
    this.isLoading.set(true);
    this.hasError.set(false);

    this.bookingService
      .getBookings(facilityId, {
        from,
        to,
        courtId: this.listCourt.value ?? undefined,
        status: this.listStatus.value ?? undefined,
        page,
        limit: this.listLimit,
      })
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          this.listBookings.set(res.data);
          this.listTotal.set(res.page?.total ?? res.data.length);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  applyListFilters(): void {
    this.loadList(1);
  }

  nextListPage(): void {
    // One-based: page N covers items [(N-1)*limit, N*limit). A next page exists
    // while the current page's last item index is below the total.
    if (this.listPage() * this.listLimit < this.listTotal()) {
      this.loadList(this.listPage() + 1);
    }
  }

  prevListPage(): void {
    if (this.listPage() > 1) this.loadList(this.listPage() - 1);
  }

  courtLabelById(courtId: string): string {
    return this.activeCourts().find((c) => c.id === courtId)?.label ?? '';
  }

  // ── cell interactions ────────────────────────────────────────────────────────
  /**
   * Handle a grid cell click. `date` carries the cell's own day so the week view
   * (whose cells each belong to a different day) prefills the clicked day rather
   * than the globally-selected date. The day view omits it and falls back to
   * `selectedDate()`. `closed` cells are inert (no handler is wired in the template).
   */
  onCellClick(cell: GridCell, date: string = this.selectedDate()): void {
    if (cell.kind === 'free') {
      this.openCreateDialog(cell, date);
    } else if (cell.booking) {
      this.openBookingActions(cell.booking);
    }
  }

  /** Availability map for a given date: the day view uses the day's map; the week
   * view looks up the per-day map captured in `weekData`. */
  private availabilityForDate(date: string): AvailabilityByCourt {
    if (this.tab() === 'week') {
      return this.weekData().find((d) => d.date === date)?.availability ?? {};
    }
    return this.dayAvailability();
  }

  private openCreateDialog(cell: GridCell, date: string): void {
    const facilityId = this.selectedFacilityId();
    if (!facilityId) return;
    const courtLabel = this.courtLabelById(cell.courtId);

    // Later free slots on the same court/day — for the optional multi-slot block.
    const laterSlots: SlotOption[] = (this.availabilityForDate(date)[cell.courtId] ?? [])
      .filter((s) => s.start > cell.start)
      .map((s) => ({ start: s.start, end: s.end }));

    const data: BookingDialogData = {
      facilityId,
      court: cell.courtId,
      courtLabel,
      date,
      start: cell.start,
      end: cell.end,
      priceTetri: cell.priceTetri,
      laterSlots,
    };

    this.dialogs
      .open<boolean>(new PolymorpheusComponent(BookingDialogComponent, this.injector), {
        label: `${courtLabel} · ${cell.start}`,
        size: 'm',
        dismissible: true,
        closable: true,
        data,
      })
      .pipe(take(1))
      .subscribe((saved) => {
        if (saved) this.refreshActive();
      });
  }

  private openBookingActions(booking: Booking): void {
    if (booking.type === 'block') {
      this.confirmCancel(booking, 'ბლოკის მოხსნა გსურთ?');
      return;
    }
    // For bookings, offer cancel; mark-paid is a separate cell action button.
    this.confirmCancel(booking, 'ჯავშნის გაუქმება გსურთ?');
  }

  confirmCancel(booking: Booking, content: string): void {
    const data: TuiConfirmData = {
      content,
      yes: 'დიახ',
      no: 'არა',
      appearance: 'destructive',
    };
    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: 'დადასტურება',
        size: 's',
        data,
      })
      .pipe(take(1))
      .subscribe((confirmed) => {
        if (confirmed) this.cancelBooking(booking);
      });
  }

  private cancelBooking(booking: Booking): void {
    this.bookingService
      .cancelBooking(booking._id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.alerts.open('გაუქმებულია', { appearance: 'success' }).pipe(take(1)).subscribe();
          this.refreshActive();
        },
        error: () => {
          this.alerts
            .open('შეცდომა გაუქმებისას.', { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  markPaid(booking: Booking, event?: Event): void {
    event?.stopPropagation();
    this.bookingService
      .markPaid(booking._id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.alerts.open('გადახდილია', { appearance: 'success' }).pipe(take(1)).subscribe();
          this.refreshActive();
        },
        error: () => {
          this.alerts
            .open('შეცდომა გადახდის აღნიშვნისას.', { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  cancelFromList(booking: Booking): void {
    this.confirmCancel(booking, 'ჯავშნის გაუქმება გსურთ?');
  }

  private refreshActive(): void {
    const tab = this.tab();
    if (tab === 'day') this.loadDay();
    else if (tab === 'week') this.loadWeek();
    else this.loadList(this.listPage());
  }

  // ── cell display helpers (kept thin; heavy logic is in calendar-grid) ────────
  cellLabel(cell: GridCell): string {
    if (cell.kind === 'free') return '';
    const b = cell.booking;
    if (!b) return '';
    if (b.type === 'block') return b.note || 'დაბლოკილი';
    return b.customerName || b.note || 'მომხმარებელი';
  }

  cellPriceGel(cell: GridCell): number | null {
    if (cell.kind === 'free' && cell.priceTetri != null) {
      return tetriToGel(cell.priceTetri);
    }
    if (cell.booking?.priceTetri != null) {
      return tetriToGel(cell.booking.priceTetri);
    }
    return null;
  }

  bookingPriceGel(booking: Booking): number | null {
    return booking.priceTetri != null ? tetriToGel(booking.priceTetri) : null;
  }

  /**
   * Compact equipment line for a booking: rented-racket and new-balls counts
   * from the equipment snapshot, e.g. "ჩოგანი ×2 · ბურთი ×1". Null when the
   * booking has no equipment order (no snapshot or both counts are zero), so
   * templates can skip the line entirely.
   */
  equipmentSummary(booking: Booking | undefined): string | null {
    const eq = booking?.equipment;
    if (!eq) return null;
    const parts: string[] = [];
    if (eq.racketsRented > 0) parts.push(`ჩოგანი ×${eq.racketsRented}`);
    if (eq.balls > 0) parts.push(`ბურთი ×${eq.balls}`);
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  isPaid(cell: GridCell): boolean {
    return cell.booking?.paymentStatus === 'paid';
  }

  /**
   * List-view status chip appearance: cancelled → destructive, completed →
   * neutral (a played-out booking is past, not an active green one), confirmed →
   * positive.
   */
  statusChipAppearance(status: BookingStatus): 'destructive' | 'neutral' | 'positive' {
    if (status === 'cancelled') return 'destructive';
    if (status === 'completed') return 'neutral';
    return 'positive';
  }

  navigateToFacilities(): void {
    this.router.navigate(['/configuration/facilities']);
  }
}
