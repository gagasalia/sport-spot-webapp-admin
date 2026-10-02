import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { RankingService } from '../../../services/http-services/ranking.service';
import { TPipe } from '../../../shared/i18n/t.pipe';
import {
  CALIBRATION_GAMES,
  RatingCardView,
  ScorecardDeltaView,
  ScorecardGameView,
  ScorecardView,
} from '../../../shared/models/ranking.model';
import { AuthService } from '../../../shared/services/auth.service';
import { SsTierBadgeComponent } from '../../../shared/ui/tier-badge.component';
import {
  SCORECARD_SOURCE_LABELS,
  SCORECARD_STATUS_CLASSES,
  SCORECARD_STATUS_LABELS,
  deltaClass,
  deltaOf,
  formatDelta,
  scoreLabel,
  teamNames,
} from '../../../shared/utils/ranking-display.util';

/** How many rating-history rows the card lists (newest first). */
const HISTORY_ROWS = 5;
/** Scorecards per "მეტი" page (newest first, every status). */
export const SCORECARDS_PAGE = 5;

/**
 * A customer's rating card on the customer detail (docs/25 §6.5): the rank
 * badge (tier + stars, or "კალიბრაცია 3 / 8" while calibrating), the rating
 * number once visible, confidence, games, W–L, sets and the last rating
 * changes — plus the player's scorecards in EVERY status (pending, rejected,
 * expired and void included), five at a time with a "მეტი" pager. Any
 * operator may read both — a rating is not a tenant secret. Superadmins also
 * get a deep link into the moderation list filtered by this player.
 */
@Component({
  selector: 'app-customer-rating-card',
  standalone: true,
  imports: [DatePipe, RouterLink, SsTierBadgeComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ss-card p-4" data-testid="rating-card">
      <div class="flex items-center justify-between gap-2 mb-3">
        <h2 class="text-lg font-semibold georgian-text" lang="ka">{{ 'რეიტინგი' | t }}</h2>
        @if (isSuperAdmin()) {
          <a
            class="ss-btn ss-btn--flat ss-btn--s"
            routerLink="/super-admin/ranking-moderation"
            [queryParams]="{ userId: userId() }"
            data-testid="rating-card-results"
          >
            <span class="georgian-text" lang="ka">{{ 'ყველა შედეგი' | t }}</span>
          </a>
        }
      </div>

      @if (isLoading()) {
        <div
          class="h-24 rounded-xl animate-pulse"
          style="background: var(--tui-background-neutral-1)"
        ></div>
      } @else if (hasError() || !card()) {
        <div class="flex items-center gap-3">
          <p class="text-sm georgian-text m-0" lang="ka" style="color: var(--tui-text-secondary)">
            {{ 'რეიტინგი ვერ ჩაიტვირთა' | t }}
          </p>
          <button class="ss-btn ss-btn--outline ss-btn--s" type="button" (click)="load()">
            <span class="georgian-text" lang="ka">{{ 'თავიდან ცდა' | t }}</span>
          </button>
        </div>
      } @else {
        @let c = card()!;
        <div class="rc-grid">
          <!-- rank -->
          <div class="rc-rank">
            <ss-tier-badge [tier]="c.tier" [stars]="c.stars" [calibrating]="c.calibrating" />
            @if (c.calibrating) {
              <div class="rc-big ss-num" data-testid="rating-calibration">
                {{ c.calibration.games }} / {{ c.calibration.of || calibrationOf }}
              </div>
              <div class="rc-bar" aria-hidden="true">
                <span [style.width.%]="calibrationPct()"></span>
              </div>
              <p class="rc-hint georgian-text" lang="ka">
                {{ 'რეიტინგი გამოჩნდება კალიბრაციის შემდეგ' | t }}
              </p>
            } @else {
              <div class="rc-big ss-num" data-testid="rating-number">
                {{ c.rating }}
                <span class="rc-rd">±{{ c.rd }}</span>
              </div>
              @if (c.established) {
                <span class="ss-badge ss-badge--accent georgian-text" lang="ka">
                  {{ 'ლიდერბორდზე' | t }}
                  @if (c.rank) {
                    · #{{ c.rank }} / {{ c.of }}
                  }
                </span>
              } @else {
                <span class="ss-badge ss-badge--muted georgian-text" lang="ka">
                  {{ 'ლიდერბორდისთვის სიზუსტე არ კმარა' | t }}
                </span>
              }
            }
          </div>

          <!-- numbers -->
          <dl class="rc-stats">
            <div>
              <dt class="georgian-text" lang="ka">{{ 'სიზუსტე' | t }}</dt>
              <dd class="ss-num" data-testid="rating-confidence">{{ c.confidence }}%</dd>
            </div>
            <div>
              <dt class="georgian-text" lang="ka">{{ 'თამაშები' | t }}</dt>
              <dd class="ss-num" data-testid="rating-games">{{ c.games }}</dd>
            </div>
            <div>
              <dt class="georgian-text" lang="ka">{{ 'მოგება–წაგება' | t }}</dt>
              <dd class="ss-num" data-testid="rating-wl">
                {{ c.wins }}–{{ c.losses }}
                @if (c.draws) {
                  <span class="rc-sub">({{ c.draws }} {{ 'ფრე' | t }})</span>
                }
              </dd>
            </div>
            <div>
              <dt class="georgian-text" lang="ka">{{ 'სეტები' | t }}</dt>
              <dd class="ss-num" data-testid="rating-sets">{{ c.setsWon }}–{{ c.setsLost }}</dd>
            </div>
          </dl>

          <!-- last results -->
          <div class="rc-history">
            <div class="ss-eyebrow georgian-text mb-2" lang="ka">
              {{ 'რეიტინგის ცვლილებები' | t }}
            </div>
            @if (recent().length === 0) {
              <p
                class="text-sm georgian-text m-0"
                lang="ka"
                style="color: var(--tui-text-secondary)"
              >
                {{ 'რეიტინგული თამაში ჯერ არ აქვს' | t }}
              </p>
            } @else {
              <ul class="rc-list" data-testid="rating-history">
                @for (h of recent(); track h.scorecardId) {
                  <li>
                    <span class="rc-date">{{ h.at | date: 'dd/MM/yyyy' }}</span>
                    @if (!c.calibrating) {
                      <span class="ss-num rc-after">{{ round(h.rating) }}</span>
                    }
                    <span [class]="deltaClass(h.delta)">{{ formatDelta(h.delta) }}</span>
                  </li>
                }
              </ul>
            }
          </div>
        </div>
      }

      <!-- the player's scorecards, every status (rejected / expired / void included) -->
      <div class="rc-cards" data-testid="rating-scorecards">
        <div class="ss-eyebrow georgian-text mb-2" lang="ka">{{ 'შედეგების ისტორია' | t }}</div>
        @if (scorecardsError()) {
          <div class="flex items-center gap-3">
            <p class="text-sm georgian-text m-0" lang="ka" style="color: var(--tui-text-secondary)">
              {{ 'შედეგები ვერ ჩაიტვირთა' | t }}
            </p>
            <button
              class="ss-btn ss-btn--outline ss-btn--s"
              type="button"
              (click)="loadScorecards(1)"
            >
              <span class="georgian-text" lang="ka">{{ 'თავიდან ცდა' | t }}</span>
            </button>
          </div>
        } @else if (scorecards().length === 0) {
          @if (scorecardsLoading()) {
            <div
              class="h-8 rounded animate-pulse"
              style="background: var(--tui-background-neutral-1)"
            ></div>
          } @else {
            <p class="text-sm georgian-text m-0" lang="ka" style="color: var(--tui-text-secondary)">
              {{ 'შედეგები ჯერ არ არის' | t }}
            </p>
          }
        } @else {
          <ul class="rc-list" data-testid="scorecards-list">
            @for (sc of scorecards(); track sc.id) {
              <li class="rc-card" data-testid="scorecard-row">
                <span class="rc-date">{{ sc.playedAt | date: 'dd/MM/yyyy' }}</span>
                <span class="rc-source georgian-text" lang="ka">{{
                  sourceLabels[sc.source.type]
                }}</span>
                <span class="rc-games">
                  @for (game of sc.games; track game.n) {
                    <span class="rc-game">
                      {{ teamNames(sc, game, 0) }}
                      <span class="rc-vs">vs</span>
                      {{ teamNames(sc, game, 1) }}
                      <b class="ss-num">{{ scoreLabel(game.score) }}</b>
                    </span>
                  }
                </span>
                @if (sc.status === 'confirmed') {
                  @if (myDelta(sc); as d) {
                    <span [class]="deltaClass(d.delta)" data-testid="scorecard-delta">{{
                      formatDelta(d.delta)
                    }}</span>
                  } @else {
                    <span class="georgian-text" lang="ka" [class]="statusClasses[sc.status]">{{
                      statusLabels[sc.status]
                    }}</span>
                  }
                } @else {
                  <span
                    class="georgian-text"
                    lang="ka"
                    data-testid="scorecard-status"
                    [class]="statusClasses[sc.status]"
                    [attr.title]="sc.voidReason || null"
                    >{{ statusLabels[sc.status] }}</span
                  >
                }
              </li>
            }
          </ul>
          @if (hasMoreScorecards()) {
            <button
              class="ss-btn ss-btn--flat ss-btn--s mt-2"
              type="button"
              data-testid="scorecards-more"
              [disabled]="scorecardsLoading()"
              (click)="loadScorecards(scorecardsPage() + 1)"
            >
              <span class="georgian-text" lang="ka">{{ 'მეტი' | t }}</span>
            </button>
          }
        }
      </div>
    </section>
  `,
  styles: `
    .rc-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.2fr);
      gap: 20px;
      align-items: start;
    }
    @media (max-width: 900px) {
      .rc-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .rc-rank {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .rc-big {
      font-size: 26px;
      font-weight: 700;
      line-height: 1.1;
    }
    .rc-rd,
    .rc-sub {
      font-size: 13px;
      font-weight: 500;
      color: var(--tui-text-secondary);
    }
    .rc-bar {
      width: 100%;
      max-width: 220px;
      height: 6px;
      border-radius: var(--r-pill);
      background: var(--tui-background-neutral-1);
      overflow: hidden;
    }
    .rc-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
    }
    .rc-hint {
      margin: 0;
      font-size: 12px;
      color: var(--tui-text-secondary);
    }
    .rc-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin: 0;
    }
    .rc-stats dt {
      font-size: 12px;
      color: var(--tui-text-secondary);
    }
    .rc-stats dd {
      margin: 2px 0 0;
      font-size: 18px;
      font-weight: 600;
    }
    .rc-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .rc-list li {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
    }
    .rc-date {
      color: var(--tui-text-secondary);
      min-width: 82px;
    }
    .rc-after {
      flex: 1;
    }
    .rc-cards {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid var(--hairline);
    }
    .rc-card {
      flex-wrap: wrap;
    }
    .rc-source {
      color: var(--tui-text-secondary);
      min-width: 92px;
    }
    .rc-games {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .rc-vs {
      font-size: 11px;
      color: var(--text-faint);
    }
  `,
})
export class CustomerRatingCardComponent {
  readonly userId = input.required<string>();

  private readonly ranking = inject(RankingService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly isSuperAdmin = inject(AuthService).isSuperAdmin;

  protected readonly card = signal<RatingCardView | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);

  // ── the player's scorecards (GET /ranking/customers/:userId/scorecards) ───
  protected readonly scorecards = signal<ScorecardView[]>([]);
  protected readonly scorecardsPage = signal(1);
  protected readonly scorecardsTotal = signal(0);
  protected readonly scorecardsLoading = signal(false);
  protected readonly scorecardsError = signal(false);
  protected readonly hasMoreScorecards = computed(
    () => this.scorecards().length < this.scorecardsTotal(),
  );

  protected readonly calibrationOf = CALIBRATION_GAMES;
  protected readonly formatDelta = formatDelta;
  protected readonly deltaClass = deltaClass;
  protected readonly scoreLabel = scoreLabel;
  protected readonly sourceLabels = SCORECARD_SOURCE_LABELS;
  protected readonly statusLabels = SCORECARD_STATUS_LABELS;
  protected readonly statusClasses = SCORECARD_STATUS_CLASSES;

  /** The newest HISTORY_ROWS entries, newest first (the API stores oldest first). */
  protected readonly recent = computed(() =>
    (this.card()?.history ?? []).slice(-HISTORY_ROWS).reverse(),
  );

  protected readonly calibrationPct = computed(() => {
    const c = this.card()?.calibration;
    const of = c?.of || CALIBRATION_GAMES;
    return Math.min(100, Math.round(((c?.games ?? 0) / of) * 100));
  });

  constructor() {
    effect(() => {
      this.userId();
      untracked(() => this.load());
    });
  }

  load(): void {
    const id = this.userId();
    if (!id) return;
    this.isLoading.set(true);
    this.hasError.set(false);
    this.ranking
      .customerCard(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (card) => {
          this.card.set(card);
          this.isLoading.set(false);
        },
        error: () => {
          this.card.set(null);
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
    this.loadScorecards(1);
  }

  /** Page 1 replaces the list; later pages ("მეტი") append. */
  loadScorecards(page: number): void {
    const id = this.userId();
    if (!id) return;
    this.scorecardsLoading.set(true);
    this.scorecardsError.set(false);
    this.ranking
      .customerScorecards(id, { page, limit: SCORECARDS_PAGE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data, page: p }) => {
          this.scorecards.update((list) => (page === 1 ? data : [...list, ...data]));
          this.scorecardsPage.set(page);
          this.scorecardsTotal.set(p?.total ?? this.scorecards().length);
          this.scorecardsLoading.set(false);
        },
        error: () => {
          this.scorecardsLoading.set(false);
          this.scorecardsError.set(true);
        },
      });
  }

  protected teamNames(card: ScorecardView, game: ScorecardGameView, side: 0 | 1): string {
    return teamNames(card, game, side);
  }

  /** This customer's own rating change on a rated scorecard. */
  protected myDelta(card: ScorecardView): ScorecardDeltaView | undefined {
    const me = card.participants.find((p) => p.userId === this.userId());
    return me ? deltaOf(card, me.key) : undefined;
  }

  protected round(n: number): number {
    return Math.round(n);
  }
}
