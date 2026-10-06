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
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, filter, map, switchMap, take } from 'rxjs';
import { TournamentService } from '../../services/http-services/tournament.service';
import {
  Tournament,
  TournamentStatus,
} from '../../shared/models/tournament.model';
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  LEVEL_LABELS,
  STATUS_CLASSES,
  STATUS_LABELS,
  TYPE_LABELS,
  categoryLabel,
  feeLabel,
  groupTournaments,
} from './tournament-labels';
import { TournamentFormComponent } from './tournament-form/tournament-form.component';
import { RegistrationsDialogComponent } from './registrations-dialog.component';
import { TournamentResultsDialogComponent } from './results-dialog/tournament-results-dialog.component';
import {
  EventScope,
  EventScopeDialogComponent,
  EventScopeDialogData,
} from './event-scope-dialog.component';

import { tr } from '../../shared/i18n/lang';
import { FacilityNamesService } from '../../shared/i18n/facility-names.service';
import { localizedName } from '../../shared/i18n/localized';
import { TPipe } from '../../shared/i18n/t.pipe';
import { AuthService } from '../../shared/services/auth.service';
import { SsToastService } from '../../shared/ui/toast.service';
import { SsDialogService } from '../../shared/ui/dialog.service';
import { SsConfirmComponent, SsConfirmData } from '../../shared/ui/confirm.component';

/**
 * Operator tournaments (docs/13 §7, docs/33 §5): the academy's tournaments
 * (an organizer's own) in every status. The categories of one EVENT render as
 * one block — the event name once, then a compact row per category. Each
 * internal tournament opens its organizer CONSOLE («მართვა»,
 * `/tournaments/:id`); lifecycle actions on a category of an event offer
 * «ყველა კატეგორია» or this category only. The legacy results dialog stays
 * for tournaments without an engine draw.
 */
@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [CommonModule, RouterLink, TPipe],
  templateUrl: './tournaments.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentsComponent implements OnInit {
  private readonly tournamentService = inject(TournamentService);
  private readonly auth = inject(AuthService);
  private readonly facilityNames = inject(FacilityNamesService);
  private readonly dialogs = inject(SsDialogService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tournaments = signal<Tournament[]>([]);
  /** Plain tournaments and events (their categories together), in list order. */
  protected readonly blocks = computed(() => groupTournaments(this.tournaments()));

  /** Operator content: `nameEn` in an English session, Georgian otherwise. */
  protected tournamentLabel(tournament: Tournament): string {
    return localizedName(tournament);
  }

  /** A category's name inside its event ("კაცები A" or "კაცები · საშუალო"). */
  protected categoryName(tournament: Tournament): string {
    return categoryLabel(tournament);
  }

  /**
   * Venue line: the live facility name, falling back to the row snapshot. An
   * external tournament names its free-text place and organizer instead
   * (a directory venue is only an id here).
   */
  protected facilityLabel(tournament: Tournament): string {
    const facility = this.facilityNames.label(tournament.facility, tournament.facilityName);
    const external = tournament.external;
    if (!external) {
      return facility;
    }
    return (
      [external.venueName || facility, external.organizerName].filter(Boolean).join(' · ') || '—'
    );
  }

  protected readonly isLoading = signal(true);
  protected readonly isMobile = signal(window.innerWidth <= 768);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly limit = 20;
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.limit)),
  );

  @HostListener('window:resize')
  protected onResize(): void {
    this.isMobile.set(window.innerWidth <= 768);
  }

  ngOnInit(): void {
    this.facilityNames.ensure();
    this.load();
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.tournamentService
      .getMyTournaments(this.page(), this.limit)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data, page }) => {
          this.tournaments.set(data);
          this.total.set(page?.total ?? data.length);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  protected addTournament(): void {
    this.dialogs
      .open<Tournament | null>(
        TournamentFormComponent,
        {
          label: tr('ტურნირის დამატება'),
          size: 'l',
          dismissible: true,
          closable: true,
          data: {},
        },
      )
      .pipe(take(1))
      .subscribe((result) => {
        if (result) {
          this.load();
          this.alerts
            .open(tr('ტურნირი შეიქმნა (დრაფტი)'), { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        }
      });
  }

  protected editTournament(tournament: Tournament): void {
    this.dialogs
      .open<Tournament | null>(
        TournamentFormComponent,
        {
          label: tr('ტურნირის რედაქტირება'),
          size: 'l',
          dismissible: true,
          closable: true,
          data: { tournament },
        },
      )
      .pipe(take(1))
      .subscribe((result) => {
        if (result) {
          this.load();
        }
      });
  }

  protected openRegistrations(tournament: Tournament): void {
    this.dialogs
      .open<void>(
        RegistrationsDialogComponent,
        {
          label: `${tr('რეგისტრაციები')} · ${localizedName(tournament)}`,
          size: 'l',
          dismissible: true,
          closable: true,
          data: { tournament },
        },
      )
      .pipe(take(1))
      .subscribe();
  }

  /** The organizer console runs every internal tournament (docs/33 §7). */
  protected canManage(tournament: Tournament): boolean {
    return !tournament.external;
  }

  /**
   * The legacy results dialog (docs/25 §4.1): a live or finished tournament
   * WITHOUT an engine draw — once a draw exists, results go in the console.
   */
  protected hasResults(tournament: Tournament): boolean {
    // Its player lookup is an academy tool (admin only) — a tournament maker
    // enters results in the console.
    if (this.auth.isOrganizer()) return false;
    const engine = tournament.draw?.status === 'draft' || tournament.draw?.status === 'published';
    return !engine && (tournament.status === 'published' || tournament.status === 'completed');
  }

  /** The results dialog: rated games + the `+ თამაში` entry form (docs/25 §6.5). */
  protected openResults(tournament: Tournament): void {
    this.dialogs
      .open<void>(TournamentResultsDialogComponent, {
        label: `${tr('შედეგები')} · ${localizedName(tournament)}`,
        size: 'l',
        dismissible: true,
        closable: true,
        data: { tournament },
      })
      .pipe(take(1))
      .subscribe();
  }

  protected publish(tournament: Tournament): void {
    this.confirmThenSetStatus(
      tournament,
      'published',
      tr('ტურნირის გამოქვეყნება'),
      `${tr('გამოვაქვეყნოთ')} „${localizedName(tournament)}"? ${tr('ის ხილული გახდება მოთამაშეებისთვის და გაიხსნება რეგისტრაცია.')}`,
      tr('ტურნირი გამოქვეყნდა'),
    );
  }

  protected complete(tournament: Tournament): void {
    this.confirmThenSetStatus(
      tournament,
      'completed',
      tr('ტურნირის დასრულება'),
      `${tr('დავასრულოთ')} „${localizedName(tournament)}"?`,
      tr('ტურნირი დასრულდა'),
    );
  }

  protected cancel(tournament: Tournament): void {
    this.confirmThenSetStatus(
      tournament,
      'cancelled',
      tr('ტურნირის გაუქმება'),
      `${tr('გავაუქმოთ')} „${localizedName(tournament)}"? ${tr('ბალანსით გადახდილი საფასურები ავტომატურად დაბრუნდება.')}`,
      tr('ტურნირი გაუქმდა — გადახდილი საფასურები დაბრუნდა'),
      true,
    );
  }

  protected deleteTournament(tournament: Tournament): void {
    this.dialogs
      .open<boolean>(SsConfirmComponent, {
        label: tr('ტურნირის წაშლა'),
        size: 's',
        data: {
          content: `${tr('ნამდვილად წავშალოთ დრაფტი')} „${this.rowTitle(tournament)}"?`,
          yes: tr('წაშლა'),
          no: tr('გაუქმება'),
        } as SsConfirmData,
      })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => this.tournamentService.deleteTournament(tournament._id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.tournaments.update((list) =>
            list.filter((t) => t._id !== tournament._id),
          );
          this.alerts
            .open(tr('დრაფტი წაიშალა'), { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  /** How many categories of this tournament's event the list holds. */
  private categoriesOf(tournament: Tournament): number {
    const eventId = tournament.event?.id;
    return eventId ? this.tournaments().filter((t) => t.event?.id === eventId).length : 1;
  }

  /** "Autumn Open · კაცები A" for a category, the name otherwise. */
  private rowTitle(tournament: Tournament): string {
    const name = localizedName(tournament);
    return tournament.event ? `${name} · ${categoryLabel(tournament)}` : name;
  }

  /**
   * Confirm, then move the status. A category of an event with siblings asks
   * for the scope instead: «ყველა კატეგორია» (`wholeEvent`) or this one.
   */
  private confirmThenSetStatus(
    tournament: Tournament,
    status: TournamentStatus,
    label: string,
    content: string,
    successMessage: string,
    destructive = false,
  ): void {
    const scope$: Observable<EventScope> =
      this.categoriesOf(tournament) > 1
        ? this.dialogs.open<EventScope>(EventScopeDialogComponent, {
            label,
            size: 's',
            data: {
              content,
              category: categoryLabel(tournament),
              destructive,
            } as EventScopeDialogData,
          })
        : this.dialogs
            .open<boolean>(SsConfirmComponent, {
              label,
              size: 's',
              data: { content, yes: tr('დიახ'), no: tr('არა') } as SsConfirmData,
            })
            .pipe(
              filter(Boolean),
              map((): EventScope => 'one'),
            );
    scope$
      .pipe(take(1))
      .subscribe((scope) => this.setStatus(tournament, status, successMessage, scope === 'all'));
  }

  private setStatus(
    tournament: Tournament,
    status: TournamentStatus,
    successMessage: string,
    wholeEvent = false,
  ): void {
    this.tournamentService
      .setStatus(tournament._id, status, wholeEvent)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          if (wholeEvent) {
            // Every sibling may have moved — read the list again.
            this.load();
          } else {
            this.tournaments.update((list) =>
              list.map((t) => (t._id === updated._id ? updated : t)),
            );
          }
          this.alerts
            .open(successMessage, { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  // ─── Display helpers ────────────────────────────────────────────────────────

  protected statusLabel(status: TournamentStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: TournamentStatus): string {
    return STATUS_CLASSES[status] ?? STATUS_CLASSES.draft;
  }

  protected typeLabel(t: Tournament): string {
    return TYPE_LABELS[t.type] ?? t.type;
  }

  protected formatLabel(t: Tournament): string {
    return FORMAT_LABELS[t.format] ?? t.format;
  }

  protected levelLabel(t: Tournament): string {
    return LEVEL_LABELS[t.level] ?? t.level;
  }

  protected categoryLabel(t: Tournament): string {
    return CATEGORY_LABELS[t.category] ?? t.category;
  }

  protected feeLabel(t: Tournament): string {
    return feeLabel(t.entryFeeTetri);
  }
}
