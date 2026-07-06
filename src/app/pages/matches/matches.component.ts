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
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, take } from 'rxjs';
import { TuiAlertService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { TuiDialogService } from '@taiga-ui/experimental';
import { TUI_CONFIRM, type TuiConfirmData } from '@taiga-ui/kit/components/confirm';
import { WA_WINDOW } from '@ng-web-apis/common';
import { SHARED_TAIGA_IMPORTS } from '../../shared/shared.module';
import { MatchService } from '../../services/http-services/match.service';
import {
  AdminMatch,
  MatchCategory,
  MatchLevel,
  MatchStatus,
  MatchVisibility,
} from '../../shared/models/match.model';
import { tetriToGel } from '../../shared/utils/money.util';
import { MatchPlayersDialogComponent } from './match-players-dialog.component';

const STATUS_LABELS: Record<MatchStatus, string> = {
  open: 'ღია',
  cancelled: 'გაუქმებული',
};
const STATUS_CLASSES: Record<MatchStatus, string> = {
  open: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};
const VISIBILITY_LABELS: Record<MatchVisibility, string> = {
  public: 'საჯარო',
  private: 'პრივატული',
};
const LEVEL_LABELS: Record<MatchLevel, string> = {
  any: 'ნებისმიერი',
  beginner: 'დამწყები',
  intermediate: 'საშუალო',
  advanced: 'გამოცდილი',
};
const CATEGORY_LABELS: Record<MatchCategory, string> = {
  men: 'კაცები',
  women: 'ქალები',
  mixed: 'შერეული',
};

/**
 * Operator moderation of player-organized matches (docs/15 §5): read-only
 * list of matches hosted at the academy's venues, the full membership dialog
 * (contacts included) and the moderation cancel. Matches are USER-generated —
 * operators don't create or edit them.
 */
@Component({
  selector: 'app-matches',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, CommonModule],
  templateUrl: './matches.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchesComponent implements OnInit {
  private readonly matchService = inject(MatchService);
  private readonly dialogs = inject(TuiDialogService);
  private readonly alerts = inject(TuiAlertService);
  private readonly injector = inject(Injector);
  private readonly window = inject(WA_WINDOW);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly matches = signal<AdminMatch[]>([]);
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
    this.matchService
      .getMatches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.matches.set(data);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  protected openPlayers(match: AdminMatch): void {
    this.dialogs
      .open<void>(
        new PolymorpheusComponent(MatchPlayersDialogComponent, this.injector),
        {
          label: `მოთამაშეები · ${match.facilityName ?? ''} ${match.date} ${match.startTime}`,
          size: 'l',
          dismissible: true,
          closable: true,
          data: { match },
        },
      )
      .pipe(take(1))
      .subscribe();
  }

  protected cancel(match: AdminMatch): void {
    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: 'თამაშის გაუქმება',
        size: 's',
        data: {
          content: `გავაუქმოთ ${match.date} ${match.startTime} თამაში (${match.facilityName ?? ''})? მოთამაშეები დაინახავენ რომ ადმინისტრაციამ გააუქმა.`,
          yes: 'გაუქმება',
          no: 'არა',
        } as TuiConfirmData,
      })
      .pipe(take(1), filter(Boolean))
      .subscribe(() => {
        this.matchService
          .cancelMatch(match._id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (updated) => {
              this.matches.update((list) =>
                list.map((m) => (m._id === updated._id ? updated : m)),
              );
              this.alerts
                .open('თამაში გაუქმდა', { appearance: 'success' })
                .pipe(take(1))
                .subscribe();
            },
          });
      });
  }

  // ─── Display helpers ────────────────────────────────────────────────────────

  protected statusLabel(status: MatchStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: MatchStatus): string {
    return STATUS_CLASSES[status] ?? STATUS_CLASSES.open;
  }

  protected visibilityLabel(m: AdminMatch): string {
    return VISIBILITY_LABELS[m.visibility] ?? m.visibility;
  }

  protected levelLabel(m: AdminMatch): string {
    return LEVEL_LABELS[m.level] ?? m.level;
  }

  protected categoryLabel(m: AdminMatch): string {
    return CATEGORY_LABELS[m.category] ?? m.category;
  }

  protected priceLabel(m: AdminMatch): string {
    if (m.pricePerPlayerTetri == null) {
      return '—';
    }
    return m.pricePerPlayerTetri === 0
      ? 'უფასო'
      : `${tetriToGel(m.pricePerPlayerTetri)} ₾/კაცი`;
  }
}
