import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TPipe } from '../../../../shared/i18n/t.pipe';
import {
  EntrantView,
  KnockoutRoundView,
  MatchView,
} from '../../../../shared/models/tournament-engine.model';
import {
  OUTCOME_LABELS,
  isPlayable,
  matchTimeLabel,
  sideNames,
  sideScore,
} from '../draw-display.util';

/**
 * One match as a two-row card (bracket, group lists, social courts): names
 * or placeholders, the per-set numbers, the winner emphasised, time · court
 * underneath. A tap opens the score dialog; in SWAP mode each known side is a
 * button that picks its entrant instead.
 */
@Component({
  selector: 'app-match-card',
  standalone: true,
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './match-card.component.css',
  template: `
    @if (swapMode()) {
      <div class="mc is-swap" [attr.data-testid]="'match-' + match().id">
        @if (label()) {
          <span class="mc-label georgian-text" lang="ka">{{ label() }}</span>
        }
        @for (side of sides; track side) {
          @if (match().sides[side]?.entrants?.length === 1) {
            <button
              type="button"
              class="mc-row mc-pick"
              [class.is-picked]="selected() === match().sides[side].entrants[0]"
              [attr.data-testid]="'pick-' + match().sides[side].entrants[0]"
              (click)="pick.emit(match().sides[side].entrants[0])"
            >
              <span class="mc-name">{{ names()[side] }}</span>
            </button>
          } @else {
            <span class="mc-row is-ph"><span class="mc-name">{{ names()[side] }}</span></span>
          }
        }
      </div>
    } @else {
      <button
        type="button"
        class="mc"
        [class.is-done]="match().status === 'done'"
        [class.is-focus]="highlight()"
        [disabled]="!canOpen()"
        [attr.data-testid]="'match-' + match().id"
        (click)="open.emit(match())"
      >
        @if (label()) {
          <span class="mc-label georgian-text" lang="ka">{{ label() }}</span>
        }
        @for (side of sides; track side) {
          <span
            class="mc-row"
            [class.is-winner]="match().status === 'done' && match().winner === side"
            [class.is-loser]="match().status === 'done' && match().winner === 1 - side"
            [class.is-ph]="!match().sides[side]?.entrants?.length"
          >
            <span class="mc-name">{{ names()[side] }}</span>
            <span class="mc-score ss-num">
              @for (n of scores()[side]; track $index) {
                <span>{{ n }}</span>
              }
            </span>
          </span>
        }
        @if (footer() || match().rated || awarded()) {
          <span class="mc-foot">
            <span class="ss-num">{{ footer() }}</span>
            @if (awarded(); as outcome) {
              <span class="georgian-text" lang="ka">{{ outcomeLabels[outcome] }}</span>
            }
            @if (match().rated) {
              <span class="mc-rated georgian-text" lang="ka" [title]="'რეიტინგში' | t">●</span>
            }
          </span>
        }
      </button>
    }
  `,
})
export class MatchCardComponent {
  readonly match = input.required<MatchView>();
  readonly entrants = input.required<ReadonlyMap<string, EntrantView>>();
  readonly rounds = input<KnockoutRoundView[]>([]);
  /** The score dialog may open (playable tournament, both sides known). */
  readonly interactive = input(false);
  readonly swapMode = input(false);
  readonly selected = input<string | null>(null);
  readonly highlight = input(false);
  /** A small caption above the rows ("კორტი 2"). */
  readonly label = input('');

  readonly open = output<MatchView>();
  readonly pick = output<string>();

  protected readonly sides = [0, 1] as const;
  protected readonly outcomeLabels = OUTCOME_LABELS;

  protected readonly names = computed(() => [
    sideNames(this.match(), 0, this.entrants(), this.rounds()),
    sideNames(this.match(), 1, this.entrants(), this.rounds()),
  ]);
  protected readonly scores = computed(() => [
    sideScore(this.match().score, 0),
    sideScore(this.match().score, 1),
  ]);
  protected readonly canOpen = computed(() => this.interactive() && isPlayable(this.match()));
  /** 'walkover' / 'retired', else null. */
  protected readonly awarded = computed(() => {
    const outcome = this.match().outcome;
    return outcome && outcome !== 'played' ? outcome : null;
  });
  protected readonly footer = computed(() => {
    const m = this.match();
    return [matchTimeLabel(m), m.court ?? ''].filter(Boolean).join(' · ');
  });
}
