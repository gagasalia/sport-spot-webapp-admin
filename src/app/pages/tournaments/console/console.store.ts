import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, take, tap } from 'rxjs';
import { TournamentService } from '../../../services/http-services/tournament.service';
import { TournamentEngineService } from '../../../services/http-services/tournament-engine.service';
import { tr } from '../../../shared/i18n/lang';
import { localizedName } from '../../../shared/i18n/localized';
import { Tournament, TournamentRegistration } from '../../../shared/models/tournament.model';
import {
  DrawView,
  MATCH_KIND_THIRD_PLACE,
  MatchView,
  StageScoring,
  TournamentCourt,
} from '../../../shared/models/tournament-engine.model';
import { SsDialogService } from '../../../shared/ui/dialog.service';
import { entrantMap, isPlayable, matchStageLabel, sideNames } from './draw-display.util';
import { ScoreDialogComponent, ScoreDialogData } from './score-dialog/score-dialog.component';
import { MatchTimeDialogComponent, MatchTimeDialogData } from './match-time-dialog.component';

/**
 * State of ONE console page (provided by TournamentConsoleComponent, so every
 * step shares it): the tournament, its draw view, the registration rows
 * (source + payment, which the view does not carry), the host's courts and
 * the event's categories.
 *
 * Engine writes answer with the fresh draw view → `applyDraw` replaces the
 * state; nothing is re-read. Entrant writes answer with a registration row →
 * `refreshEntrants` re-reads the draw + the rows (the API's only exception).
 */
@Injectable()
export class TournamentConsoleStore {
  private readonly tournaments = inject(TournamentService);
  private readonly engine = inject(TournamentEngineService);
  private readonly dialogs = inject(SsDialogService);

  readonly tournament = signal<Tournament | null>(null);
  readonly draw = signal<DrawView | null>(null);
  readonly registrations = signal<TournamentRegistration[]>([]);
  readonly courts = signal<TournamentCourt[]>([]);
  readonly categories = signal<Tournament[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  readonly id = computed(() => this.tournament()?._id ?? '');
  readonly format = computed(() => this.tournament()?.format ?? 'knockout');
  readonly type = computed(() => this.tournament()?.type ?? 'doubles');
  readonly isEvent = computed(() => !!this.tournament()?.event);
  readonly structure = computed(() => this.draw()?.structure ?? this.tournament()?.structure ?? null);
  readonly hasDraw = computed(() => !!this.draw() && this.draw()?.status !== 'none');
  readonly entrants = computed(() => this.draw()?.entrants ?? []);
  readonly entrantById = computed(() => entrantMap(this.entrants()));
  readonly matches = computed(() => this.draw()?.matches ?? []);
  readonly matchById = computed(() => new Map(this.matches().map((m) => [m.id, m])));
  readonly knockoutRounds = computed(() => this.draw()?.knockout?.rounds ?? []);
  readonly hasResults = computed(() => this.matches().some((m) => m.status === 'done'));
  readonly registrationById = computed(
    () => new Map(this.registrations().map((r) => [r._id, r])),
  );

  /** Structure, entrants, seeds and the draw can change (API `editable`). */
  readonly editable = computed(() => {
    const t = this.tournament();
    return !!t && !t.external && (t.status === 'draft' || t.status === 'published');
  });

  /** Results and the schedule can change (API `playable`: a draw, not cancelled). */
  readonly playable = computed(() => {
    const t = this.tournament();
    return !!t && !t.external && t.status !== 'cancelled' && this.hasDraw();
  });

  /** "Autumn Open" in the live language. */
  readonly name = computed(() => localizedName(this.tournament()));

  load(id: string): Observable<void> {
    this.loading.set(true);
    this.loadError.set(false);
    return forkJoin({
      tournament: this.tournaments.getTournament(id),
      draw: this.engine.getDraw(id),
      registrations: this.tournaments
        .getRegistrations(id)
        .pipe(catchError(() => of([] as TournamentRegistration[]))),
      courts: this.engine.getCourts(id).pipe(catchError(() => of([] as TournamentCourt[]))),
    }).pipe(
      switchMap((loaded) =>
        (loaded.tournament.event
          ? this.engine
              .getCategories(id)
              .pipe(catchError(() => of([loaded.tournament])))
          : of([loaded.tournament])
        ).pipe(map((categories) => ({ ...loaded, categories }))),
      ),
      tap((loaded) => {
        this.tournament.set(loaded.tournament);
        this.draw.set(loaded.draw);
        this.registrations.set(loaded.registrations ?? []);
        this.courts.set(loaded.courts);
        this.categories.set(loaded.categories);
        this.loading.set(false);
      }),
      map(() => undefined),
      catchError(() => {
        this.loading.set(false);
        this.loadError.set(true);
        return of(undefined);
      }),
    );
  }

  /** A write answered with the fresh view: it replaces the state. */
  applyDraw(view: DrawView): void {
    this.draw.set(view);
    // Keep the tournament's own engine fields in step (stepper, list badges).
    this.tournament.update((t) =>
      t ? { ...t, structure: view.structure, draw: { status: view.status } } : t,
    );
    this.categories.update((list) =>
      list.map((c) =>
        c._id === this.id() ? { ...c, structure: view.structure, draw: { status: view.status } } : c,
      ),
    );
  }

  /** After an entrant write: the draw view + the registration rows again. */
  refreshEntrants(): Observable<void> {
    const id = this.id();
    return forkJoin({
      draw: this.engine.getDraw(id),
      registrations: this.tournaments
        .getRegistrations(id)
        .pipe(catchError(() => of(this.registrations()))),
      tournament: this.tournaments.getTournament(id).pipe(catchError(() => of(this.tournament()))),
    }).pipe(
      tap(({ draw, registrations, tournament }) => {
        this.applyDraw(draw);
        this.registrations.set(registrations ?? []);
        if (tournament) {
          const { registeredCount } = tournament;
          this.tournament.update((t) => (t ? { ...t, registeredCount } : tournament));
          // …and the category chip of this console (its "8/8" counter).
          this.categories.update((list) =>
            list.map((c) => (c._id === id ? { ...c, registeredCount } : c)),
          );
        }
      }),
      map(() => undefined),
    );
  }

  /** The scoring a match of this stage is played under. */
  scoringFor(match: MatchView): StageScoring | null {
    const structure = this.structure();
    if (!structure) return null;
    return match.stage === 'knockout'
      ? (structure.knockoutScoring ?? structure.scoring)
      : structure.scoring;
  }

  /** The two sides as names (placeholders while unknown). */
  sideNames(match: MatchView): [string, string] {
    const entrants = this.entrantById();
    const rounds = this.knockoutRounds();
    return [sideNames(match, 0, entrants, rounds), sideNames(match, 1, entrants, rounds)];
  }

  matchLabel(match: MatchView): string {
    return matchStageLabel(match, this.knockoutRounds());
  }

  /** The score dialog for a match with both sides known. */
  openScore(match: MatchView): void {
    const scoring = this.scoringFor(match);
    if (!this.playable() || !scoring || !isPlayable(match)) return;
    const data: ScoreDialogData = {
      tournamentId: this.id(),
      match,
      scoring,
      knockout: match.stage === 'knockout',
      names: this.sideNames(match),
      label: this.matchLabel(match),
    };
    this.dialogs
      .open<DrawView>(ScoreDialogComponent, {
        // The outlet renders the header raw → translate at open time.
        label: tr(match.status === 'done' ? 'შედეგის შეცვლა' : 'შედეგის შეყვანა'),
        size: 'm',
        dismissible: true,
        closable: true,
        data,
      })
      .pipe(take(1))
      .subscribe((view) => {
        if (view) this.applyDraw(view);
      });
  }

  /** Court + time of one match (PATCH /matches/:matchId). */
  openTime(match: MatchView): void {
    if (!this.playable()) return;
    const t = this.tournament();
    const data: MatchTimeDialogData = {
      tournamentId: this.id(),
      match,
      names: this.sideNames(match),
      label: this.matchLabel(match),
      courts: this.courts(),
      usedCourts: [
        ...new Set(this.matches().map((m) => m.court?.trim() ?? '').filter(Boolean)),
      ],
      defaultDate: t?.startDate ?? '',
    };
    this.dialogs
      .open<DrawView>(MatchTimeDialogComponent, {
        label: tr('მატჩის დრო და კორტი'),
        size: 's',
        dismissible: true,
        closable: true,
        data,
      })
      .pipe(take(1))
      .subscribe((view) => {
        if (view) this.applyDraw(view);
      });
  }

  /** The bronze match is shown apart from the tree. */
  isBronze(match: MatchView): boolean {
    return match.kind === MATCH_KIND_THIRD_PLACE;
  }
}
