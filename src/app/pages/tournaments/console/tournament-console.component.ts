import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, distinctUntilChanged, filter, finalize, map, switchMap, take } from 'rxjs';
import { TournamentService } from '../../../services/http-services/tournament.service';
import { tr } from '../../../shared/i18n/lang';
import { FacilityNamesService } from '../../../shared/i18n/facility-names.service';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { Tournament } from '../../../shared/models/tournament.model';
import { SsConfirmComponent, SsConfirmData } from '../../../shared/ui/confirm.component';
import { SsDialogService } from '../../../shared/ui/dialog.service';
import { SsToastService } from '../../../shared/ui/toast.service';
import {
  EventScope,
  EventScopeDialogComponent,
  EventScopeDialogData,
} from '../event-scope-dialog.component';
import { STATUS_CLASSES, STATUS_LABELS, categoryLabel } from '../tournament-labels';
import { CategoryDialogComponent, CategoryDialogData } from './category-dialog.component';
import { TournamentConsoleStore } from './console.store';
import { STEP_KEYS, STEP_LABELS, StepKey, initialStep, stepStates } from './console-steps.util';
import { DrawStepComponent } from './steps/draw-step.component';
import { EntrantsStepComponent } from './steps/entrants-step.component';
import { MatchesStepComponent } from './steps/matches-step.component';
import { ScheduleStepComponent } from './steps/schedule-step.component';
import { StructureStepComponent } from './steps/structure-step.component';

/**
 * The ORGANIZER CONSOLE (docs/33 §7) — `/tournaments/:id`, a full page for
 * everything engine-related: entrants → format → draw → schedule → matches.
 * The stepper IS the tab bar (each step done / current / waiting) and the
 * page opens on the first step that still needs work. One `GET /:id` +
 * `GET /:id/draw` render it; every engine write answers with the fresh draw
 * view, which replaces the state (TournamentConsoleStore).
 *
 * An event's categories are sibling consoles: the chips switch between them
 * and «+ კატეგორია» adds one.
 */
@Component({
  selector: 'app-tournament-console',
  standalone: true,
  imports: [
    RouterLink,
    TPipe,
    EntrantsStepComponent,
    StructureStepComponent,
    DrawStepComponent,
    ScheduleStepComponent,
    MatchesStepComponent,
  ],
  providers: [TournamentConsoleStore],
  templateUrl: './tournament-console.component.html',
  styleUrl: './tournament-console.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentConsoleComponent {
  protected readonly store = inject(TournamentConsoleStore);
  private readonly tournaments = inject(TournamentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogs = inject(SsDialogService);
  private readonly alerts = inject(SsToastService);
  private readonly facilityNames = inject(FacilityNamesService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly stepKeys = STEP_KEYS;
  protected readonly stepLabels = STEP_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusClasses = STATUS_CLASSES;

  /** The open tab; set to the first step that needs work on every load. */
  protected readonly step = signal<StepKey>('entrants');

  protected readonly states = computed(() =>
    stepStates({ format: this.store.format(), type: this.store.type(), draw: this.store.draw() }),
  );

  protected readonly facility = computed(() => {
    const t = this.store.tournament();
    return t ? this.facilityNames.label(t.facility, t.facilityName) : '';
  });

  protected readonly categoryName = computed(() => {
    const t = this.store.tournament();
    return t?.event ? categoryLabel(t) : '';
  });

  /**
   * The lifecycle move that is due, offered next to the status: a draft can
   * be published (players see nothing of a draft), a published tournament
   * whose last match is played can be completed.
   */
  protected readonly lifecycle = computed<'published' | 'completed' | null>(() => {
    const t = this.store.tournament();
    if (!t || t.external) return null;
    if (t.status === 'draft') return 'published';
    return t.status === 'published' && this.store.draw()?.stage === 'finished'
      ? 'completed'
      : null;
  });
  protected readonly moving = signal(false);

  constructor() {
    this.facilityNames.ensure();
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        filter(Boolean),
        distinctUntilChanged(),
        switchMap((id) => this.store.load(id)),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (!this.store.loadError()) {
          this.step.set(
            initialStep({
              format: this.store.format(),
              type: this.store.type(),
              draw: this.store.draw(),
            }),
          );
        }
      });
  }

  protected select(step: StepKey): void {
    this.step.set(step);
  }

  protected reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.store
      .load(id)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  protected categoryChip(category: Tournament): string {
    return categoryLabel(category);
  }

  /** «გამოქვეყნება» / «ტურნირის დასრულება» — the same move the list offers. */
  protected moveOn(): void {
    const t = this.store.tournament();
    const next = this.lifecycle();
    if (!t || !next || this.moving()) return;
    const publish = next === 'published';
    const label = tr(publish ? 'ტურნირის გამოქვეყნება' : 'ტურნირის დასრულება');
    const content = publish
      ? `${tr('გამოვაქვეყნოთ')} „${this.store.name()}"? ${tr('ის ხილული გახდება მოთამაშეებისთვის და გაიხსნება რეგისტრაცია.')}`
      : `${tr('დავასრულოთ')} „${this.store.name()}"?`;
    // An event asks whether the move is for every category or this one only.
    const scope$: Observable<EventScope> =
      this.store.categories().length > 1
        ? this.dialogs.open<EventScope>(EventScopeDialogComponent, {
            label,
            size: 's',
            data: { content, category: categoryLabel(t) } as EventScopeDialogData,
          })
        : this.dialogs
            .open<boolean>(SsConfirmComponent, {
              label,
              size: 's',
              data: { content, yes: tr('დიახ'), no: tr('არა') } as SsConfirmData,
            })
            .pipe(
              filter(Boolean),
              map((): EventScope => 'one'),
            );
    scope$
      .pipe(
        take(1),
        switchMap((scope) => {
          this.moving.set(true);
          return this.tournaments.setStatus(t._id, next, scope === 'all');
        }),
        // The draw view depends on the status (podium, next round) — read again.
        switchMap(() => this.store.load(t._id)),
        finalize(() => this.moving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.alerts
          .open(tr(publish ? 'ტურნირი გამოქვეყნდა' : 'ტურნირი დასრულდა'), {
            appearance: 'success',
          })
          .pipe(take(1))
          .subscribe();
      });
  }

  /** «+ კატეგორია»: a new sibling, then its console. */
  protected addCategory(): void {
    const t = this.store.tournament();
    if (!t) return;
    const data: CategoryDialogData = {
      tournamentId: t._id,
      base: {
        type: t.type,
        format: t.format,
        level: t.level,
        category: t.category,
        entryFeeTetri: t.entryFeeTetri,
        maxParticipants: t.maxParticipants,
      },
    };
    this.dialogs
      .open<Tournament>(CategoryDialogComponent, {
        label: tr('კატეგორიის დამატება'),
        size: 'm',
        dismissible: true,
        closable: true,
        data,
      })
      .pipe(
        take(1),
        switchMap((created) => {
          this.alerts.open(tr('კატეგორია დაემატა'), { appearance: 'success' }).pipe(take(1)).subscribe();
          return this.router.navigate(['/tournaments', created._id]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected canAddCategory(): boolean {
    const t = this.store.tournament();
    return !!t && !t.external && (t.status === 'draft' || t.status === 'published');
  }
}
