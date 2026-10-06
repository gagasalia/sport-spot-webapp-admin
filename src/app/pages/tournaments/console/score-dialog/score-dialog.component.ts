import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, switchMap, take } from 'rxjs';
import { TournamentEngineService } from '../../../../services/http-services/tournament-engine.service';
import { tr } from '../../../../shared/i18n/lang';
import { TPipe } from '../../../../shared/i18n/t.pipe';
import {
  DrawView,
  MatchOutcome,
  MatchView,
  StageScoring,
} from '../../../../shared/models/tournament-engine.model';
import { SsConfirmComponent, SsConfirmData } from '../../../../shared/ui/confirm.component';
import {
  SS_DIALOG_CONTEXT,
  SsDialogContext,
  SsDialogService,
} from '../../../../shared/ui/dialog.service';
import { matchTimeLabel } from '../draw-display.util';
import { EngineError, describeEngineError } from '../engine-errors.util';
import { renderMsg } from '../msg.util';
import {
  Cell,
  ScoreEntryState,
  checkScoreEntry,
  complementPoints,
  initialEntry,
  isTiebreakRow,
  previewWinner,
  shouldAdvance,
} from '../score-entry.util';

export interface ScoreDialogData {
  tournamentId: string;
  match: MatchView;
  scoring: StageScoring;
  /** A bracket match: a points game cannot end level. */
  knockout: boolean;
  names: [string, string];
  /** "ჯგუფი A · ტური 2" / "1/4". */
  label: string;
}

/**
 * The score dialog (docs/33 §7 "Score entry in one thumb reach"): a
 * scoreboard of big numeric cells — one column per possible set, focus
 * jumping on as soon as a cell is complete — or two point cells that fill
 * each other from the target. Walkover / retirement is a secondary row with a
 * winner pick. Validated client-side against the stage's scoring; the API's
 * `invalid_result: …` still shows inline if the two ever disagree. Completes
 * with the fresh draw view.
 */
@Component({
  selector: 'app-score-dialog',
  standalone: true,
  imports: [TPipe],
  templateUrl: './score-dialog.component.html',
  styleUrl: './score-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreDialogComponent {
  private readonly context = inject(SS_DIALOG_CONTEXT) as SsDialogContext<
    DrawView,
    ScoreDialogData
  >;
  private readonly engine = inject(TournamentEngineService);
  private readonly dialogs = inject(SsDialogService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = this.context.data;
  protected readonly scoring = this.data.scoring;
  protected readonly match = this.data.match;
  protected readonly names = this.data.names;
  protected readonly isSets = this.scoring.type === 'sets';
  protected readonly target = this.scoring.type === 'points' ? this.scoring.pointsTarget : undefined;
  protected readonly when = matchTimeLabel(this.match);
  protected readonly canClear = this.match.status === 'done';

  protected readonly state = signal<ScoreEntryState>(initialEntry(this.scoring, this.match));
  /** Set on the first save attempt: from then on every error shows. */
  protected readonly submitted = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly serverError = signal<EngineError | null>(null);

  protected readonly check = computed(() =>
    checkScoreEntry(this.scoring, this.state(), { knockout: this.data.knockout }),
  );
  protected readonly winner = computed(() =>
    previewWinner(this.scoring, this.state(), { knockout: this.data.knockout }),
  );
  protected readonly awarded = computed(() => this.state().outcome !== 'played');
  /** Set columns: 0 … bestOf − 1. */
  protected readonly columns = computed(() => this.state().sets.map((_, i) => i));

  /** Error lines in the live language (row errors first, then the whole result). */
  protected readonly errors = computed(() => {
    const check = this.check();
    const state = this.state();
    const rows = check.rowErrors
      .map((error, i) => {
        const [a, b] = state.sets[i] ?? [null, null];
        const show = this.submitted() || (a !== null && b !== null);
        return error && show ? `${tr('სეტი')} ${i + 1}: ${renderMsg(error)}` : '';
      })
      .filter(Boolean);
    const whole = check.error && this.submitted() ? [renderMsg(check.error)] : [];
    return [...rows, ...whole];
  });

  protected tiebreakColumn(column: number): boolean {
    return isTiebreakRow(this.scoring, column);
  }

  protected cellValue(cell: Cell): string {
    return cell === null ? '' : String(cell);
  }

  protected setOutcome(outcome: MatchOutcome): void {
    this.state.update((s) => ({ ...s, outcome, winner: outcome === 'played' ? null : s.winner }));
    this.serverError.set(null);
  }

  protected setWinner(winner: 0 | 1): void {
    this.state.update((s) => ({ ...s, winner }));
    this.serverError.set(null);
  }

  /** A set cell typed: digits only, then focus moves on when complete. */
  protected onSetInput(event: Event, column: number, side: 0 | 1): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 2);
    if (digits !== input.value) input.value = digits;
    const value = digits === '' ? null : Number(digits);
    this.state.update((s) => ({
      ...s,
      sets: s.sets.map((row, i) =>
        i === column ? (side === 0 ? [value, row[1]] : [row[0], value]) : row,
      ) as [Cell, Cell][],
    }));
    this.serverError.set(null);
    if (shouldAdvance(digits, this.tiebreakColumn(column))) {
      this.focusCell(column * 2 + side + 1);
    }
  }

  /** A point cell typed: the other side follows from the target. */
  protected onPointsInput(event: Event, side: 0 | 1): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 2);
    if (digits !== input.value) input.value = digits;
    const value = digits === '' ? null : Number(digits);
    const other = complementPoints(this.target, value);
    this.state.update((s) => {
      const points: [Cell, Cell] = [...s.points];
      points[side] = value;
      if (this.target) points[side === 0 ? 1 : 0] = other;
      return { ...s, points };
    });
    this.serverError.set(null);
  }

  /** Index order: set 1 side A, set 1 side B, set 2 side A … then Save. */
  private focusCell(index: number): void {
    const root = this.host.nativeElement;
    const next = root.querySelector<HTMLElement>(`[data-cell="${index}"]`);
    (next ?? root.querySelector<HTMLElement>('[data-save]'))?.focus();
    if (next instanceof HTMLInputElement) next.select();
  }

  protected save(): void {
    this.submitted.set(true);
    this.serverError.set(null);
    const payload = this.check().payload;
    if (!this.check().valid || !payload || this.isSaving()) return;
    this.isSaving.set(true);
    this.engine
      .setResult(this.data.tournamentId, this.match.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (view) => this.context.completeWith(view),
        error: (err: unknown) => {
          this.isSaving.set(false);
          this.serverError.set(describeEngineError(err));
        },
      });
  }

  protected clear(): void {
    if (this.isSaving()) return;
    const data: SsConfirmData = {
      content: tr('შედეგი წაიშლება და მატჩი ისევ დასათამაშებელი გახდება. რეიტინგში შეყვანილი შედეგი ანულირდება.'),
      yes: tr('წაშლა'),
      no: tr('გაუქმება'),
      appearance: 'destructive',
    };
    this.dialogs
      .open<boolean>(SsConfirmComponent, { label: tr('შედეგის წაშლა'), size: 's', data })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => {
          this.isSaving.set(true);
          this.serverError.set(null);
          return this.engine.clearResult(this.data.tournamentId, this.match.id);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (view) => this.context.completeWith(view),
        error: (err: unknown) => {
          this.isSaving.set(false);
          this.serverError.set(describeEngineError(err));
        },
      });
  }

  protected cancel(): void {
    this.context.dismiss();
  }
}
