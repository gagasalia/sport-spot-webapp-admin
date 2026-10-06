import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TPipe } from '../../../../shared/i18n/t.pipe';
import {
  MATCH_KIND_THIRD_PLACE,
  MatchStage,
  MatchView,
} from '../../../../shared/models/tournament-engine.model';
import { TournamentConsoleStore } from '../console.store';
import { OUTCOME_LABELS, isPlayable, matchTimeLabel, scoreLabel } from '../draw-display.util';

export type StatusFilter = 'all' | 'todo' | 'done';

export interface MatchSection {
  key: string;
  /** A match of the section — its stage / round label names the section. */
  sample: MatchView;
  matches: MatchView[];
}

export interface MatchFilters {
  status: StatusFilter;
  group: string | null;
  court: string | null;
}

const STAGE_ORDER: Record<MatchStage, number> = { group: 0, social: 1, knockout: 2 };

/** Filters, then sections by stage / round (the bronze match just before the final). */
export function matchSections(matches: MatchView[], filters: MatchFilters): MatchSection[] {
  const shown = matches.filter(
    (m) =>
      (filters.status === 'all' ||
        (filters.status === 'done' ? m.status === 'done' : m.status !== 'done')) &&
      (!filters.group || m.group === filters.group) &&
      (!filters.court || (m.court ?? '') === filters.court),
  );
  const sections = new Map<string, MatchSection>();
  for (const match of shown) {
    const bronze = match.kind === MATCH_KIND_THIRD_PLACE;
    const key = `${match.stage}|${match.round}|${bronze ? 'b' : ''}`;
    const section = sections.get(key) ?? { key, sample: match, matches: [] };
    section.matches.push(match);
    sections.set(key, section);
  }
  const rank = (s: MatchSection) => [
    STAGE_ORDER[s.sample.stage],
    s.sample.round,
    s.sample.kind === MATCH_KIND_THIRD_PLACE ? 0 : 1,
  ];
  return [...sections.values()]
    .sort((a, b) => {
      const [x, y] = [rank(a), rank(b)];
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    })
    .map((s) => ({
      ...s,
      matches: [...s.matches].sort(
        (a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.order - b.order,
      ),
    }));
}

/**
 * Step 5 «მატჩები» (docs/33 §4 result entry): every match by stage / round
 * with filter chips (all / to play / done, group, court). A row is time +
 * court, both sides and the score — or «შედეგის შეყვანა»; a tap opens the
 * score dialog. Rated matches carry a small «რეიტინგში» badge.
 */
@Component({
  selector: 'app-matches-step',
  standalone: true,
  imports: [TPipe],
  templateUrl: './matches-step.component.html',
  styleUrl: './matches-step.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchesStepComponent {
  protected readonly store = inject(TournamentConsoleStore);

  protected readonly outcomeLabels = OUTCOME_LABELS;
  protected readonly scoreLabel = scoreLabel;
  protected readonly timeLabel = matchTimeLabel;
  protected readonly isPlayable = isPlayable;

  protected readonly status = signal<StatusFilter>('all');
  protected readonly group = signal<string | null>(null);
  protected readonly court = signal<string | null>(null);

  protected readonly groupKeys = computed(() => (this.store.draw()?.groups ?? []).map((g) => g.key));
  protected readonly courtNames = computed(() =>
    [...new Set(this.store.matches().map((m) => m.court ?? '').filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    ),
  );
  protected readonly counts = computed(() => {
    const matches = this.store.matches();
    const done = matches.filter((m) => m.status === 'done').length;
    return { all: matches.length, done, todo: matches.length - done };
  });

  protected readonly sections = computed(() =>
    matchSections(this.store.matches(), {
      status: this.status(),
      group: this.group(),
      court: this.court(),
    }),
  );

  protected names(match: MatchView): [string, string] {
    return this.store.sideNames(match);
  }

  protected open(match: MatchView): void {
    this.store.openScore(match);
  }
}
