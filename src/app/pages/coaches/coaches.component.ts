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
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  filter,
  map,
  of,
  switchMap,
  take,
} from 'rxjs';
import { CoachService } from '../../services/http-services/coach.service';
import { AcademyService } from '../../services/http-services/academy.service';
import { AuthService } from '../../shared/services/auth.service';
import { TenantService } from '../../shared/services/tenant.service';
import { Academy } from '../../shared/models/academy.model';
import {
  COACH_LEVEL_LABELS,
  COACH_STATUSES,
  COACH_STATUS_CLASSES,
  COACH_STATUS_LABELS,
  Coach,
  CoachStatus,
} from '../../shared/models/coach.model';
import { VENUE_CITY_OPTIONS, venueCityName } from '../../shared/models/venue.model';
import { DISTRICT_LABELS } from '../../shared/enums/district.enum';
import { tetriToGel } from '../../shared/utils/money.util';
import { tr } from '../../shared/i18n/lang';
import { TPipe } from '../../shared/i18n/t.pipe';
import { SsAvatarComponent } from '../../shared/ui/ss-avatar.component';
import { SsToastService } from '../../shared/ui/toast.service';
import { SsDialogService } from '../../shared/ui/dialog.service';
import { SsConfirmComponent, SsConfirmData } from '../../shared/ui/confirm.component';

const PAGE_SIZE = 20;

/**
 * ტრენერები — the coaches directory list (docs/26 §WP-1d). Operators see and
 * manage their own academy's coaches, superadmins every coach (independent
 * ones included). Searchable, filterable by status and city, with a confirmed
 * publish / hide toggle per row, delete-with-confirm and a row click into the
 * full-page editor (`/coaches/:id`).
 */
@Component({
  selector: 'app-coaches',
  standalone: true,
  imports: [FormsModule, TPipe, SsAvatarComponent],
  templateUrl: './coaches.component.html',
  styleUrl: './coaches.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoachesComponent implements OnInit {
  private readonly coachService = inject(CoachService);
  private readonly academyService = inject(AcademyService);
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(SsDialogService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSuperAdmin = this.auth.isSuperAdmin;
  protected readonly cityOptions = VENUE_CITY_OPTIONS;
  protected readonly statusOptions = COACH_STATUSES;

  // filters ('' = any)
  protected readonly q = signal('');
  protected readonly city = signal('');
  protected readonly statusFilter = signal<CoachStatus | ''>('');

  // list state
  protected readonly rows = signal<Coach[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly limit = PAGE_SIZE;
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.limit)),
  );
  protected readonly isMobile = signal(window.innerWidth <= 768);
  /** Row ids with a status move in flight — their toggle is disabled. */
  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());

  /** academy id → name, for the academy column. */
  private readonly academyNames = signal<ReadonlyMap<string, string>>(new Map());

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

    this.loadAcademyNames();
    this.load();
  }

  /**
   * Superadmins name every academy (`GET /academy`); an operator only ever
   * sees their own academy's coaches, so their own academy is the whole map.
   * A failed lookup only degrades the column to a generic label.
   */
  private loadAcademyNames(): void {
    const source: Observable<Academy[]> = this.isSuperAdmin()
      ? this.academyService.getAllAcademies()
      : this.tenant.ensure().pipe(map((academy) => (academy ? [academy] : [])));
    source
      .pipe(
        take(1),
        catchError(() => of([] as Academy[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((academies) =>
        this.academyNames.set(
          new Map(
            (academies ?? [])
              .filter((a) => !!a?._id)
              .map((a) => [a._id as string, a.name] as [string, string]),
          ),
        ),
      );
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

  protected onStatusFilterChange(status: CoachStatus | ''): void {
    this.statusFilter.set(status);
    this.reloadFromFirstPage();
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
    this.coachService
      .getCoaches({
        page: this.page(),
        limit: this.limit,
        q: this.q().trim() || undefined,
        status: this.statusFilter() || undefined,
        city: this.city() || undefined,
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

  protected addCoach(): void {
    this.router.navigate(['/coaches/new']);
  }

  protected editCoach(coach: Coach): void {
    this.router.navigate(['/coaches', coach._id]);
  }

  /**
   * Row click / Enter opens the editor — unless the event started on one of
   * the row's own controls (publish toggle, delete), which act in place.
   */
  protected onRowActivate(event: Event, coach: Coach): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, select, a, input')) return;
    this.editCoach(coach);
  }

  // ── publish / hide + delete ────────────────────────────────────────────────

  /** Confirm → PATCH the flipped status → swap in the returned row + toast. */
  protected toggleStatus(coach: Coach): void {
    if (this.busyIds().has(coach._id)) return;
    const publishing = coach.status !== 'published';
    const target: CoachStatus = publishing ? 'published' : 'draft';
    const content = publishing
      ? tr('ტრენერის პროფილი გამოჩნდება საიტზე')
      : tr('ტრენერის პროფილი საიტიდან მოიხსნება');
    const data: SsConfirmData = {
      content: `${content}: „${coach.name}“`,
      yes: publishing ? tr('გამოქვეყნება') : tr('დამალვა'),
      no: tr('გაუქმება'),
    };
    this.dialogs
      .open<boolean>(SsConfirmComponent, {
        label: publishing ? tr('ტრენერის გამოქვეყნება') : tr('ტრენერის დამალვა'),
        size: 's',
        data,
      })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => {
          this.setBusy(coach._id, true);
          return this.coachService.setStatus(coach._id, target);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.setBusy(coach._id, false);
          this.rows.update((list) => list.map((c) => (c._id === updated._id ? updated : c)));
          this.alerts
            .open(publishing ? tr('გამოქვეყნდა') : tr('დაიმალა'), { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        },
        error: () => {
          this.setBusy(coach._id, false);
          this.alerts
            .open(tr('სტატუსის შეცვლა ვერ მოხერხდა, სცადეთ თავიდან'), { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update((ids) => {
      const next = new Set(ids);
      if (busy) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  protected deleteCoach(coach: Coach): void {
    this.dialogs
      .open<boolean>(SsConfirmComponent, {
        label: tr('ტრენერის წაშლა'),
        size: 's',
        data: {
          content: `${tr('ნამდვილად წავშალოთ ტრენერი')} „${coach.name}“?`,
          yes: tr('წაშლა'),
          no: tr('გაუქმება'),
          appearance: 'destructive',
        } as SsConfirmData,
      })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => this.coachService.deleteCoach(coach._id)),
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

  protected statusLabel(status: CoachStatus): string {
    return COACH_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: CoachStatus): string {
    return COACH_STATUS_CLASSES[status] ?? COACH_STATUS_CLASSES.draft;
  }

  /** The row's quick move: publish a draft, hide a published profile. */
  protected toggleLabel(coach: Coach): string {
    return coach.status === 'published' ? tr('დამალვა') : tr('გამოქვეყნება');
  }

  protected photoUrl(coach: Coach): string | null {
    return coach.photo?.thumbUrl || coach.photo?.url || null;
  }

  /** 'თბილისი · ვაკე' — the city, then the district when set. */
  protected placeLabel(coach: Coach): string {
    const city = venueCityName(coach.city);
    const district = coach.district ? DISTRICT_LABELS[coach.district] || coach.district : '';
    return district ? `${city} · ${district}` : city;
  }

  /** The owning academy's name, or «დამოუკიდებელი» for an independent coach. */
  protected academyLabel(coach: Coach): string {
    if (!coach.academy) return tr('დამოუკიდებელი');
    return this.academyNames().get(coach.academy) ?? tr('აკადემია');
  }

  protected levelsLabel(coach: Coach): string {
    const levels = coach.levels ?? [];
    return levels.length ? levels.map((l) => COACH_LEVEL_LABELS[l] ?? l).join(', ') : '—';
  }

  /** True when at least one lesson price is published. */
  protected hasPrice(coach: Coach): boolean {
    return coach.priceIndividualTetri != null || coach.priceGroupTetri != null;
  }

  /** '₾80' — whole lari stay bare, anything else shows two decimals; null when unset. */
  protected price(tetri: number | null | undefined): string | null {
    if (tetri == null) return null;
    const gel = tetriToGel(tetri);
    return `₾${Number.isInteger(gel) ? gel : gel.toFixed(2)}`;
  }
}
