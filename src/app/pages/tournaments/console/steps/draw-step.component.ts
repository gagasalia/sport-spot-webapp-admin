import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, filter, switchMap, take } from 'rxjs';
import { TournamentEngineService } from '../../../../services/http-services/tournament-engine.service';
import { tr } from '../../../../shared/i18n/lang';
import { TPipe } from '../../../../shared/i18n/t.pipe';
import {
  CloseGroupsDto,
  DrawView,
  MatchView,
} from '../../../../shared/models/tournament-engine.model';
import { SsConfirmComponent, SsConfirmData } from '../../../../shared/ui/confirm.component';
import { SsDialogService } from '../../../../shared/ui/dialog.service';
import { SsToastService } from '../../../../shared/ui/toast.service';
import { TournamentConsoleStore } from '../console.store';
import { StepKey } from '../console-steps.util';
import {
  CloseGroupsDialogComponent,
  CloseGroupsDialogData,
} from '../close-groups-dialog.component';
import { BracketComponent } from '../draw/bracket.component';
import { GroupCardComponent } from '../draw/group-card.component';
import { SocialBoardComponent } from '../draw/social-board.component';
import { EngineError, describeEngineError } from '../engine-errors.util';
import { entrantShortfall } from '../engine-structure.util';
import { renderMsg } from '../msg.util';

/**
 * Step 3 «კენჭისყრა» (docs/33 §4): generate the draw (a DRAFT only the
 * organizer sees), publish or reset it, and everything the draw shows —
 * group tables with their matches, the bracket, or the americano / mexicano
 * leaderboard and rounds — plus swapping entrants before play, closing /
 * reopening the group stage and the next social round.
 */
@Component({
  selector: 'app-draw-step',
  standalone: true,
  imports: [TPipe, GroupCardComponent, BracketComponent, SocialBoardComponent],
  templateUrl: './draw-step.component.html',
  styleUrl: './draw-step.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawStepComponent {
  protected readonly store = inject(TournamentConsoleStore);
  private readonly engine = inject(TournamentEngineService);
  private readonly dialogs = inject(SsDialogService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Jump to another step (e.g. «ფორმატი» when no structure is saved). */
  readonly goto = output<StepKey>();

  protected readonly shuffle = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<EngineError | null>(null);
  protected readonly swapMode = signal(false);
  protected readonly swapFirst = signal<string | null>(null);

  protected readonly draw = this.store.draw;
  protected readonly groups = computed(() => this.draw()?.groups ?? []);
  protected readonly groupsClosed = computed(() => this.groups().some((g) => g.closed));
  protected readonly scoringType = computed(() => this.store.structure()?.scoring.type ?? 'sets');

  protected readonly shortfall = computed(() => {
    const structure = this.store.structure();
    if (!structure) return '';
    return renderMsg(
      entrantShortfall(
        this.store.format(),
        this.store.type(),
        structure,
        this.store.entrants().length,
      ),
    );
  });

  /** Swapping is allowed while no result exists (API swap_not_allowed). */
  protected readonly canSwap = computed(
    () =>
      this.store.editable() &&
      this.store.hasDraw() &&
      !this.store.hasResults() &&
      !this.draw()?.social &&
      (this.groups().length > 0 || !!this.draw()?.knockout),
  );

  protected readonly pendingGroupMatches = computed(
    () => this.store.matches().filter((m) => m.stage === 'group' && m.status !== 'done').length,
  );
  protected readonly knockoutHasResult = computed(() =>
    this.store.matches().some((m) => m.stage === 'knockout' && m.status === 'done'),
  );
  protected readonly canCloseGroups = computed(
    () =>
      this.store.editable() && this.groups().length > 0 && !this.draw()?.social && !this.groupsClosed(),
  );
  protected readonly canReopenGroups = computed(
    () => this.store.editable() && this.groupsClosed() && !this.knockoutHasResult(),
  );

  /** Matches of each group, for the group cards. */
  protected readonly matchesByGroup = computed(() => {
    const out = new Map<string, MatchView[]>();
    for (const match of this.store.matches()) {
      if (match.stage !== 'group' || !match.group) continue;
      out.set(match.group, [...(out.get(match.group) ?? []), match]);
    }
    return out;
  });

  protected readonly podium = computed(() =>
    (this.draw()?.podium ?? []).map((place) => ({
      place: place.place,
      names: place.entrants.map((id) => this.store.entrantById().get(id)?.name ?? '—').join(' / '),
    })),
  );

  protected generate(): void {
    this.run(this.engine.generateDraw(this.store.id(), this.shuffle()), 'კენჭისყრა ჩატარდა — ეს დრაფტია');
  }

  protected publish(): void {
    this.run(this.engine.publishDraw(this.store.id()), 'კენჭისყრა გამოქვეყნდა');
  }

  protected reset(): void {
    const results = this.store.hasResults();
    const data: SsConfirmData = {
      content: results
        ? tr('შეყვანილი შედეგები გაუქმდება და რეიტინგიდან ამოიშლება. კენჭისყრა წაიშლება და რეგისტრაცია ისევ გაიხსნება.')
        : tr('კენჭისყრა წაიშლება და რეგისტრაცია ისევ გაიხსნება.'),
      yes: tr('გაუქმება'),
      no: tr('არა'),
      appearance: 'destructive',
    };
    this.confirmThen(tr('კენჭისყრის გაუქმება'), data, () =>
      this.run(this.engine.resetDraw(this.store.id(), results), 'კენჭისყრა გაუქმდა'),
    );
  }

  protected toggleSwap(): void {
    this.swapMode.update((on) => !on);
    this.swapFirst.set(null);
  }

  /** Swap mode: the first pick is held, the second one swaps the two. */
  protected pick(entrant: string): void {
    const first = this.swapFirst();
    if (!first) {
      this.swapFirst.set(entrant);
      return;
    }
    if (first === entrant) {
      this.swapFirst.set(null);
      return;
    }
    this.swapFirst.set(null);
    this.run(this.engine.swapEntrants(this.store.id(), first, entrant), 'მონაწილეებმა ადგილები გაცვალეს');
  }

  protected closeGroups(): void {
    const entrants = this.store.entrantById();
    const data: CloseGroupsDialogData = {
      groups: this.groups(),
      names: Object.fromEntries([...entrants].map(([id, e]) => [id, e.name])),
      pending: this.pendingGroupMatches(),
      scoring: this.scoringType(),
    };
    this.dialogs
      .open<CloseGroupsDto>(CloseGroupsDialogComponent, {
        label: tr('ჯგუფური ეტაპის დახურვა'),
        size: 'm',
        dismissible: true,
        closable: true,
        data,
      })
      .pipe(take(1))
      .subscribe((body) => {
        if (body) this.run(this.engine.closeGroups(this.store.id(), body), 'ჯგუფური ეტაპი დაიხურა');
      });
  }

  protected reopenGroups(): void {
    const data: SsConfirmData = {
      content: tr('ბადეში ჯგუფებიდან გასულები ისევ მოიხსნება, ჯგუფური შედეგები კი ისევ შეიცვლება.'),
      yes: tr('გახსნა'),
      no: tr('არა'),
    };
    this.confirmThen(tr('ჯგუფური ეტაპის ხელახლა გახსნა'), data, () =>
      this.run(this.engine.reopenGroups(this.store.id()), 'ჯგუფური ეტაპი ხელახლა გაიხსნა'),
    );
  }

  protected nextRound(): void {
    this.run(this.engine.nextRound(this.store.id()), 'ახალი რაუნდი შეიქმნა');
  }

  protected openMatch(match: MatchView): void {
    this.store.openScore(match);
  }

  private confirmThen(label: string, data: SsConfirmData, then: () => void): void {
    this.dialogs
      .open<boolean>(SsConfirmComponent, { label, size: 's', data })
      .pipe(take(1), filter(Boolean))
      .subscribe(() => then());
  }

  /** One engine write: busy, inline error, fresh view, a success toast. */
  private run(request: Observable<DrawView>, success: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    request
      .pipe(
        catchError((err: unknown) => {
          this.busy.set(false);
          this.error.set(describeEngineError(err));
          return EMPTY;
        }),
        switchMap((view) => {
          this.busy.set(false);
          this.store.applyDraw(view);
          if (view.status === 'none') this.swapMode.set(false);
          return this.alerts.open(tr(success), { appearance: 'success' }).pipe(take(1));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
