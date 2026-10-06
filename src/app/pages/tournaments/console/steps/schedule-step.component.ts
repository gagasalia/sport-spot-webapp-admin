import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { filter, switchMap, take } from 'rxjs';
import { TournamentEngineService } from '../../../../services/http-services/tournament-engine.service';
import { tr } from '../../../../shared/i18n/lang';
import { localizedName } from '../../../../shared/i18n/localized';
import { TPipe } from '../../../../shared/i18n/t.pipe';
import {
  AutoScheduleDto,
  COURT_NAME_MAX,
  MATCH_MINUTES_MAX,
  MATCH_MINUTES_MIN,
  MatchView,
  SCHEDULE_COURTS_MAX,
  SCHEDULE_SESSIONS_MAX,
  ScheduleCourtDto,
  ScheduleSessionDto,
  TournamentCourt,
} from '../../../../shared/models/tournament-engine.model';
import { SsConfirmComponent, SsConfirmData } from '../../../../shared/ui/confirm.component';
import { SsDialogService } from '../../../../shared/ui/dialog.service';
import { SsToastService } from '../../../../shared/ui/toast.service';
import { TournamentConsoleStore } from '../console.store';
import { EngineError, describeEngineError } from '../engine-errors.util';
import { renderMsg } from '../msg.util';
import {
  buildScheduleGrid,
  defaultMatchMinutes,
  defaultSessions,
  sessionsError,
  shortDay,
} from '../schedule.util';

/** The courts an auto-schedule uses: the ticked facility courts, then typed extras. */
export function scheduleCourts(
  facility: TournamentCourt[],
  ticked: ReadonlySet<string>,
  extras: string,
): ScheduleCourtDto[] {
  const out: ScheduleCourtDto[] = [];
  const seen = new Set<string>();
  for (const court of facility) {
    if (!ticked.has(court._id) || seen.has(court.name)) continue;
    seen.add(court.name);
    out.push({ name: court.name, courtId: court._id });
  }
  for (const raw of extras.split(',')) {
    const name = raw.trim().slice(0, COURT_NAME_MAX);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name });
  }
  return out.slice(0, SCHEDULE_COURTS_MAX);
}

/** The day after 'YYYY-MM-DD' (a new session row starts there). */
export function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/**
 * Step 4 «განრიგი» (docs/33 §3 scheduler): auto-schedule over the chosen
 * courts and sessions (the whole event by default — shared courts, nobody in
 * two places at once), the time × court grid of what is scheduled, the
 * matches still without a time, a per-match edit and "running late" delays.
 */
@Component({
  selector: 'app-schedule-step',
  standalone: true,
  imports: [FormsModule, TPipe],
  templateUrl: './schedule-step.component.html',
  styleUrl: './schedule-step.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleStepComponent {
  protected readonly store = inject(TournamentConsoleStore);
  private readonly engine = inject(TournamentEngineService);
  private readonly dialogs = inject(SsDialogService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly minutesMin = MATCH_MINUTES_MIN;
  protected readonly minutesMax = MATCH_MINUTES_MAX;
  protected readonly sessionsMax = SCHEDULE_SESSIONS_MAX;
  protected readonly delays = [10, 15, 30];
  protected readonly shortDay = shortDay;

  /** Facility courts ticked for the run (all, until the organizer unticks). */
  protected readonly ticked = linkedSignal<ReadonlySet<string>>(
    () => new Set(this.store.courts().map((c) => c._id)),
  );
  protected readonly extraCourts = signal('');
  protected readonly sessions = linkedSignal<ScheduleSessionDto[]>(() => {
    const t = this.store.tournament();
    return t ? defaultSessions(t.startDate, t.startTime) : [];
  });
  protected readonly matchMinutes = linkedSignal(() => defaultMatchMinutes(this.store.structure()));
  protected readonly onlyUnscheduled = signal(false);
  protected readonly wholeEvent = linkedSignal(() => this.store.isEvent());
  protected readonly busy = signal(false);
  protected readonly error = signal<EngineError | null>(null);

  protected readonly courts = computed(() =>
    scheduleCourts(this.store.courts(), this.ticked(), this.extraCourts()),
  );
  protected readonly problem = computed(() =>
    this.courts().length === 0
      ? 'აირჩიეთ ან ჩაწერეთ ერთი კორტი მაინც'
      : sessionsError(this.sessions(), Number(this.matchMinutes())),
  );
  protected readonly grid = computed(() =>
    buildScheduleGrid(
      this.store.matches(),
      this.store.courts().map((c) => c.name),
    ),
  );
  protected readonly hasScheduled = computed(() => this.grid().days.length > 0);

  protected courtLabel(court: TournamentCourt): string {
    return localizedName(court);
  }

  protected toggleCourt(id: string): void {
    this.ticked.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected patchSession(index: number, field: keyof ScheduleSessionDto, value: string): void {
    this.sessions.update((list) =>
      list.map((s, i) => (i === index ? { ...s, [field]: value ?? '' } : s)),
    );
  }

  protected addSession(): void {
    this.sessions.update((list) => {
      if (list.length >= SCHEDULE_SESSIONS_MAX) return list;
      const last = list[list.length - 1];
      return [...list, last ? { ...last, date: nextDay(last.date) } : { date: '', from: '10:00', to: '18:00' }];
    });
  }

  protected removeSession(index: number): void {
    this.sessions.update((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  /** POST /schedule/auto body. */
  body(): AutoScheduleDto {
    const body: AutoScheduleDto = {
      courts: this.courts(),
      sessions: this.sessions().map((s) => ({ date: s.date, from: s.from, to: s.to })),
      matchMinutes: Number(this.matchMinutes()),
      onlyUnscheduled: this.onlyUnscheduled(),
    };
    if (this.store.isEvent()) body.wholeEvent = this.wholeEvent();
    return body;
  }

  protected autoSchedule(): void {
    if (this.busy() || this.problem() || !this.store.playable()) return;
    this.busy.set(true);
    this.error.set(null);
    this.engine
      .autoSchedule(this.store.id(), this.body())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          this.store.applyDraw(result.draw);
          const parts = [renderMsg({ key: '%s მატჩი დაიგეგმა', args: [result.scheduled] })];
          if (result.unplaced > 0) {
            parts.push(renderMsg({ key: '%s ვერ ჩაეტია', args: [result.unplaced] }));
          }
          this.alerts
            .open(parts.join(' · '), { appearance: result.unplaced > 0 ? 'warning' : 'success' })
            .pipe(take(1))
            .subscribe();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(describeEngineError(err));
        },
      });
  }

  protected shift(minutes: number): void {
    const data: SsConfirmData = {
      content: renderMsg({
        key: 'ყველა ჯერ დაუსრულებელი მატჩი %s წუთით გადაიწევს.',
        args: [minutes],
      }),
      yes: tr('გადაწევა'),
      no: tr('გაუქმება'),
    };
    this.dialogs
      .open<boolean>(SsConfirmComponent, { label: tr('განრიგის გადაწევა'), size: 's', data })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => {
          this.busy.set(true);
          this.error.set(null);
          return this.engine.shiftSchedule(this.store.id(), {
            minutes,
            ...(this.store.isEvent() ? { wholeEvent: this.wholeEvent() } : {}),
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (view) => {
          this.busy.set(false);
          this.store.applyDraw(view);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(describeEngineError(err));
        },
      });
  }

  protected open(match: MatchView): void {
    this.store.openTime(match);
  }

  protected chipNames(match: MatchView): string {
    const [a, b] = this.store.sideNames(match);
    return `${a} — ${b}`;
  }
}
