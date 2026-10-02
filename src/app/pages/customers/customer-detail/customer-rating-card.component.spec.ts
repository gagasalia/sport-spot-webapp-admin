import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { RouterLink, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CustomerRatingCardComponent } from './customer-rating-card.component';
import { TPipe } from '../../../shared/i18n/t.pipe';
import {
  PaginatedScorecards,
  RankingService,
} from '../../../services/http-services/ranking.service';
import { AuthService } from '../../../shared/services/auth.service';
import { SsTierBadgeComponent } from '../../../shared/ui/tier-badge.component';
import { RatingCardView, ScorecardView } from '../../../shared/models/ranking.model';

const base: RatingCardView = {
  userId: 'u1',
  name: 'Nino',
  calibrating: true,
  calibration: { games: 3, of: 8 },
  rating: null,
  rd: 240,
  confidence: 35,
  tier: null,
  stars: null,
  games: 3,
  wins: 2,
  losses: 1,
  draws: 0,
  setsWon: 5,
  setsLost: 3,
  scorecards: 2,
  visible: false,
  established: false,
  trend: 1,
  history: [
    { scorecardId: 'h1', at: '2026-09-01T10:00:00.000Z', rating: 1520, rd: 300, delta: 20 },
    { scorecardId: 'h2', at: '2026-09-08T10:00:00.000Z', rating: 1510, rd: 280, delta: -10 },
  ],
};

/** 9 games in: tier 4 (კონკურენტი), four stars, not yet established. */
const visible: RatingCardView = {
  ...base,
  calibrating: false,
  calibration: { games: 8, of: 8 },
  rating: 1538,
  rd: 170,
  confidence: 58,
  tier: 4,
  stars: 4,
  games: 9,
  visible: true,
  history: Array.from({ length: 7 }, (_, i) => ({
    scorecardId: `h${i + 1}`,
    at: `2026-09-0${i + 1}T10:00:00.000Z`,
    rating: 1500 + i * 6,
    rd: 300 - i * 10,
    delta: i % 2 ? -5 : 11,
  })),
};

describe('CustomerRatingCardComponent', () => {
  let fixture: ComponentFixture<CustomerRatingCardComponent>;
  let rankingSpy: jasmine.SpyObj<RankingService>;

  async function setup(
    card: RatingCardView | 'error',
    superAdmin = false,
    pages: PaginatedScorecards[] = [{ data: [], page: { page: 1, size: 5, total: 0 } }],
  ) {
    rankingSpy = jasmine.createSpyObj<RankingService>('RankingService', [
      'customerCard',
      'customerScorecards',
    ]);
    rankingSpy.customerCard.and.returnValue(
      card === 'error' ? throwError(() => new Error('boom')) : of(card),
    );
    rankingSpy.customerScorecards.and.callFake((_id, query) =>
      of(pages[(query?.page ?? 1) - 1] ?? { data: [] }),
    );
    await TestBed.configureTestingModule({
      imports: [CustomerRatingCardComponent],
      providers: [
        provideRouter([]),
        { provide: RankingService, useValue: rankingSpy },
        { provide: AuthService, useValue: { isSuperAdmin: () => superAdmin } },
      ],
    })
      .overrideComponent(CustomerRatingCardComponent, {
        // set:{imports} REPLACES the array — TPipe must ride along (NG0302).
        set: { imports: [DatePipe, RouterLink, SsTierBadgeComponent, TPipe] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(CustomerRatingCardComponent);
    fixture.componentRef.setInput('userId', 'u1');
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (testId: string) =>
    el().querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();

  it('reads the card of the given customer', async () => {
    await setup(base);
    expect(rankingSpy.customerCard).toHaveBeenCalledOnceWith('u1');
  });

  it('calibrating: "3 / 8", a greyed badge, no rating number', async () => {
    await setup(base);
    expect(text('rating-calibration')).toBe('3 / 8');
    expect(text('tier-name')).toBe('კალიბრაცია');
    expect(el().querySelector('[data-testid="tier-stars"]')).toBeNull();
    expect(el().querySelector('[data-testid="rating-number"]')).toBeNull();
    expect(text('rating-confidence')).toBe('35%');
    expect(text('rating-wl')).toBe('2–1');
    expect(text('rating-sets')).toBe('5–3');
  });

  it('visible: the number ± RD, the tier name and its stars', async () => {
    await setup(visible);
    expect(text('rating-number')).toBe('1538 ±170');
    expect(text('tier-name')).toBe('კონკურენტი');
    const on = el().querySelectorAll('[data-testid="tier-stars"] .is-on');
    expect(on.length).toBe(4);
  });

  it('lists the last five results, newest first', async () => {
    await setup(visible);
    const rows = el().querySelectorAll('[data-testid="rating-history"] li');
    expect(rows.length).toBe(5);
    // h7 (newest) first: rating 1536, delta +11
    expect(rows[0].textContent?.replace(/\s+/g, ' ')).toContain('1536');
    expect(rows[0].textContent).toContain('+11');
    expect(rows[1].textContent).toContain('−5');
  });

  it('superadmins get the moderation deep link; operators do not', async () => {
    await setup(base, true);
    const link = el().querySelector('[data-testid="rating-card-results"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/super-admin/ranking-moderation?userId=u1');
  });

  it('a plain admin sees no moderation link', async () => {
    await setup(base, false);
    expect(el().querySelector('[data-testid="rating-card-results"]')).toBeNull();
  });

  it('a failed read offers a retry instead of a broken card', async () => {
    await setup('error');
    expect(el().textContent).toContain('რეიტინგი ვერ ჩაიტვირთა');
    rankingSpy.customerCard.and.returnValue(of(base));
    (el().querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text('rating-calibration')).toBe('3 / 8');
  });

  describe('scorecards in every status', () => {
    const page1: PaginatedScorecards = {
      data: [
        scorecard('s1', 'confirmed', 12.4),
        scorecard('s2', 'rejected'),
        scorecard('s3', 'expired'),
        scorecard('s4', 'void'),
        scorecard('s5', 'pending'),
      ],
      page: { page: 1, size: 5, total: 7 },
    };
    const page2: PaginatedScorecards = {
      data: [scorecard('s6', 'confirmed', -8), scorecard('s7', 'expired')],
      page: { page: 2, size: 5, total: 7 },
    };

    it('reads the first five for a plain admin too', async () => {
      await setup(base, false, [page1, page2]);
      expect(rankingSpy.customerScorecards).toHaveBeenCalledOnceWith('u1', { page: 1, limit: 5 });
      expect(el().querySelectorAll('[data-testid="scorecard-row"]').length).toBe(5);
    });

    it('confirmed rows show the player’s delta; the rest a status chip', async () => {
      await setup(base, false, [page1, page2]);
      const chips = Array.from(el().querySelectorAll('[data-testid="scorecard-status"]')).map((s) =>
        s.textContent?.trim(),
      );
      expect(chips).toEqual(['უარყოფილი', 'ვადაგასული', 'ანულირებული', 'დასადასტურებელი']);
      expect(text('scorecard-delta')).toBe('+12');
      expect(el().textContent).toContain('Nino + Luka');
      expect(el().textContent).toContain('6-3 6-4');
    });

    it('"მეტი" appends the next page and disappears at the end', async () => {
      await setup(base, false, [page1, page2]);
      const more = el().querySelector('[data-testid="scorecards-more"]') as HTMLButtonElement;
      expect(more.textContent?.trim()).toBe('მეტი');
      more.click();
      fixture.detectChanges();

      expect(rankingSpy.customerScorecards).toHaveBeenCalledWith('u1', { page: 2, limit: 5 });
      expect(el().querySelectorAll('[data-testid="scorecard-row"]').length).toBe(7);
      expect(el().querySelector('[data-testid="scorecards-more"]')).toBeNull();
    });

    it('no scorecards yet: an empty line, no pager', async () => {
      await setup(base);
      expect(el().querySelector('[data-testid="rating-scorecards"]')?.textContent).toContain(
        'შედეგები ჯერ არ არის',
      );
      expect(el().querySelector('[data-testid="scorecards-more"]')).toBeNull();
    });
  });
});

/** A doubles scorecard with the customer (u1) in slot a. */
function scorecard(id: string, status: ScorecardView['status'], myDelta?: number): ScorecardView {
  return {
    id,
    source: { type: 'friendly' },
    mode: 'doubles',
    playedAt: '2026-09-20T10:00:00.000Z',
    participants: [
      {
        key: 'a',
        name: 'Nino',
        isShadow: false,
        isMe: false,
        userId: 'u1',
        phone: '+995555000001',
      },
      { key: 'b', name: 'Luka', isShadow: true, isMe: false, phone: '+995555000002' },
      { key: 'c', name: 'Giorgi', isShadow: false, isMe: false, userId: 'u2' },
      { key: 'd', name: 'Dato', isShadow: true, isMe: false },
    ],
    games: [
      {
        n: 1,
        teams: [
          ['a', 'b'],
          ['c', 'd'],
        ],
        score: {
          type: 'sets',
          sets: [
            [6, 3],
            [6, 4],
          ],
        },
        winner: 0,
      },
    ],
    status,
    approvals: [],
    enteredBy: { userId: 'u1', key: 'a', name: 'Nino' },
    flags: {},
    deltas:
      myDelta === undefined
        ? undefined
        : [
            {
              key: 'a',
              ratingBefore: 1500,
              ratingAfter: 1500 + myDelta,
              rdBefore: 300,
              rdAfter: 280,
              delta: myDelta,
            },
          ],
    createdAt: '2026-09-20T12:00:00.000Z',
  };
}
