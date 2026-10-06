import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TPipe } from '../../../../shared/i18n/t.pipe';
import {
  EntrantView,
  KnockoutView,
  MatchView,
} from '../../../../shared/models/tournament-engine.model';
import { ROUND_LABELS } from '../draw-display.util';
import { MatchCardComponent } from './match-card.component';

/** Height of one round-1 slot (a two-row match card + breathing room). */
export const BRACKET_SLOT_PX = 88;

export interface BracketColumn {
  round: number;
  /** API round key ('quarter', 'final', 'playin' …). */
  name: string;
  /** One cell per tree position; null = a bye (round 1) or not generated. */
  cells: (MatchView | null)[];
}

/** Rounds → columns, each match placed by its `order` inside the round's slots. */
export function bracketColumns(
  knockout: KnockoutView,
  matchById: ReadonlyMap<string, MatchView>,
): BracketColumn[] {
  return knockout.rounds.map((round) => {
    const cells: (MatchView | null)[] = Array.from({ length: round.slots }, () => null);
    for (const id of round.matches) {
      const match = matchById.get(id);
      if (match && match.order >= 0 && match.order < round.slots) cells[match.order] = match;
    }
    return { round: round.round, name: round.name, cells };
  });
}

/**
 * The knockout tree (docs/33 §7): one column per round with connector lines
 * between rounds, every match at its tree position (round 1 may be sparse —
 * byes), placeholders until a side is known; the bronze match apart. Scrolls
 * sideways inside its own container (scroll-snapping columns on a phone).
 */
@Component({
  selector: 'app-bracket',
  standalone: true,
  imports: [TPipe, MatchCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './bracket.component.css',
  template: `
    <div class="bk-scroll" data-testid="bracket">
      <div class="bk">
        <div class="bk-heads">
          @for (col of columns(); track col.round) {
            <span class="bk-head georgian-text" lang="ka" [attr.data-testid]="'round-' + col.round">
              {{ roundLabel(col.name) }}
            </span>
          }
        </div>
        <div class="bk-tree" [style.height.px]="height()">
          @for (col of columns(); track col.round; let c = $index; let last = $last) {
            <div class="bk-col">
              @for (cell of col.cells; track $index; let i = $index) {
                <div
                  class="bk-cell"
                  [class.has-out]="!!cell && !last"
                  [class.has-in]="c > 0"
                  [class.is-top]="i % 2 === 0"
                  [class.is-bottom]="i % 2 === 1"
                >
                  @if (c > 0) {
                    <span class="bk-in"></span>
                  }
                  @if (cell) {
                    <app-match-card
                      class="bk-card"
                      [match]="cell"
                      [entrants]="entrants()"
                      [rounds]="knockout().rounds"
                      [interactive]="interactive()"
                      [swapMode]="swapMode()"
                      [selected]="selected()"
                      (open)="openMatch.emit($event)"
                      (pick)="pick.emit($event)"
                    />
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
    @if (bronze(); as match) {
      <div class="bk-bronze">
        <span class="bk-head georgian-text" lang="ka">{{ 'მესამე ადგილი' | t }}</span>
        <app-match-card
          class="bk-card"
          [match]="match"
          [entrants]="entrants()"
          [rounds]="knockout().rounds"
          [interactive]="interactive()"
          (open)="openMatch.emit($event)"
        />
      </div>
    }
  `,
})
export class BracketComponent {
  readonly knockout = input.required<KnockoutView>();
  readonly matchById = input.required<ReadonlyMap<string, MatchView>>();
  readonly entrants = input.required<ReadonlyMap<string, EntrantView>>();
  readonly interactive = input(false);
  readonly swapMode = input(false);
  readonly selected = input<string | null>(null);

  readonly openMatch = output<MatchView>();
  readonly pick = output<string>();

  /** "1/4", "ნახევარფინალი" … in the live language (template call). */
  protected roundLabel(name: string): string {
    return ROUND_LABELS[name] || name;
  }

  protected readonly columns = computed(() => bracketColumns(this.knockout(), this.matchById()));
  protected readonly height = computed(
    () => Math.max(1, this.columns()[0]?.cells.length ?? 1) * BRACKET_SLOT_PX,
  );
  protected readonly bronze = computed(() => {
    const id = this.knockout().thirdPlace;
    return id ? (this.matchById().get(id) ?? null) : null;
  });
}
