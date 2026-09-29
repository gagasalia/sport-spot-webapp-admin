import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../../shared/ui/dialog.service';

/** Payload of the schedule dialog: the article's current `publishAt`, if any. */
export interface ArticleScheduleData {
  publishAt?: string | null;
}

/** A scheduled time must be at least this far ahead (the API rejects the past). */
export const SCHEDULE_MIN_LEAD_MS = 60_000;

/** Default time of day offered for a fresh schedule (tomorrow, 18:00 local — owner choice 2026-09-29; publish time has no ranking effect, the rebuild makes it crawlable within minutes). */
const DEFAULT_HOUR = 18;

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * `'2026-10-01'` + `'10:30'` → the Date of that wall-clock time in the
 * BROWSER's time zone (built from parts, never string-parsed, so no engine
 * guesses UTC). Null for malformed or non-existent values (Feb 31, a DST gap).
 */
export function localDateTime(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  if (!d || !t) {
    return null;
  }
  const [year, month, day, hour, minute] = [+d[1], +d[2], +d[3], +t[1], +t[2]];
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  const exact =
    result.getFullYear() === year &&
    result.getMonth() === month - 1 &&
    result.getDate() === day &&
    result.getHours() === hour &&
    result.getMinutes() === minute;
  return exact ? result : null;
}

/** Local date + time inputs → the ISO UTC instant the API stores (`…Z`). */
export function localDateTimeToIso(date: string, time: string): string | null {
  return localDateTime(date, time)?.toISOString() ?? null;
}

/** ISO instant → the local `{ date: 'YYYY-MM-DD', time: 'HH:mm' }` input values. */
export function isoToLocalParts(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** The current `publishAt` when it is still ahead, else tomorrow at 10:00. */
function initialParts(publishAt: string | null | undefined): { date: string; time: string } {
  const current = isoToLocalParts(publishAt);
  if (current && new Date(publishAt as string).getTime() > Date.now() + SCHEDULE_MIN_LEAD_MS) {
    return current;
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(DEFAULT_HOUR, 0, 0, 0);
  return isoToLocalParts(tomorrow.toISOString()) as { date: string; time: string };
}

const futureValidator: ValidatorFn = (group) => {
  const { date, time } = group.value as { date: string; time: string };
  const when = localDateTime(date, time);
  if (!when) {
    return { invalid: true };
  }
  return when.getTime() > Date.now() + SCHEDULE_MIN_LEAD_MS ? null : { past: true };
};

/**
 * «დაგეგმვა» — picks when a scheduled article goes live. The operator types
 * a LOCAL date (kit datepicker) and time; the dialog echoes the chosen local
 * time with the browser's time zone and completes with the ISO UTC instant
 * (`Date#toISOString`) for `PATCH /articles/:id/status`. Dismissal emits
 * nothing.
 */
@Component({
  selector: 'app-article-schedule-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4" novalidate>
      <p class="text-sm georgian-text" lang="ka" style="color: var(--tui-text-secondary)">
        {{ 'სტატია ავტომატურად გამოქვეყნდება არჩეულ დროს.' | t }}
      </p>
      <div class="flex flex-wrap gap-3">
        <label class="ss-field flex-1">
          <span class="ss-label georgian-text" lang="ka">{{ 'თარიღი' | t }}</span>
          <input
            class="ss-input"
            type="date"
            formControlName="date"
            data-testid="schedule-date"
            [attr.min]="minDate"
          />
        </label>
        <div class="ss-field flex-1">
          <span class="ss-label georgian-text" lang="ka">{{ 'დრო' | t }}</span>
          <div class="flex items-center gap-2">
            <select
              class="ss-input ss-select flex-1"
              data-testid="schedule-hour"
              [attr.aria-label]="'საათი' | t"
              [value]="hour()"
              (change)="setHour($any($event.target).value)"
            >
              @for (h of hours; track h) {
                <option [value]="h">{{ h }}</option>
              }
            </select>
            <span aria-hidden="true">:</span>
            <select
              class="ss-input ss-select flex-1"
              data-testid="schedule-minute"
              [attr.aria-label]="'წუთი' | t"
              [value]="minute()"
              (change)="setMinute($any($event.target).value)"
            >
              @for (m of minuteOptions(); track m) {
                <option [value]="m">{{ m }}</option>
              }
            </select>
          </div>
        </div>
      </div>

      @if (chosen(); as when) {
        <p class="text-sm georgian-text" lang="ka" data-testid="schedule-preview">
          {{ 'გამოქვეყნდება' | t }}:
          <strong>{{ when | date: 'dd/MM/yyyy HH:mm' }}</strong>
          <span style="color: var(--tui-text-secondary)"> ({{ timeZone }})</span>
        </p>
      }
      @if (submitted() && form.hasError('past')) {
        <span class="ss-error georgian-text" lang="ka" data-testid="schedule-error">
          {{ 'აირჩიეთ მომავალი დრო' | t }}
        </span>
      } @else if (submitted() && form.invalid) {
        <span class="ss-error georgian-text" lang="ka" data-testid="schedule-error">
          {{ 'მიუთითეთ თარიღი და დრო' | t }}
        </span>
      }

      <div class="flex justify-end gap-2 mt-2">
        <button class="ss-btn ss-btn--flat" type="button" (click)="cancel()">
          <span class="georgian-text" lang="ka">{{ 'გაუქმება' | t }}</span>
        </button>
        <button class="ss-btn ss-btn--primary" type="submit" data-testid="schedule-submit">
          <span class="georgian-text" lang="ka">{{ 'დაგეგმვა' | t }}</span>
        </button>
      </div>
    </form>
  `,
})
export class ArticleScheduleDialogComponent {
  private readonly context = inject(SS_DIALOG_CONTEXT) as SsDialogContext<
    string,
    ArticleScheduleData | undefined
  >;
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  protected readonly minDate = isoToLocalParts(new Date().toISOString())?.date ?? '';
  protected readonly submitted = signal(false);

  private readonly initial = initialParts(this.context.data?.publishAt);

  readonly form = this.fb.group(
    {
      date: [this.initial.date, [Validators.required]],
      time: [this.initial.time, [Validators.required]],
    },
    { validators: futureValidator },
  );

  private readonly value = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  /** The picked wall-clock time (local zone) — echoed back before confirming. */
  protected readonly chosen = computed(() => localDateTime(this.value().date, this.value().time));

  /** Hour / minute pickers (typing into a free time field was clumsy). */
  protected readonly hours = Array.from({ length: 24 }, (_, i) => pad(i));
  protected readonly hour = computed(() => (this.value().time || '00:00').slice(0, 2));
  protected readonly minute = computed(() => (this.value().time || '00:00').slice(3, 5));
  /** 5-minute steps, plus the stored minute when it is off-grid (e.g. 07:05). */
  protected readonly minuteOptions = computed(() => {
    const steps = Array.from({ length: 12 }, (_, i) => pad(i * 5));
    const current = this.minute();
    return steps.includes(current) ? steps : [...steps, current].sort();
  });

  protected setHour(hour: string): void {
    this.form.controls.time.setValue(`${pad(+hour)}:${this.minute()}`);
  }

  protected setMinute(minute: string): void {
    this.form.controls.time.setValue(`${this.hour()}:${pad(+minute)}`);
  }

  protected submit(): void {
    this.submitted.set(true);
    // "Future" is relative to NOW — re-check in case the dialog sat open.
    this.form.updateValueAndValidity();
    const iso = localDateTimeToIso(this.form.controls.date.value, this.form.controls.time.value);
    if (this.form.invalid || !iso) {
      this.form.markAllAsTouched();
      return;
    }
    this.context.completeWith(iso);
  }

  protected cancel(): void {
    this.context.dismiss();
  }
}
