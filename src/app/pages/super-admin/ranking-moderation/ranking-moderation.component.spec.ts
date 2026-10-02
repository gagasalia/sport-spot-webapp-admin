import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { RankingModerationComponent } from './ranking-moderation.component';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { RankingService } from '../../../services/http-services/ranking.service';
import { SsDialogService } from '../../../shared/ui/dialog.service';
import { SsToastService } from '../../../shared/ui/toast.service';
import { ScorecardView } from '../../../shared/models/ranking.model';

function card(id: string, patch: Partial<ScorecardView> = {}): ScorecardView {
  return {
    id,
    source: { type: 'friendly' },
    mode: 'singles',
    playedAt: '2026-10-01T10:00:00.000Z',
    facility: { name: 'Arena', city: 'თბილისი' },
    participants: [
      {
        key: 'a',
        name: 'Nino',
        isShadow: false,
        isMe: false,
        phone: '+995555000001',
        userId: 'u1',
      },
      { key: 'b', name: 'Luka', isShadow: true, isMe: false, phone: '+995555000002' },
    ],
    games: [{ n: 1, teams: [['a'], ['b']], score: { type: 'sets', sets: [[6, 3]] }, winner: 0 }],
    status: 'confirmed',
    approvals: [],
    enteredBy: { userId: 'u1', key: 'a', name: 'Nino' },
    flags: { shadowOnly: true },
    createdAt: '2026-10-01T12:00:00.000Z',
    ...patch,
  };
}

const USER_ID = '64b8f0c2e1d3c2a5f0e4b9a1';

describe('RankingModerationComponent', () => {
  let fixture: ComponentFixture<RankingModerationComponent>;
  let component: RankingModerationComponent;
  let rankingSpy: jasmine.SpyObj<RankingService>;
  let dialogsSpy: jasmine.SpyObj<SsDialogService>;
  let toastSpy: jasmine.SpyObj<SsToastService>;

  const rows = [
    card('s1'),
    card('s2', { status: 'pending', approvalDeadline: '2026-10-03T12:00:00.000Z' }),
    card('s3', { status: 'rejected', flags: {} }),
  ];

  async function setup(queryParams: Record<string, string> = {}) {
    rankingSpy = jasmine.createSpyObj<RankingService>('RankingService', [
      'scorecards',
      'voidScorecard',
    ]);
    rankingSpy.scorecards.and.returnValue(
      of({ data: rows, page: { page: 1, size: 20, total: 45 } }),
    );
    dialogsSpy = jasmine.createSpyObj<SsDialogService>('SsDialogService', ['open']);
    toastSpy = jasmine.createSpyObj<SsToastService>('SsToastService', ['open']);
    toastSpy.open.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [RankingModerationComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap(queryParams)) },
        },
        { provide: RankingService, useValue: rankingSpy },
        { provide: SsDialogService, useValue: dialogsSpy },
        { provide: SsToastService, useValue: toastSpy },
      ],
    })
      .overrideComponent(RankingModerationComponent, {
        // set:{imports} REPLACES the array — TPipe must ride along (NG0302).
        set: { imports: [DatePipe, FormsModule, RouterLink, TPipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RankingModerationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const all = (testId: string) => Array.from(el().querySelectorAll(`[data-testid="${testId}"]`));
  const c = () => component as unknown as Record<string, any>;
  const lastQuery = () => rankingSpy.scorecards.calls.mostRecent().args[0] ?? {};

  describe('list', () => {
    beforeEach(async () => setup());

    it('loads page 1 with no filters and renders every row', () => {
      expect(rankingSpy.scorecards).toHaveBeenCalledOnceWith({
        status: undefined,
        shadowOnly: undefined,
        userId: undefined,
        phone: undefined,
        page: 1,
        limit: 20,
      });
      expect(all('scorecard-row').length).toBe(3);
      expect(all('scorecard-status').map((s) => s.textContent?.trim())).toEqual([
        'დადასტურებული',
        'დასადასტურებელი',
        'უარყოფილი',
      ]);
      expect(all('scorecard-score')[0].textContent?.trim()).toBe('6-3');
      expect(all('flag-shadow').length).toBe(2);
    });

    it('shows participants with phones and the replay note', () => {
      expect(el().textContent).toContain('+995555000002');
      expect(el().querySelector('[data-testid="replay-note"] code')?.textContent).toBe(
        'npm run ranking:replay',
      );
    });

    it('offers void on confirmed rows only', () => {
      expect(all('scorecard-void').length).toBe(1);
    });

    it('paginates', () => {
      c()['nextPage']();
      expect(lastQuery().page).toBe(2);
      c()['prevPage']();
      expect(lastQuery().page).toBe(1);
    });
  });

  describe('filters', () => {
    beforeEach(async () => setup());

    it('status → reload from page 1 with that status', () => {
      c()['nextPage']();
      c()['setStatus']('expired');
      expect(lastQuery()).toEqual(jasmine.objectContaining({ status: 'expired', page: 1 }));
    });

    it('shadowOnly → reload with shadowOnly', () => {
      c()['setShadowOnly'](true);
      expect(lastQuery()).toEqual(jasmine.objectContaining({ shadowOnly: true, page: 1 }));
    });

    it('a user id is debounced; a partial id never reaches the API', fakeAsync(() => {
      const before = rankingSpy.scorecards.calls.count();
      c()['setUserId']('64b8f0');
      tick(400);
      expect(c()['userIdInvalid']()).toBeTrue();
      expect(rankingSpy.scorecards.calls.count()).toBe(before);

      c()['setUserId'](USER_ID);
      tick(399);
      expect(rankingSpy.scorecards.calls.count()).toBe(before);
      tick(1);
      expect(lastQuery()).toEqual(jasmine.objectContaining({ userId: USER_ID, page: 1 }));
    }));

    it('a phone finds shadows too: debounced, and a bad number never reaches the API', fakeAsync(() => {
      const before = rankingSpy.scorecards.calls.count();
      c()['setPhone']('12');
      tick(400);
      expect(c()['phoneInvalid']()).toBeTrue();
      expect(rankingSpy.scorecards.calls.count()).toBe(before);

      c()['setPhone']('555 123 456');
      tick(400);
      expect(lastQuery()).toEqual(jasmine.objectContaining({ phone: '555 123 456', page: 1 }));
      fixture.detectChanges();
      expect(
        (el().querySelector('[data-testid="filter-phone"]') as HTMLInputElement).classList,
      ).not.toContain('ss-input--invalid');
    }));

    it('clear resets every filter in one reload', () => {
      c()['setPhone']('555123456');
      c()['setStatus']('void');
      c()['setShadowOnly'](true);
      const before = rankingSpy.scorecards.calls.count();
      c()['clearFilters']();
      expect(rankingSpy.scorecards.calls.count()).toBe(before + 1);
      expect(lastQuery()).toEqual(
        jasmine.objectContaining({
          status: undefined,
          shadowOnly: undefined,
          userId: undefined,
          phone: undefined,
        }),
      );
    });
  });

  describe('deep link', () => {
    it('?phone= seeds the phone filter', async () => {
      await setup({ phone: '+995555123456' });
      expect(lastQuery()).toEqual(jasmine.objectContaining({ phone: '+995555123456' }));
    });

    it('?userId=&status=&shadowOnly=true seeds the filters of the first load', async () => {
      await setup({ userId: USER_ID, status: 'pending', shadowOnly: 'true' });
      expect(rankingSpy.scorecards).toHaveBeenCalledOnceWith({
        phone: undefined,
        status: 'pending',
        shadowOnly: true,
        userId: USER_ID,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('void', () => {
    beforeEach(async () => setup());

    it('reason dialog → POST void → the row turns void in place', () => {
      dialogsSpy.open.and.returnValue(of('duplicate entry'));
      rankingSpy.voidScorecard.and.returnValue(
        of(card('s1', { status: 'void', voidReason: 'duplicate entry' })),
      );
      c()['voidScorecard'](rows[0]);
      fixture.detectChanges();

      expect(rankingSpy.voidScorecard).toHaveBeenCalledOnceWith('s1', 'duplicate entry');
      expect(c()['rows']()[0].status).toBe('void');
      expect(all('scorecard-void').length).toBe(0);
      expect(toastSpy.open).toHaveBeenCalledWith('შედეგი ანულირდა', { appearance: 'success' });
    });

    it('a cancelled reason dialog sends nothing', () => {
      dialogsSpy.open.and.returnValue(of(null));
      c()['voidScorecard'](rows[0]);
      expect(rankingSpy.voidScorecard).not.toHaveBeenCalled();
    });

    it('a 409 (no longer confirmed) says so and reloads the page', () => {
      dialogsSpy.open.and.returnValue(of('dup'));
      rankingSpy.voidScorecard.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409 })),
      );
      const before = rankingSpy.scorecards.calls.count();
      c()['voidScorecard'](rows[0]);
      expect(toastSpy.open).toHaveBeenCalledWith('მხოლოდ დადასტურებული შედეგი ანულირდება', {
        appearance: 'error',
      });
      expect(rankingSpy.scorecards.calls.count()).toBe(before + 1);
    });
  });
});
