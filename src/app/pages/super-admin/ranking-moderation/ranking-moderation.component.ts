import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, debounceTime, filter, switchMap, take } from 'rxjs';
import { RankingService } from '../../../services/http-services/ranking.service';
import { tr } from '../../../shared/i18n/lang';
import { TPipe } from '../../../shared/i18n/t.pipe';
import {
  SCORECARD_STATUSES,
  ScorecardApprovalView,
  ScorecardGameView,
  ScorecardStatus,
  ScorecardView,
  VOID_REASON_MAX,
} from '../../../shared/models/ranking.model';
import { SsDialogService } from '../../../shared/ui/dialog.service';
import { SsToastService } from '../../../shared/ui/toast.service';
import {
  SCORECARD_SOURCE_LABELS,
  SCORECARD_STATUS_CLASSES,
  SCORECARD_STATUS_LABELS,
  scoreLabel,
  teamNames,
} from '../../../shared/utils/ranking-display.util';
import { isAcceptablePhone } from '../../../shared/validators/phone-format.validator';
import { ReasonDialogComponent, ReasonDialogData } from '../../customers/reason-dialog.component';

const PAGE_SIZE = 20;
/** A Mongo ObjectId — the only user key the moderation list filters by. */
const OBJECT_ID_RX = /^[a-f0-9]{24}$/i;

/** The replay command named by the page note (rendered as code). */
export const REPLAY_COMMAND = 'npm run ranking:replay';

/**
 * Super-admin → შედეგების მოდერაცია (docs/25 §5 "Superadmin", §6.5 v2): every
 * scorecard (friendly, open match, tournament) newest first, filtered by
 * status, by `shadowOnly` (everyone but the reporter has no account — the
 * abuse-prone shape) and optionally by a user id or a PHONE (the only key a
 * player without an account has), with VOID (reason) on
 * confirmed rows. Rejects and expiries are final — there is no resolve
 * action. A void never edits ratings in place: `npm run ranking:replay`
 * rebuilds them (the page says so).
 */
@Component({
  selector: 'app-ranking-moderation',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, TPipe],
  templateUrl: './ranking-moderation.component.html',
  styleUrl: './ranking-moderation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingModerationComponent implements OnInit {
  private readonly ranking = inject(RankingService);
  private readonly dialogs = inject(SsDialogService);
  private readonly alerts = inject(SsToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = signal<ScorecardView[]>([]);
  protected readonly total = signal(0);
  /** One-based, like the API's `result.page`. */
  protected readonly page = signal(1);
  protected readonly limit = PAGE_SIZE;
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  // ── filters ────────────────────────────────────────────────────────────────
  protected readonly status = signal<ScorecardStatus | null>(null);
  protected readonly shadowOnly = signal(false);
  /** A user's Mongo id ('' = everyone). */
  protected readonly userId = signal('');
  protected readonly userIdInvalid = computed(() => {
    const value = this.userId().trim();
    return value.length > 0 && !OBJECT_ID_RX.test(value);
  });
  /** A participant phone as typed (+995…, 995… or 9 digits; '' = anyone). */
  protected readonly phone = signal('');
  protected readonly phoneInvalid = computed(() => {
    const value = this.phone().trim();
    return value.length > 0 && !isAcceptablePhone(value);
  });

  protected readonly statusOptions = SCORECARD_STATUSES;
  protected readonly statusLabels = SCORECARD_STATUS_LABELS;
  protected readonly statusClasses = SCORECARD_STATUS_CLASSES;
  protected readonly sourceLabels = SCORECARD_SOURCE_LABELS;
  protected readonly scoreLabel = scoreLabel;
  protected readonly replayCommand = REPLAY_COMMAND;

  /** The note around the command: one translatable sentence with a %s slot. */
  protected readonly replayNote = computed(() =>
    tr('გაუქმებული შედეგის რეიტინგები სწორდება %s-ით').split('%s'),
  );

  private readonly userIdTyped$ = new Subject<void>();

  constructor() {
    this.userIdTyped$.pipe(debounceTime(400), takeUntilDestroyed()).subscribe(() => this.load(1));
  }

  ngOnInit(): void {
    // Deep links (customer detail → "ყველა შედეგი"): ?userId=&phone=&status=&shadowOnly=true
    this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const userId = params.get('userId');
      const status = params.get('status') as ScorecardStatus | null;
      const phone = params.get('phone');
      if (userId) this.userId.set(userId);
      if (phone) this.phone.set(phone);
      if (status && SCORECARD_STATUSES.includes(status)) this.status.set(status);
      if (params.get('shadowOnly') === 'true') this.shadowOnly.set(true);
      this.load(1);
    });
  }

  load(page = 1): void {
    // Wait for a whole id instead of a request the API would 400.
    if (this.userIdInvalid() || this.phoneInvalid()) return;
    this.page.set(page);
    this.isLoading.set(true);
    this.hasError.set(false);
    this.ranking
      .scorecards({
        status: this.status() ?? undefined,
        shadowOnly: this.shadowOnly() || undefined,
        userId: this.userId().trim() || undefined,
        phone: this.phone().trim() || undefined,
        page,
        limit: this.limit,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data, page: p }) => {
          this.rows.set(data);
          this.total.set(p?.total ?? data.length);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  // ── filter handlers ────────────────────────────────────────────────────────

  protected setStatus(status: ScorecardStatus | null): void {
    this.status.set(status);
    this.load(1);
  }

  protected setShadowOnly(value: boolean): void {
    this.shadowOnly.set(value);
    this.load(1);
  }

  protected setUserId(value: string): void {
    this.userId.set(value ?? '');
    this.userIdTyped$.next();
  }

  /** Shares the user-id debounce: both are typed keys. */
  protected setPhone(value: string): void {
    this.phone.set(value ?? '');
    this.userIdTyped$.next();
  }

  protected hasActiveFilters(): boolean {
    return (
      this.status() !== null ||
      this.shadowOnly() ||
      this.userId().trim().length > 0 ||
      this.phone().trim().length > 0
    );
  }

  protected clearFilters(): void {
    this.status.set(null);
    this.shadowOnly.set(false);
    this.userId.set('');
    this.phone.set('');
    this.load(1);
  }

  protected nextPage(): void {
    if (this.page() < this.totalPages()) this.load(this.page() + 1);
  }

  protected prevPage(): void {
    if (this.page() > 1) this.load(this.page() - 1);
  }

  // ── void ───────────────────────────────────────────────────────────────────

  protected voidScorecard(card: ScorecardView): void {
    this.dialogs
      .open<string | null>(ReasonDialogComponent, {
        // The outlet renders the header raw → translate here; the payload
        // stays RAW (ReasonDialogComponent applies `| t`).
        label: tr('შედეგის ანულირება'),
        size: 'm',
        dismissible: true,
        closable: true,
        data: {
          content:
            'შედეგი ანულირდება და რეიტინგში აღარ ჩაითვლება. მოთამაშეების რეიტინგები გასწორდება ranking:replay-ის გაშვების შემდეგ.',
          placeholder: 'მაგ: ერთი და იგივე თამაში ორჯერ შეიყვანეს',
          yes: 'ანულირება',
          destructive: true,
        } as ReasonDialogData,
      })
      .pipe(
        take(1),
        filter((reason): reason is string => !!reason),
        switchMap((reason) =>
          this.ranking.voidScorecard(card.id, reason.slice(0, VOID_REASON_MAX)),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (voided) => {
          this.rows.update((list) => list.map((c) => (c.id === voided.id ? voided : c)));
          this.toast(tr('შედეგი ანულირდა'), 'success');
        },
        error: (err: unknown) => {
          const conflict = err instanceof HttpErrorResponse && err.status === 409;
          this.toast(
            tr(conflict ? 'მხოლოდ დადასტურებული შედეგი ანულირდება' : 'ანულირება ვერ მოხერხდა'),
            'error',
          );
          if (conflict) this.load(this.page());
        },
      });
  }

  // ── display helpers ────────────────────────────────────────────────────────

  protected teamNames(card: ScorecardView, game: ScorecardGameView, side: 0 | 1): string {
    return teamNames(card, game, side);
  }

  /** Who entered it: a participant's name, or the operator for tournaments. */
  protected reporterLabel(card: ScorecardView): string {
    if (card.enteredBy.adminId && !card.enteredBy.userId) return tr('ოპერატორი');
    return card.enteredBy.name || '—';
  }

  /** An approval's participant name (approvals carry user ids only). */
  protected approverName(card: ScorecardView, approval: ScorecardApprovalView): string {
    return card.participants.find((p) => p.userId === approval.userId)?.name || '—';
  }

  /** Shortened id for the row's reference column ("…a1b2c3"). */
  protected shortId(id: string): string {
    return id.length > 6 ? `…${id.slice(-6)}` : id;
  }

  private toast(message: string, appearance: 'success' | 'error'): void {
    this.alerts.open(message, { appearance }).pipe(take(1)).subscribe();
  }
}
