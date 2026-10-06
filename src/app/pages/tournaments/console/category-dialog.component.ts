import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TournamentEngineService } from '../../../services/http-services/tournament-engine.service';
import { TPipe } from '../../../shared/i18n/t.pipe';
import {
  Tournament,
  TournamentCategory,
  TournamentFormat,
  TournamentLevel,
  TournamentType,
} from '../../../shared/models/tournament.model';
import {
  CATEGORY_LABEL_MAX,
  TournamentCategoryDto,
} from '../../../shared/models/tournament-engine.model';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../../shared/ui/dialog.service';
import { gelToTetri } from '../../../shared/utils/money.util';
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  LEVEL_LABELS,
  TYPE_LABELS,
} from '../tournament-labels';
import { EngineError, describeEngineError } from './engine-errors.util';

export interface CategoryDialogData {
  tournamentId: string;
  /** The current category: the new one starts from its type / format. */
  base: Pick<Tournament, 'type' | 'format' | 'level' | 'category' | 'entryFeeTetri' | 'maxParticipants'>;
}

/**
 * «+ კატეგორია» (POST /tournaments/:id/categories, docs/33 §2.5): one more
 * category of the event — its own type, format, level, fee and capacity; the
 * name, venue, dates, description and prize are the event's. Completes with
 * the created tournament.
 */
@Component({
  selector: 'app-category-dialog',
  standalone: true,
  imports: [FormsModule, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4" data-testid="category-dialog">
      <div class="grid grid-cols-2 gap-3">
        <label class="ss-field">
          <span class="ss-label georgian-text" lang="ka">{{ 'კატეგორიის სახელი' | t }}</span>
          <input
            class="ss-input georgian-text"
            lang="ka"
            data-testid="cat-label"
            [maxlength]="labelMax"
            [placeholder]="'მაგ. კაცები A' | t"
            [ngModel]="label()"
            (ngModelChange)="label.set($event ?? '')"
          />
        </label>
        <label class="ss-field">
          <span class="ss-label">Label (English)</span>
          <input
            class="ss-input"
            [maxlength]="labelMax"
            placeholder="Men A"
            [ngModel]="labelEn()"
            (ngModelChange)="labelEn.set($event ?? '')"
          />
        </label>
        <label class="ss-field">
          <span class="ss-label georgian-text" lang="ka">{{ 'ტიპი' | t }}</span>
          <select class="ss-input georgian-text" lang="ka" [ngModel]="type()" (ngModelChange)="type.set($event)">
            @for (option of typeOptions; track option) {
              <option [value]="option">{{ typeLabels[option] }}</option>
            }
          </select>
        </label>
        <label class="ss-field">
          <span class="ss-label georgian-text" lang="ka">{{ 'ფორმატი' | t }}</span>
          <select class="ss-input georgian-text" lang="ka" [ngModel]="format()" (ngModelChange)="format.set($event)">
            @for (option of formatOptions; track option) {
              <option [value]="option">{{ formatLabels[option] }}</option>
            }
          </select>
        </label>
        <label class="ss-field">
          <span class="ss-label georgian-text" lang="ka">{{ 'კატეგორია' | t }}</span>
          <select class="ss-input georgian-text" lang="ka" [ngModel]="category()" (ngModelChange)="category.set($event)">
            @for (option of categoryOptions; track option) {
              <option [value]="option">{{ categoryLabels[option] }}</option>
            }
          </select>
        </label>
        <label class="ss-field">
          <span class="ss-label georgian-text" lang="ka">{{ 'დონე' | t }}</span>
          <select class="ss-input georgian-text" lang="ka" [ngModel]="level()" (ngModelChange)="level.set($event)">
            @for (option of levelOptions; track option) {
              <option [value]="option">{{ levelLabels[option] }}</option>
            }
          </select>
        </label>
        <label class="ss-field">
          <span class="ss-label georgian-text" lang="ka">{{ 'საფასური (₾)' | t }}</span>
          <input
            class="ss-input"
            type="number"
            min="0"
            step="0.5"
            data-testid="cat-fee"
            [ngModel]="feeGel()"
            (ngModelChange)="feeGel.set($event)"
          />
        </label>
        <label class="ss-field">
          <span class="ss-label georgian-text" lang="ka">{{ 'ადგილები' | t }}</span>
          <input
            class="ss-input"
            type="number"
            min="2"
            max="512"
            data-testid="cat-capacity"
            [ngModel]="capacity()"
            (ngModelChange)="capacity.set($event)"
          />
        </label>
      </div>
      <p class="m-0 text-xs georgian-text" lang="ka" style="color: var(--text-faint)">
        {{ 'სახელი, ობიექტი, თარიღები, აღწერა და პრიზი ღონისძიების ყველა კატეგორიას აქვს საერთო' | t }}
      </p>
      @if (invalid()) {
        <span class="ss-error georgian-text" lang="ka">{{ 'საფასური 0–10000 ₾, ადგილები 2–512' | t }}</span>
      }
      @if (serverError(); as e) {
        <span class="ss-error georgian-text" lang="ka" role="alert">
          {{ e.message | t }}
          @if (e.detail) {
            · {{ e.detail }}
          }
        </span>
      }
      <div class="flex justify-end gap-2">
        <button class="ss-btn ss-btn--flat" type="button" (click)="cancel()">
          <span class="georgian-text" lang="ka">{{ 'გაუქმება' | t }}</span>
        </button>
        <button
          class="ss-btn ss-btn--primary"
          type="button"
          data-testid="cat-save"
          [disabled]="isSaving() || invalid()"
          (click)="save()"
        >
          <span class="georgian-text" lang="ka">{{ (isSaving() ? 'ინახება...' : 'დამატება') | t }}</span>
        </button>
      </div>
    </div>
  `,
})
export class CategoryDialogComponent {
  private readonly context = inject(SS_DIALOG_CONTEXT) as SsDialogContext<
    Tournament,
    CategoryDialogData
  >;
  private readonly engine = inject(TournamentEngineService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly labelMax = CATEGORY_LABEL_MAX;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly formatLabels = FORMAT_LABELS;
  protected readonly levelLabels = LEVEL_LABELS;
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly typeOptions = Object.keys(TYPE_LABELS) as TournamentType[];
  protected readonly formatOptions = Object.keys(FORMAT_LABELS) as TournamentFormat[];
  protected readonly levelOptions = Object.keys(LEVEL_LABELS) as TournamentLevel[];
  protected readonly categoryOptions = Object.keys(CATEGORY_LABELS) as TournamentCategory[];

  private readonly base = this.context.data.base;
  protected readonly label = signal('');
  protected readonly labelEn = signal('');
  protected readonly type = signal<TournamentType>(this.base.type);
  protected readonly format = signal<TournamentFormat>(this.base.format);
  protected readonly category = signal<TournamentCategory>(this.base.category ?? 'mixed');
  protected readonly level = signal<TournamentLevel>(this.base.level ?? 'any');
  protected readonly feeGel = signal<number>((this.base.entryFeeTetri ?? 0) / 100);
  protected readonly capacity = signal<number>(this.base.maxParticipants ?? 16);
  protected readonly isSaving = signal(false);
  protected readonly serverError = signal<EngineError | null>(null);

  protected readonly invalid = computed(() => {
    const fee = Number(this.feeGel());
    const capacity = Number(this.capacity());
    return (
      !Number.isFinite(fee) ||
      fee < 0 ||
      fee > 10_000 ||
      !Number.isInteger(capacity) ||
      capacity < 2 ||
      capacity > 512
    );
  });

  /** POST body — empty labels left out (the API builds one from category + level). */
  payload(): TournamentCategoryDto {
    const label = this.label().trim();
    const labelEn = this.labelEn().trim();
    return {
      ...(label ? { label } : {}),
      ...(labelEn ? { labelEn } : {}),
      type: this.type(),
      format: this.format(),
      category: this.category(),
      level: this.level(),
      entryFeeTetri: gelToTetri(Number(this.feeGel())),
      maxParticipants: Number(this.capacity()),
    };
  }

  protected save(): void {
    if (this.isSaving() || this.invalid()) return;
    this.isSaving.set(true);
    this.serverError.set(null);
    this.engine
      .addCategory(this.context.data.tournamentId, this.payload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => this.context.completeWith(created),
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
