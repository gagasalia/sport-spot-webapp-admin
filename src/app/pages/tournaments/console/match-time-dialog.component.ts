import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TournamentEngineService } from '../../../services/http-services/tournament-engine.service';
import { localizedName } from '../../../shared/i18n/localized';
import { TPipe } from '../../../shared/i18n/t.pipe';
import {
  COURT_NAME_MAX,
  DrawView,
  MatchView,
  ScheduleMatchDto,
  TournamentCourt,
} from '../../../shared/models/tournament-engine.model';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../../shared/ui/dialog.service';
import { EngineError, describeEngineError } from './engine-errors.util';
import { isoToWallClock, wallClockToIso } from './schedule.util';

export interface MatchTimeDialogData {
  tournamentId: string;
  match: MatchView;
  names: [string, string];
  label: string;
  /** The host facility's courts. */
  courts: TournamentCourt[];
  /** Court names already used by the draw (free-text ones included). */
  usedCourts: string[];
  /** Prefill for an unscheduled match: the tournament's start day. */
  defaultDate: string;
}

let nextListId = 0;

/**
 * One match's court + time (PATCH /tournaments/:id/matches/:matchId, null
 * clears). The court is a facility court or free text; the time is the
 * facility's wall clock. Completes with the fresh draw view.
 */
@Component({
  selector: 'app-match-time-dialog',
  standalone: true,
  imports: [FormsModule, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4" data-testid="match-time-dialog">
      <div class="text-sm" style="color: var(--text-muted)">
        <span class="georgian-text" lang="ka">{{ data.label }}</span>
        <div class="font-medium" style="color: var(--text)">{{ data.names[0] }} — {{ data.names[1] }}</div>
      </div>

      <label class="ss-field">
        <span class="ss-label georgian-text" lang="ka">{{ 'კორტი' | t }}</span>
        <input
          class="ss-input"
          type="text"
          autocomplete="off"
          data-testid="time-court"
          [attr.list]="listId"
          [maxlength]="courtMax"
          [ngModel]="court()"
          (ngModelChange)="court.set($event ?? '')"
        />
        <datalist [id]="listId">
          @for (name of courtNames; track name) {
            <option [value]="name"></option>
          }
        </datalist>
      </label>

      <div class="grid grid-cols-2 gap-3">
        <label class="ss-field">
          <span class="ss-label georgian-text" lang="ka">{{ 'თარიღი' | t }}</span>
          <input
            class="ss-input"
            type="date"
            data-testid="time-date"
            [ngModel]="date()"
            (ngModelChange)="date.set($event ?? '')"
          />
        </label>
        <label class="ss-field">
          <span class="ss-label georgian-text" lang="ka">{{ 'დრო' | t }}</span>
          <input
            class="ss-input"
            type="time"
            data-testid="time-time"
            [ngModel]="time()"
            (ngModelChange)="time.set($event ?? '')"
          />
        </label>
      </div>

      @if (partial()) {
        <span class="ss-error georgian-text" lang="ka">{{ 'მიუთითეთ თარიღიც და დროც' | t }}</span>
      }
      @if (serverError(); as e) {
        <span class="ss-error georgian-text" lang="ka" role="alert">
          {{ e.message | t }}
          @if (e.detail) {
            · {{ e.detail }}
          }
        </span>
      }

      <div class="flex flex-wrap items-center gap-2">
        <button class="ss-btn ss-btn--flat ss-btn--s" type="button" (click)="clearTime()">
          <span class="georgian-text" lang="ka">{{ 'დროის მოხსნა' | t }}</span>
        </button>
        <span class="flex-1"></span>
        <button class="ss-btn ss-btn--flat" type="button" (click)="cancel()">
          <span class="georgian-text" lang="ka">{{ 'გაუქმება' | t }}</span>
        </button>
        <button
          class="ss-btn ss-btn--primary"
          type="button"
          data-testid="time-save"
          [disabled]="isSaving() || partial()"
          (click)="save()"
        >
          <span class="georgian-text" lang="ka">{{ (isSaving() ? 'ინახება...' : 'შენახვა') | t }}</span>
        </button>
      </div>
    </div>
  `,
})
export class MatchTimeDialogComponent {
  private readonly context = inject(SS_DIALOG_CONTEXT) as SsDialogContext<
    DrawView,
    MatchTimeDialogData
  >;
  private readonly engine = inject(TournamentEngineService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = this.context.data;
  protected readonly listId = `ss-courts-${++nextListId}`;
  protected readonly courtMax = COURT_NAME_MAX;
  /** Facility courts first, then the free-text ones the draw already uses. */
  protected readonly courtNames = [
    ...new Set([...this.data.courts.map((c) => c.name), ...this.data.usedCourts]),
  ];

  private readonly initial = this.data.match.scheduledAt
    ? isoToWallClock(this.data.match.scheduledAt)
    : { date: this.data.defaultDate, time: '' };

  protected readonly court = signal(this.data.match.court ?? '');
  protected readonly date = signal(this.initial.date);
  protected readonly time = signal(this.initial.time);
  protected readonly isSaving = signal(false);
  protected readonly serverError = signal<EngineError | null>(null);

  /** One of date / time without the other. */
  protected readonly partial = computed(() => !!this.date() !== !!this.time() && !!this.time());

  /** The PATCH body: a cleared field goes over as null. */
  payload(): ScheduleMatchDto {
    const court = this.court().trim();
    const facilityCourt = this.data.courts.find(
      (c) => c.name === court || localizedName(c) === court,
    );
    return {
      court: court || null,
      courtId: facilityCourt?._id ?? null,
      scheduledAt: this.date() && this.time() ? wallClockToIso(this.date(), this.time()) : null,
    };
  }

  protected clearTime(): void {
    this.time.set('');
  }

  protected save(): void {
    if (this.isSaving() || this.partial()) return;
    this.isSaving.set(true);
    this.serverError.set(null);
    this.engine
      .scheduleMatch(this.data.tournamentId, this.data.match.id, this.payload())
      .pipe(takeUntilDestroyed(this.destroyRef))
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
