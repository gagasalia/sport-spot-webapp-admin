import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  Injector,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, switchMap, take } from 'rxjs';
import { TuiAlertService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { TuiDialogService } from '@taiga-ui/experimental';
import { TUI_CONFIRM, type TuiConfirmData } from '@taiga-ui/kit/components/confirm';
import { WA_WINDOW } from '@ng-web-apis/common';
import { SHARED_TAIGA_IMPORTS } from '../../shared/shared.module';
import { TournamentService } from '../../services/http-services/tournament.service';
import {
  Tournament,
  TournamentStatus,
} from '../../shared/models/tournament.model';
import { tetriToGel } from '../../shared/utils/money.util';
import {
  FORMAT_LABELS,
  LEVEL_LABELS,
  TYPE_LABELS,
  TournamentFormComponent,
} from './tournament-form/tournament-form.component';
import { RegistrationsDialogComponent } from './registrations-dialog.component';

const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: 'დრაფტი',
  published: 'გამოქვეყნებული',
  completed: 'დასრულებული',
  cancelled: 'გაუქმებული',
};

const STATUS_CLASSES: Record<TournamentStatus, string> = {
  draft: 'bg-gray-200 text-gray-700',
  published: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

/**
 * Operator tournaments (docs/13 §7): the academy's tournaments in every
 * status, lifecycle actions with confirms (cancelling warns about the
 * automatic fee refunds), the participants dialog and the create/edit form.
 */
@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, CommonModule, DatePipe],
  templateUrl: './tournaments.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentsComponent implements OnInit {
  private readonly tournamentService = inject(TournamentService);
  private readonly dialogs = inject(TuiDialogService);
  private readonly alerts = inject(TuiAlertService);
  private readonly injector = inject(Injector);
  private readonly window = inject(WA_WINDOW);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tournaments = signal<Tournament[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isMobile = signal(this.window.innerWidth <= 768);

  @HostListener('window:resize')
  protected onResize(): void {
    this.isMobile.set(this.window.innerWidth <= 768);
  }

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.tournamentService
      .getMyTournaments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.tournaments.set(data);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  protected addTournament(): void {
    this.dialogs
      .open<Tournament | null>(
        new PolymorpheusComponent(TournamentFormComponent, this.injector),
        {
          label: 'ტურნირის დამატება',
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
            .open('ტურნირი შეიქმნა (დრაფტი)', { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        }
      });
  }

  protected editTournament(tournament: Tournament): void {
    this.dialogs
      .open<Tournament | null>(
        new PolymorpheusComponent(TournamentFormComponent, this.injector),
        {
          label: 'ტურნირის რედაქტირება',
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
        new PolymorpheusComponent(RegistrationsDialogComponent, this.injector),
        {
          label: `რეგისტრაციები · ${tournament.name}`,
          size: 'l',
          dismissible: true,
          closable: true,
          data: { tournament },
        },
      )
      .pipe(take(1))
      .subscribe();
  }

  protected publish(tournament: Tournament): void {
    this.setStatus(tournament, 'published', 'ტურნირი გამოქვეყნდა');
  }

  protected complete(tournament: Tournament): void {
    this.confirmThenSetStatus(
      tournament,
      'completed',
      'ტურნირის დასრულება',
      `დავასრულოთ „${tournament.name}"?`,
      'ტურნირი დასრულდა',
    );
  }

  protected cancel(tournament: Tournament): void {
    this.confirmThenSetStatus(
      tournament,
      'cancelled',
      'ტურნირის გაუქმება',
      `გავაუქმოთ „${tournament.name}"? ბალანსით გადახდილი საფასურები ავტომატურად დაბრუნდება.`,
      'ტურნირი გაუქმდა — გადახდილი საფასურები დაბრუნდა',
    );
  }

  protected deleteTournament(tournament: Tournament): void {
    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: 'ტურნირის წაშლა',
        size: 's',
        data: {
          content: `ნამდვილად წავშალოთ დრაფტი „${tournament.name}"?`,
          yes: 'წაშლა',
          no: 'გაუქმება',
        } as TuiConfirmData,
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
            .open('დრაფტი წაიშალა', { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  private confirmThenSetStatus(
    tournament: Tournament,
    status: TournamentStatus,
    label: string,
    content: string,
    successMessage: string,
  ): void {
    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label,
        size: 's',
        data: { content, yes: 'დიახ', no: 'არა' } as TuiConfirmData,
      })
      .pipe(take(1), filter(Boolean))
      .subscribe(() => this.setStatus(tournament, status, successMessage));
  }

  private setStatus(
    tournament: Tournament,
    status: TournamentStatus,
    successMessage: string,
  ): void {
    this.tournamentService
      .setStatus(tournament._id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.tournaments.update((list) =>
            list.map((t) => (t._id === updated._id ? updated : t)),
          );
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

  protected feeLabel(t: Tournament): string {
    return t.entryFeeTetri === 0 ? 'უფასო' : `${tetriToGel(t.entryFeeTetri)} ₾`;
  }
}
