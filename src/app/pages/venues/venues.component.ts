import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, filter, switchMap, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import { VenueService } from '../../services/http-services/venue.service';
import { AcademyService } from '../../services/http-services/academy.service';
import { FacilityService } from '../../services/http-services/facility.service';
import {
  VENUE_CITY_OPTIONS,
  VENUE_KINDS,
  VENUE_KIND_CLASSES,
  VENUE_KIND_LABELS,
  VENUE_SOURCE_CLASSES,
  VENUE_SOURCE_LABELS,
  VENUE_STATUSES,
  VENUE_STATUS_CLASSES,
  VENUE_STATUS_LABELS,
  Venue,
  VenueKind,
  VenueStatus,
  venueCityName,
} from '../../shared/models/venue.model';
import { DISTRICT_LABELS } from '../../shared/enums/district.enum';
import { LANDMARK_LABELS } from '../../shared/enums/landmark.enum';
import { tetriToGel } from '../../shared/utils/money.util';
import { tr } from '../../shared/i18n/lang';
import { localizedName } from '../../shared/i18n/localized';
import { TPipe } from '../../shared/i18n/t.pipe';
import { SsToastService } from '../../shared/ui/toast.service';
import { SsDialogService } from '../../shared/ui/dialog.service';
import { SsConfirmComponent, SsConfirmData } from '../../shared/ui/confirm.component';
import { PartnerFacilityOption, loadPartnerFacilities } from './partner-facilities';

const PAGE_SIZE = 20;

/**
 * კლუბების დირექტორია — the superadmin list of every padel venue in the
 * country (docs/26 §WP-1b), partner or not: searchable, filterable by city,
 * status and kind, with an inline status switcher, delete-with-confirm and a
 * row click into the full-page editor (`/venues/:id`).
 */
@Component({
  selector: 'app-venues',
  standalone: true,
  imports: [FormsModule, TPipe],
  templateUrl: './venues.component.html',
  styleUrl: './venues.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VenuesComponent implements OnInit {
  private readonly venueService = inject(VenueService);
  private readonly academyService = inject(AcademyService);
  private readonly facilityService = inject(FacilityService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(SsDialogService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cityOptions = VENUE_CITY_OPTIONS;
  protected readonly statusOptions = VENUE_STATUSES;
  protected readonly kindOptions = VENUE_KINDS;

  // filters ('' = any)
  protected readonly q = signal('');
  protected readonly city = signal('');
  protected readonly statusFilter = signal<VenueStatus | ''>('');
  protected readonly kindFilter = signal<VenueKind | ''>('');

  // list state
  protected readonly rows = signal<Venue[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly limit = PAGE_SIZE;
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.limit)),
  );
  protected readonly isMobile = signal(window.innerWidth <= 768);

  /** facility id → option, for the partner column. */
  private readonly partners = signal<ReadonlyMap<string, PartnerFacilityOption>>(new Map());

  /** Drops stale responses when the user types faster than the API answers. */
  private requestSeq = 0;
  private readonly search$ = new Subject<void>();

  @HostListener('window:resize')
  protected onResize(): void {
    this.isMobile.set(window.innerWidth <= 768);
  }

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.load();
      });

    loadPartnerFacilities(this.academyService, this.facilityService)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((options) => this.partners.set(new Map(options.map((o) => [o.id, o]))));

    // `/venues?kind=club|resort` — the nav's «კლუბები» / «კურორტები» entries
    // open the same directory pre-filtered; the first emission is the initial
    // load, later ones only reload when the URL's kind actually changes.
    let first = true;
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const raw = params.get('kind');
      const kind: VenueKind | '' = raw === 'club' || raw === 'resort' ? raw : '';
      if (!first && kind === this.kindFilter()) return;
      first = false;
      this.kindFilter.set(kind);
      this.reloadFromFirstPage();
    });
  }

  // ── filters ────────────────────────────────────────────────────────────────

  protected onSearchChange(value: string): void {
    this.q.set(value);
    this.search$.next();
  }

  protected onCityChange(city: string): void {
    this.city.set(city);
    this.reloadFromFirstPage();
  }

  protected onStatusFilterChange(status: VenueStatus | ''): void {
    this.statusFilter.set(status);
    this.reloadFromFirstPage();
  }

  protected onKindFilterChange(kind: VenueKind | ''): void {
    this.kindFilter.set(kind);
    this.reloadFromFirstPage();
    // keep the URL in step with the filter so the nav highlight follows
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { kind: kind || null },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  private reloadFromFirstPage(): void {
    this.page.set(1);
    this.load();
  }

  private load(): void {
    const seq = ++this.requestSeq;
    this.isLoading.set(true);
    this.hasError.set(false);
    this.venueService
      .getVenues({
        page: this.page(),
        limit: this.limit,
        q: this.q().trim() || undefined,
        city: this.city() || undefined,
        status: this.statusFilter() || undefined,
        kind: this.kindFilter() || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: ({ data, page }) => {
          if (seq !== this.requestSeq) return;
          this.rows.set(data);
          this.total.set(page?.total ?? data.length);
          this.isLoading.set(false);
        },
        error: () => {
          if (seq !== this.requestSeq) return;
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  // ── navigation ─────────────────────────────────────────────────────────────

  protected addVenue(): void {
    this.router.navigate(['/venues/new']);
  }

  protected editVenue(venue: Venue): void {
    this.router.navigate(['/venues', venue._id]);
  }

  /**
   * Row click / Enter opens the editor — unless the event started on one of
   * the row's own controls (status select, delete, partner link), which act
   * in place.
   */
  protected onRowActivate(event: Event, venue: Venue): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, select, a, input')) return;
    this.editVenue(venue);
  }

  // ── inline status + delete ─────────────────────────────────────────────────

  /** Optimistic switch: the badge updates at once and reverts on error. */
  protected onStatusChange(venue: Venue, status: VenueStatus): void {
    if (!status || venue.status === status) return;
    const previous = venue.status;
    this.patchRow(venue._id, { status });
    this.venueService
      .setStatus(venue._id, status)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.rows.update((list) => list.map((v) => (v._id === updated._id ? updated : v)));
          this.alerts.open(tr('შეინახა'), { appearance: 'success' }).pipe(take(1)).subscribe();
        },
        error: () => {
          this.patchRow(venue._id, { status: previous });
          this.alerts
            .open(tr('შენახვა ვერ მოხერხდა, სცადეთ თავიდან'), { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  private patchRow(id: string, patch: Partial<Venue>): void {
    this.rows.update((list) => list.map((v) => (v._id === id ? { ...v, ...patch } : v)));
  }

  protected deleteVenue(venue: Venue): void {
    this.dialogs
      .open<boolean>(SsConfirmComponent, {
        label: tr('კლუბის წაშლა'),
        size: 's',
        data: {
          content: `${tr('ნამდვილად წავშალოთ დირექტორიიდან')} „${venue.name}"?`,
          yes: tr('წაშლა'),
          no: tr('გაუქმება'),
          appearance: 'destructive',
        } as SsConfirmData,
      })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => this.venueService.deleteVenue(venue._id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.load();
          this.alerts.open(tr('წაიშალა'), { appearance: 'success' }).pipe(take(1)).subscribe();
        },
        error: () => {
          this.alerts
            .open(tr('წაშლა ვერ მოხერხდა, სცადეთ თავიდან'), { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  // ── display helpers ────────────────────────────────────────────────────────

  protected statusLabel(status: VenueStatus): string {
    return VENUE_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: VenueStatus): string {
    return VENUE_STATUS_CLASSES[status] ?? VENUE_STATUS_CLASSES.draft;
  }

  protected kindLabel(kind: VenueKind): string {
    return VENUE_KIND_LABELS[kind] ?? kind;
  }

  protected kindClass(kind: VenueKind): string {
    return VENUE_KIND_CLASSES[kind] ?? VENUE_KIND_CLASSES.club;
  }

  protected sourceLabel(venue: Venue): string {
    return VENUE_SOURCE_LABELS[venue.source] ?? venue.source ?? '';
  }

  protected sourceClass(venue: Venue): string {
    return VENUE_SOURCE_CLASSES[venue.source] ?? VENUE_SOURCE_CLASSES.manual;
  }

  /** 'თბილისი · ვაკე' — the city, then the district (or landmark) when set. */
  protected placeLabel(venue: Venue): string {
    const area =
      (venue.district && DISTRICT_LABELS[venue.district]) ||
      (venue.landmark && LANDMARK_LABELS[venue.landmark]) ||
      venue.district ||
      '';
    const city = venueCityName(venue.city);
    return area ? `${city} · ${area}` : city;
  }

  /** '₾25–₾40', '₾25+', '≤ ₾40' or '—'. */
  protected priceBand(venue: Venue): string {
    const min = venue.priceMinTetri;
    const max = venue.priceMaxTetri;
    if (min != null && max != null) {
      return min === max ? `₾${this.gel(min)}` : `₾${this.gel(min)}–₾${this.gel(max)}`;
    }
    if (min != null) return `₾${this.gel(min)}+`;
    if (max != null) return `≤ ₾${this.gel(max)}`;
    return '—';
  }

  /** Whole lari stay bare ('25'); anything else shows two decimals ('25.50'). */
  private gel(tetri: number): string {
    const gel = tetriToGel(tetri);
    return Number.isInteger(gel) ? String(gel) : gel.toFixed(2);
  }

  /** The linked facility's live name; '' when the venue is not a partner. */
  protected partnerName(venue: Venue): string {
    if (!venue.partnerFacility) return '';
    const option = this.partners().get(venue.partnerFacility);
    return option ? localizedName(option.facility) : tr('პარტნიორი');
  }

  /** Public player-app page of the linked facility (slug when known, else id). */
  protected partnerUrl(venue: Venue): string | null {
    if (!venue.partnerFacility) return null;
    const facility = this.partners().get(venue.partnerFacility)?.facility;
    return `${environment.siteUrl}/facilities/${facility?.slug || venue.partnerFacility}`;
  }
}
