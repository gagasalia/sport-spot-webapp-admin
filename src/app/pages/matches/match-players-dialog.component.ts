import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { take } from 'rxjs';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/experimental';
import { SHARED_TAIGA_IMPORTS } from '../../shared/shared.module';
import { MatchService } from '../../services/http-services/match.service';
import {
  AdminMatch,
  AdminMatchPlayer,
  MatchPlayerStatus,
} from '../../shared/models/match.model';

const STATUS_LABELS: Record<MatchPlayerStatus, string> = {
  joined: 'შეერთებული',
  left: 'გავიდა',
  removed: 'მოხსნილი',
};

const STATUS_CLASSES: Record<MatchPlayerStatus, string> = {
  joined: 'bg-green-100 text-green-700',
  left: 'bg-gray-200 text-gray-700',
  removed: 'bg-red-100 text-red-700',
};

/** Every membership row of one match — snapshots incl. contacts. */
@Component({
  selector: 'app-match-players-dialog',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, CommonModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-h-[70vh] overflow-y-auto">
      @if (isLoading()) {
        <p class="py-8 text-center georgian-text" lang="ka">იტვირთება...</p>
      } @else if (players().length === 0) {
        <p class="py-8 text-center georgian-text" lang="ka" data-testid="players-empty">
          მოთამაშეები არ არიან
        </p>
      } @else {
        <ul class="m-0 p-0 list-none" data-testid="players-list">
          @for (p of players(); track p._id) {
            <li
              class="py-3 flex items-center gap-3 border-b last:border-b-0"
              style="border-color: var(--tui-border-normal)"
              [class.opacity-50]="p.status !== 'joined'"
            >
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium">
                  {{ p.playerName || p.playerEmail || '—' }}
                  @if (p.role === 'owner') {
                    <span
                      class="ml-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 georgian-text"
                      lang="ka"
                      >ორგანიზატორი</span
                    >
                  }
                </div>
                <div class="text-xs truncate" style="color: var(--tui-text-secondary)">
                  {{ p.playerEmail }} @if (p.playerPhone) { · {{ p.playerPhone }} } ·
                  {{ p.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                </div>
              </div>
              <span
                class="inline-block px-2 py-0.5 rounded-full text-xs font-medium georgian-text"
                lang="ka"
                [class]="statusClass(p.status)"
              >
                {{ statusLabel(p.status) }}
              </span>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class MatchPlayersDialogComponent implements OnInit {
  private readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<
    void,
    { match: AdminMatch }
  >;
  private readonly matchService = inject(MatchService);

  protected readonly players = signal<AdminMatchPlayer[]>([]);
  protected readonly isLoading = signal(true);

  ngOnInit(): void {
    this.matchService
      .getPlayers(this.context.data.match._id)
      .pipe(take(1))
      .subscribe({
        next: (players) => {
          this.players.set(players);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  protected statusLabel(status: MatchPlayerStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: MatchPlayerStatus): string {
    return STATUS_CLASSES[status] ?? STATUS_CLASSES.joined;
  }
}
