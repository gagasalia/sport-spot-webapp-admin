import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TPipe } from '../../../../shared/i18n/t.pipe';
import {
  EntrantView,
  GroupView,
  MatchView,
  ScoringType,
  StandingRowView,
  StandingZone,
} from '../../../../shared/models/tournament-engine.model';
import { ZONE_LABELS } from '../draw-display.util';
import { MatchCardComponent } from './match-card.component';

/**
 * One group (docs/33 §7 "Table with a coloured qualification zone"): the
 * live table with a left colour bar per row by zone (direct green, playoff
 * amber, wildcard blue), a legend, and the group's matches underneath. A tap
 * on a row highlights that entrant's matches; in SWAP mode it picks the
 * entrant instead.
 */
@Component({
  selector: 'app-group-card',
  standalone: true,
  imports: [TPipe, MatchCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './group-card.component.css',
  template: `
    <section class="gc ss-card" [attr.data-testid]="'group-' + group().key">
      <header class="gc-head">
        <h3 class="georgian-text" lang="ka">{{ 'ჯგუფი' | t }} {{ group().key }}</h3>
        @if (group().closed) {
          <span class="ss-badge ss-badge--neutral georgian-text" lang="ka">{{ 'ეტაპი დახურულია' | t }}</span>
        }
      </header>
      <div class="gc-scroll">
        <table class="gc-table">
          <thead>
            <tr>
              <th>#</th>
              <th class="gc-left georgian-text" lang="ka">{{ 'მონაწილე' | t }}</th>
              <th class="georgian-text" lang="ka" [title]="'ნათამაშები' | t">{{ 'თ' | t }}</th>
              @if (scoring() === 'points') {
                <th class="georgian-text" lang="ka">{{ 'ქულები' | t }}</th>
                <th>±</th>
              } @else {
                <th class="georgian-text" lang="ka" [title]="'მოგება' | t">{{ 'მ' | t }}</th>
                <th class="georgian-text" lang="ka" [title]="'წაგება' | t">{{ 'წ' | t }}</th>
                <th class="georgian-text" lang="ka">{{ 'სეტები' | t }}</th>
                <th class="georgian-text gc-games" lang="ka">{{ 'გეიმები' | t }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of group().standings; track row.entrant) {
              <tr [class]="'z-' + (row.zone ?? 'none')" [class.is-focus]="focus() === row.entrant">
                <td class="ss-num gc-rank">{{ row.rank }}</td>
                <td class="gc-left">
                  <button
                    type="button"
                    class="gc-name"
                    [class.is-picked]="swapMode() && selected() === row.entrant"
                    [class.is-pickable]="swapMode()"
                    [attr.data-testid]="'row-' + row.entrant"
                    (click)="rowClick(row)"
                  >
                    {{ nameOf(row.entrant) }}
                  </button>
                </td>
                <td class="ss-num">{{ row.played }}</td>
                @if (scoring() === 'points') {
                  <td class="ss-num">{{ row.pointsFor }}</td>
                  <td class="ss-num">{{ signed(row.pointsFor - row.pointsAgainst) }}</td>
                } @else {
                  <td class="ss-num">{{ row.won }}</td>
                  <td class="ss-num">{{ row.lost }}</td>
                  <td class="ss-num">{{ row.setsFor }}:{{ row.setsAgainst }}</td>
                  <td class="ss-num gc-games">{{ row.gamesFor }}:{{ row.gamesAgainst }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (zones().length) {
        <ul class="gc-legend">
          @for (zone of zones(); track zone) {
            <li class="georgian-text" lang="ka"><i [class]="'z-dot z-' + zone"></i>{{ zoneLabels[zone] }}</li>
          }
        </ul>
      }
      @if (matches().length) {
        <div class="gc-matches">
          @for (m of matches(); track m.id) {
            <app-match-card
              [match]="m"
              [entrants]="entrants()"
              [interactive]="interactive()"
              [highlight]="!!focus() && involves(m, focus()!)"
              (open)="openMatch.emit($event)"
            />
          }
        </div>
      }
    </section>
  `,
})
export class GroupCardComponent {
  readonly group = input.required<GroupView>();
  readonly scoring = input<ScoringType>('sets');
  readonly entrants = input.required<ReadonlyMap<string, EntrantView>>();
  readonly matches = input<MatchView[]>([]);
  readonly interactive = input(false);
  readonly swapMode = input(false);
  readonly selected = input<string | null>(null);

  readonly openMatch = output<MatchView>();
  readonly pick = output<string>();

  protected readonly zoneLabels = ZONE_LABELS;
  /** The entrant whose matches are highlighted. */
  protected readonly focus = signal<string | null>(null);

  /** The zones present in this table, in legend order. */
  protected readonly zones = computed(() => {
    const present = new Set(this.group().standings.map((row) => row.zone));
    return (['direct', 'playoff', 'wildcard'] as StandingZone[]).filter((z) => present.has(z));
  });

  protected nameOf(id: string): string {
    return this.entrants().get(id)?.name ?? '—';
  }

  protected signed(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }

  protected involves(match: MatchView, entrant: string): boolean {
    return match.sides.some((side) => side.entrants.includes(entrant));
  }

  protected rowClick(row: StandingRowView): void {
    if (this.swapMode()) {
      this.pick.emit(row.entrant);
      return;
    }
    this.focus.update((current) => (current === row.entrant ? null : row.entrant));
  }
}
