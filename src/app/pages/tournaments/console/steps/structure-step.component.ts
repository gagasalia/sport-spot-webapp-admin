import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { TournamentEngineService } from '../../../../services/http-services/tournament-engine.service';
import { tr } from '../../../../shared/i18n/lang';
import { TPipe } from '../../../../shared/i18n/t.pipe';
import {
  Advancement,
  BestOf,
  GROUPS_MAX,
  MexicanoPairing,
  POINTS_TARGET_MAX,
  POINTS_TARGET_MIN,
  SOCIAL_COURTS_MAX,
  SOCIAL_ROUNDS_MAX,
  ScoringType,
  WILDCARDS_MAX,
} from '../../../../shared/models/tournament-engine.model';
import { SsToastService } from '../../../../shared/ui/toast.service';
import { FORMAT_LABELS, TYPE_LABELS } from '../../tournament-labels';
import { TournamentConsoleStore } from '../console.store';
import { EngineError, describeEngineError } from '../engine-errors.util';
import {
  POINTS_PRESETS,
  StructureForm,
  advancementPositions,
  formError,
  formToDto,
  formToStructure,
  hasGroupStage,
  isIndividualSocial,
  isSocialFormat,
  nextAdvancement,
  renderSummary,
  structureSummary,
  structureToForm,
} from '../engine-structure.util';
import { renderMsg } from '../msg.util';

const ADVANCEMENT_LABELS: Record<Advancement, string> = {
  direct: 'პირდაპირ',
  playoff: 'საკვალიფიკაციო',
  out: 'გავარდა',
};

/**
 * Step 2 «ფორმატი» (docs/33 §2.1): the settings of the tournament's format
 * (the format itself is changed in the edit dialog) and a LIVE SUMMARY of
 * what the current entrants turn into, with a warning when they do not fit.
 * Saved with PUT /structure; read-only once a draw exists.
 */
@Component({
  selector: 'app-structure-step',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, TPipe],
  templateUrl: './structure-step.component.html',
  styleUrl: './structure-step.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StructureStepComponent {
  protected readonly store = inject(TournamentConsoleStore);
  private readonly engine = inject(TournamentEngineService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly bestOfOptions: BestOf[] = [1, 3, 5];
  protected readonly pointsPresets = POINTS_PRESETS;
  protected readonly limits = {
    groups: GROUPS_MAX,
    wildcards: WILDCARDS_MAX,
    rounds: SOCIAL_ROUNDS_MAX,
    courts: SOCIAL_COURTS_MAX,
    pointsMin: POINTS_TARGET_MIN,
    pointsMax: POINTS_TARGET_MAX,
  };

  protected readonly format = this.store.format;
  protected readonly social = computed(() => isSocialFormat(this.format()));
  protected readonly league = computed(
    () => hasGroupStage(this.format()) && this.format() !== 'groups_playoffs',
  );
  protected readonly playoffs = computed(() => this.format() === 'groups_playoffs');
  protected readonly knockout = computed(() => this.format() === 'knockout');
  protected readonly individual = computed(() =>
    isIndividualSocial(this.format(), this.store.type()),
  );
  protected readonly formatLabel = computed(() => FORMAT_LABELS[this.format()]);
  protected readonly typeLabel = computed(() => TYPE_LABELS[this.store.type()]);

  /** The editable settings — follow the stored structure until edited. */
  protected readonly form = linkedSignal<StructureForm>(() =>
    structureToForm(this.format(), this.store.structure()),
  );
  /** "სხვა" chip: a custom points target. */
  protected readonly customPoints = linkedSignal(() => {
    const target = this.form().pointsTarget;
    return target !== null && !(POINTS_PRESETS as readonly number[]).includes(target);
  });

  protected readonly readOnly = computed(() => this.store.hasDraw() || !this.store.editable());
  protected readonly busy = signal(false);
  protected readonly error = signal<EngineError | null>(null);

  protected readonly entrantCount = computed(() => this.store.entrants().length);
  protected readonly problem = computed(() => formError(this.format(), this.form()));
  private readonly summary = computed(() =>
    structureSummary(
      this.format(),
      this.store.type(),
      formToStructure(this.format(), this.form()),
      this.entrantCount(),
    ),
  );
  /** Rendered here (a computed), so a language flip re-renders it. */
  protected readonly summaryText = computed(() => renderSummary(this.summary()));
  protected readonly shortfallText = computed(() => renderMsg(this.summary().shortfall));

  /** Advancement chips: one per group position up to the largest group. */
  protected readonly positions = computed(() => {
    const count = advancementPositions(
      this.entrantCount(),
      this.form().groupCount,
      this.form().advancement.length,
    );
    return Array.from({ length: count }, (_, i) => ({
      index: i,
      rule: this.form().advancement[i] ?? ('out' as Advancement),
    }));
  });

  /** Nothing saved yet, or the form differs from what is stored. */
  protected readonly dirty = computed(() => {
    const stored = this.store.structure();
    if (!stored) return true;
    const format = this.format();
    return (
      JSON.stringify(formToDto(format, this.form())) !==
      JSON.stringify(formToDto(format, structureToForm(format, stored)))
    );
  });

  protected advancementLabel(rule: Advancement): string {
    return tr(ADVANCEMENT_LABELS[rule]);
  }

  /** "1 ადგილი" / "Place 1". */
  protected positionLabel(index: number): string {
    return renderMsg({ key: '%s ადგილი', args: [index + 1] });
  }

  protected patch(patch: Partial<StructureForm>): void {
    if (this.readOnly()) return;
    this.form.update((f) => ({ ...f, ...patch }));
    this.error.set(null);
  }

  protected setNumber(field: keyof StructureForm, value: unknown): void {
    const n = Number(value);
    this.patch({ [field]: Number.isFinite(n) ? Math.round(n) : 0 } as Partial<StructureForm>);
  }

  protected setScoringType(scoringType: ScoringType): void {
    this.patch({ scoringType });
  }

  /** A new best-of starts from the API default: a super tiebreak decider from 3 sets on. */
  protected setBestOf(bestOf: BestOf): void {
    this.patch({ bestOf, superTiebreak: bestOf > 1 });
  }

  protected setKoBestOf(koBestOf: BestOf): void {
    this.patch({ koBestOf, koSuperTiebreak: koBestOf > 1 });
  }

  protected setPoints(target: number | null): void {
    this.customPoints.set(false);
    this.patch({ pointsTarget: target });
  }

  protected chooseCustomPoints(): void {
    this.customPoints.set(true);
  }

  protected setPairing(pairing: MexicanoPairing): void {
    this.patch({ pairing });
  }

  /** direct → playoff → out → direct. */
  protected cycleAdvancement(index: number): void {
    const advancement = [...this.form().advancement];
    while (advancement.length <= index) advancement.push('out');
    advancement[index] = nextAdvancement(advancement[index]);
    this.patch({ advancement });
  }

  protected save(): void {
    if (this.readOnly() || this.busy() || this.problem()) return;
    this.busy.set(true);
    this.error.set(null);
    this.engine
      .setStructure(this.store.id(), formToDto(this.format(), this.form()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (view) => {
          this.busy.set(false);
          this.store.applyDraw(view);
          this.alerts.open(tr('ფორმატი შენახულია'), { appearance: 'success' }).pipe(take(1)).subscribe();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(describeEngineError(err));
        },
      });
  }
}
