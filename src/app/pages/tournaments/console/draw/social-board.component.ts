import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { tr } from '../../../../shared/i18n/lang';
import { TPipe } from '../../../../shared/i18n/t.pipe';
import {
  EntrantView,
  MatchView,
  SocialView,
} from '../../../../shared/models/tournament-engine.model';
import { MatchCardComponent } from './match-card.component';

/**
 * Americano / mexicano (docs/33 §7 "Americano = big leaderboard + round
 * cards"): the leaderboard first (rank, player(s), points, W-T-L, ±, games),
 * then a round pager with each round's court cards (2 v 2) and who rests,
 * and «შემდეგი რაუნდი» once every result of the current round is in.
 */
@Component({
  selector: 'app-social-board',
  standalone: true,
  imports: [TPipe, MatchCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './social-board.component.css',
  template: `
    <section class="sb ss-card" data-testid="leaderboard">
      <h3 class="sb-title georgian-text" lang="ka">{{ 'ლიდერბორდი' | t }}</h3>
      <div class="sb-scroll">
        <table class="sb-table">
          <thead>
            <tr>
              <th>#</th>
              <th class="sb-left georgian-text" lang="ka">{{ 'მოთამაშე' | t }}</th>
              <th class="georgian-text" lang="ka">{{ 'ქულები' | t }}</th>
              <th class="georgian-text" lang="ka">{{ 'მ-ფ-წ' | t }}</th>
              <th>±</th>
              <th class="georgian-text" lang="ka" [title]="'ნათამაშები' | t">{{ 'თ' | t }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of social().leaderboard; track row.entrant) {
              <tr>
                <td class="ss-num sb-rank">{{ row.rank }}</td>
                <td class="sb-left">{{ nameOf(row.entrant) }}</td>
                <td class="ss-num sb-points">{{ row.pointsFor }}</td>
                <td class="ss-num">{{ row.won }}-{{ row.drawn }}-{{ row.lost }}</td>
                <td class="ss-num">{{ signed(row.pointsFor - row.pointsAgainst) }}</td>
                <td class="ss-num">{{ row.played }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="sb ss-card" data-testid="rounds">
      <div class="sb-bar">
        <h3 class="sb-title georgian-text" lang="ka">{{ 'რაუნდები' | t }}</h3>
        <span class="sb-count ss-num">{{ social().rounds.length }} / {{ social().plannedRounds }}</span>
        <span class="sb-spacer"></span>
        @if (interactive() && canAdvance()) {
          <button
            class="ss-btn ss-btn--primary ss-btn--s"
            type="button"
            data-testid="next-round"
            [disabled]="!social().canGenerateNext || busy()"
            (click)="nextRound.emit()"
          >
            <span class="georgian-text" lang="ka">{{ 'შემდეგი რაუნდი' | t }}</span>
          </button>
        }
      </div>
      <div class="ss-chip-rail" role="tablist" [attr.aria-label]="'რაუნდები' | t">
        @for (r of social().rounds; track r.round) {
          <button
            type="button"
            class="ss-chip"
            role="tab"
            [class.is-active]="current() === r.round"
            [attr.aria-selected]="current() === r.round"
            (click)="current.set(r.round)"
          >
            <span class="ss-num">{{ r.round }}</span>
          </button>
        }
      </div>
      @if (round(); as r) {
        <div class="sb-courts">
          @for (id of r.matches; track id; let i = $index) {
            @if (matchById().get(id); as m) {
              <app-match-card
                [match]="m"
                [entrants]="entrants()"
                [interactive]="interactive()"
                [label]="courtLabel(i)"
                (open)="openMatch.emit($event)"
              />
            }
          }
        </div>
        @if (r.resting.length) {
          <p class="sb-rest georgian-text" lang="ka">
            {{ 'ისვენებს' | t }}: {{ restingNames(r.resting) }}
          </p>
        }
      }
    </section>
  `,
})
export class SocialBoardComponent {
  readonly social = input.required<SocialView>();
  readonly matchById = input.required<ReadonlyMap<string, MatchView>>();
  readonly entrants = input.required<ReadonlyMap<string, EntrantView>>();
  readonly interactive = input(false);
  /** A further round can be asked for (the tournament is not closed). */
  readonly canAdvance = input(true);
  readonly busy = input(false);

  readonly openMatch = output<MatchView>();
  readonly nextRound = output<void>();

  /**
   * The round on show: the one being played (the first with a result still
   * to enter — americano generates every round up front), else the latest;
   * until the organizer picks another.
   */
  protected readonly current = linkedSignal(() => {
    const rounds = this.social().rounds;
    const matches = this.matchById();
    const live = rounds.find((r) => r.matches.some((id) => matches.get(id)?.status !== 'done'));
    return (live ?? rounds[rounds.length - 1])?.round ?? 1;
  });
  protected readonly round = computed(
    () => this.social().rounds.find((r) => r.round === this.current()) ?? null,
  );

  protected nameOf(id: string): string {
    return this.entrants().get(id)?.name ?? '—';
  }

  protected restingNames(ids: string[]): string {
    return ids.map((id) => this.nameOf(id)).join(', ');
  }

  /** "კორტი 2" — translated at render (template call). */
  protected courtLabel(index: number): string {
    return `${tr('კორტი')} ${index + 1}`;
  }

  protected signed(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }
}
