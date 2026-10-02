import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import {
  LOOKUP_DEBOUNCE_MS,
  TournamentResultsDialogComponent,
  defaultMode,
  defaultScoreType,
} from './tournament-results-dialog.component';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { RankingService } from '../../../services/http-services/ranking.service';
import { TournamentService } from '../../../services/http-services/tournament.service';
import { SS_DIALOG_CONTEXT, SsDialogService } from '../../../shared/ui/dialog.service';
import { SsToastService } from '../../../shared/ui/toast.service';
import { SsAvatarComponent } from '../../../shared/ui/ss-avatar.component';
import { Tournament, TournamentRegistration } from '../../../shared/models/tournament.model';
import { ScorecardView } from '../../../shared/models/ranking.model';
import { MSG_SET_ILLEGAL, MSG_UNFINISHED } from '../../../shared/utils/score-rules.util';

const tournament: Tournament = {
  _id: 't1',
  academy: 'a1',
  facility: 'f1',
  facilityName: 'Arena',
  name: 'Autumn Open',
  sportType: 'padel',
  type: 'doubles',
  format: 'knockout',
  level: 'any',
  category: 'mixed',
  startDate: '2026-10-10',
  startTime: '10:00',
  entryFeeTetri: 0,
  currency: 'GEL',
  maxParticipants: 16,
  registeredCount: 2,
  status: 'published',
};

const regs: TournamentRegistration[] = [
  {
    _id: 'r1',
    tournament: 't1',
    user: 'u1',
    status: 'registered',
    playerName: 'Nino',
    playerPhone: '+995555000001',
    partnerName: 'Luka',
    partnerPhone: '+995555000002',
    paymentStatus: 'paid',
  },
  {
    // legacy doubles registration: the partner has a name but no phone
    _id: 'r2',
    tournament: 't1',
    user: 'u2',
    status: 'registered',
    playerName: 'Giorgi',
    playerPhone: '+995555000003',
    partnerName: 'Dato',
    paymentStatus: 'pay_at_venue',
  },
  {
    _id: 'r3',
    tournament: 't1',
    user: 'u3',
    status: 'cancelled',
    playerName: 'Gone',
    playerPhone: '+995555000009',
    paymentStatus: 'refunded',
  },
];

const rated: ScorecardView = {
  id: 's1',
  source: { type: 'tournament', tournamentId: 't1' },
  mode: 'doubles',
  playedAt: '2026-10-10T06:00:00.000Z',
  participants: [
    { key: 'a', name: 'Nino', isShadow: false, isMe: false, phone: '+995555000001', userId: 'u1' },
    { key: 'b', name: 'Luka', isShadow: true, isMe: false, phone: '+995555000002' },
    {
      key: 'c',
      name: 'Giorgi',
      isShadow: false,
      isMe: false,
      phone: '+995555000003',
      userId: 'u2',
    },
    { key: 'd', name: 'Dato', isShadow: true, isMe: false, phone: '+995555000004' },
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
          [6, 1],
          [6, 1],
        ],
      },
      winner: 0,
    },
  ],
  status: 'confirmed',
  approvals: [],
  enteredBy: { adminId: 'admin1' },
  flags: {},
  deltas: [
    { key: 'a', ratingBefore: 1500, ratingAfter: 1512.4, rdBefore: 350, rdAfter: 300, delta: 12.4 },
    { key: 'b', ratingBefore: 1500, ratingAfter: 1512.4, rdBefore: 350, rdAfter: 300, delta: 12.4 },
    {
      key: 'c',
      ratingBefore: 1500,
      ratingAfter: 1487.6,
      rdBefore: 350,
      rdAfter: 300,
      delta: -12.4,
    },
    {
      key: 'd',
      ratingBefore: 1500,
      ratingAfter: 1487.6,
      rdBefore: 350,
      rdAfter: 300,
      delta: -12.4,
    },
  ],
  createdAt: '2026-10-10T08:00:00.000Z',
};

describe('TournamentResultsDialogComponent', () => {
  let fixture: ComponentFixture<TournamentResultsDialogComponent>;
  let component: TournamentResultsDialogComponent;
  let rankingSpy: jasmine.SpyObj<RankingService>;
  let tournamentSpy: jasmine.SpyObj<TournamentService>;
  let dialogsSpy: jasmine.SpyObj<SsDialogService>;

  async function setup(t: Tournament = tournament, results: ScorecardView[] = []) {
    rankingSpy = jasmine.createSpyObj<RankingService>('RankingService', [
      'tournamentResults',
      'createTournamentResult',
      'voidTournamentResult',
      'lookupCustomer',
    ]);
    rankingSpy.tournamentResults.and.returnValue(of(results));
    rankingSpy.lookupCustomer.and.returnValue(of({ found: false }));
    tournamentSpy = jasmine.createSpyObj<TournamentService>('TournamentService', [
      'getRegistrations',
      'updateRegistration',
    ]);
    tournamentSpy.getRegistrations.and.returnValue(of(regs));
    // The PATCH echoes the registration with the partner phone in E.164.
    tournamentSpy.updateRegistration.and.callFake((_t, id, dto) =>
      of({
        ...regs.find((r) => r._id === id)!,
        ...dto,
        ...(dto.partnerPhone ? { partnerPhone: '+995555000004' } : {}),
      }),
    );
    dialogsSpy = jasmine.createSpyObj<SsDialogService>('SsDialogService', ['open']);

    await TestBed.configureTestingModule({
      imports: [TournamentResultsDialogComponent],
      providers: [
        {
          provide: SS_DIALOG_CONTEXT,
          useValue: { data: { tournament: t }, completeWith: () => undefined },
        },
        { provide: RankingService, useValue: rankingSpy },
        { provide: TournamentService, useValue: tournamentSpy },
        { provide: SsDialogService, useValue: dialogsSpy },
        { provide: SsToastService, useValue: { open: () => of(undefined) } },
      ],
    })
      .overrideComponent(TournamentResultsDialogComponent, {
        // set:{imports} REPLACES the array — every label renders through `| t`
        // (TPipe), the form binds through ngModel (FormsModule) and a found
        // account shows its avatar (SsAvatarComponent).
        set: { imports: [DatePipe, FormsModule, SsAvatarComponent, TPipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TournamentResultsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (testId: string) => el().querySelector(`[data-testid="${testId}"]`);
  // protected members, reached the way the other admin specs do
  const c = () => component as unknown as Record<string, any>;

  /** Nino + Luka vs Giorgi + Dato, the missing partner phone filled in. */
  function pickBothPairs(): void {
    c()['toggleForm']();
    c()['pick'](0, 0, 'r1:c');
    c()['pick'](1, 0, 'r2:c');
    c()['setPhone'](1, 1, '555 000 004');
  }

  function typeSets(rows: Array<[number, number]>): void {
    rows.forEach(([a, b], r) => {
      if (r >= c()['setRows']().length) c()['addSet']();
      c()['setCell'](r, 0, a);
      c()['setCell'](r, 1, b);
    });
  }

  describe('defaults', () => {
    it('a doubles knockout enters doubles in sets; americano/mexicano default to points', () => {
      expect(defaultMode(tournament)).toBe('doubles');
      expect(defaultScoreType(tournament)).toBe('sets');
      expect(defaultScoreType({ format: 'americano' })).toBe('points');
      expect(defaultScoreType({ format: 'mexicano' })).toBe('points');
      // individual registrations rotating partners still play doubles
      expect(defaultMode({ type: 'singles', format: 'americano' })).toBe('doubles');
      expect(defaultMode({ type: 'singles', format: 'knockout' })).toBe('singles');
    });

    it('an americano tournament opens the form on points', async () => {
      await setup({ ...tournament, format: 'americano' });
      expect(c()['scoreType']()).toBe('points');
    });
  });

  describe('team pickers over the registrations', () => {
    beforeEach(async () => setup());

    it('offers only live registrations', () => {
      const values = c()
        ['pool']()
        .flatMap((g: any) => g.people.map((p: any) => p.value));
      expect(values).toEqual(['r1:c', 'r1:p', 'r2:c', 'r2:p']);
    });

    it('picking a captain pulls the partner into the side — one pick = the pair', () => {
      c()['pick'](0, 0, 'r1:c');
      const side = c()['sides']()[0];
      expect(side[0]).toEqual(
        jasmine.objectContaining({ pick: 'r1:c', phone: '+995555000001', phoneLocked: true }),
      );
      expect(side[1]).toEqual(
        jasmine.objectContaining({ pick: 'r1:p', phone: '+995555000002', name: 'Luka' }),
      );
      // the pair is taken: the other side cannot pick it again
      expect(c()['isTaken']('r1:p', 1, 0)).toBeTrue();
    });

    it('a registration without partnerPhone shows an inline phone field and the note', () => {
      c()['toggleForm']();
      c()['pick'](1, 0, 'r2:c');
      fixture.detectChanges();
      const partner = c()['sides']()[1][1];
      expect(partner.phoneLocked).toBeFalse();
      expect(partner.name).toBe('Dato');
      expect(q('phone-1-1')).not.toBeNull();
      // the typed phone is saved onto the registration too
      expect(q('partner-phone-note')?.textContent?.trim()).toBe(
        'ტელეფონი რეგისტრაციაშიც შეინახება',
      );
    });

    it('a walk-in needs a valid phone and a name', () => {
      c()['pick'](0, 0, 'walkin');
      c()['setPhone'](0, 0, 'abc');
      const errors = c()['slotErrors']()[0][0];
      expect(errors.phone).toBe('ტელეფონის ფორმატი არასწორია');
      expect(errors.name).toBe('სახელი — მინიმუმ 2 სიმბოლო');
    });

    it('the same number twice blocks the save', () => {
      pickBothPairs();
      c()['setPhone'](1, 1, '+995 555 000 001'); // = Nino's number
      typeSets([
        [6, 1],
        [6, 1],
      ]);
      expect(c()['duplicatePhone']()).toBeTrue();
      c()['save']();
      expect(rankingSpy.createTournamentResult).not.toHaveBeenCalled();
    });
  });

  describe('score validation', () => {
    beforeEach(async () => {
      await setup();
      pickBothPairs();
    });

    it('an illegal set blocks the save and shows its row error', () => {
      typeSets([
        [6, 5],
        [6, 1],
      ]);
      fixture.detectChanges();
      // a completed illegal row shows at once
      expect(q('set-error-0')?.textContent?.trim()).toBe(MSG_SET_ILLEGAL);

      c()['save']();
      expect(rankingSpy.createTournamentResult).not.toHaveBeenCalled();
    });

    it('1-1 in sets is unfinished — the game error shows on save', () => {
      typeSets([
        [6, 4],
        [4, 6],
      ]);
      c()['save']();
      fixture.detectChanges();
      expect(rankingSpy.createTournamentResult).not.toHaveBeenCalled();
      expect(q('game-error')?.textContent?.trim()).toBe(MSG_UNFINISHED);
    });

    it('a super tiebreak decider saves, with slots in a, b, c, d order', () => {
      rankingSpy.createTournamentResult.and.returnValue(of(rated));
      typeSets([
        [6, 4],
        [4, 6],
        [10, 8],
      ]);
      c()['save']();
      expect(rankingSpy.createTournamentResult).toHaveBeenCalledOnceWith('t1', {
        mode: 'doubles',
        participants: [
          { key: 'a', phone: '+995555000001', name: 'Nino' },
          { key: 'b', phone: '+995555000002', name: 'Luka' },
          { key: 'c', phone: '+995555000003', name: 'Giorgi' },
          // what the operator typed — the API normalizes it
          { key: 'd', phone: '555 000 004', name: 'Dato' },
        ],
        games: [
          {
            teams: [
              ['a', 'b'],
              ['c', 'd'],
            ],
            score: {
              type: 'sets',
              sets: [
                [6, 4],
                [4, 6],
                [10, 8],
              ],
            },
          },
        ],
      });
    });

    it('a different day than the start travels as playedAt', () => {
      rankingSpy.createTournamentResult.and.returnValue(of(rated));
      typeSets([[6, 0]]);
      c()['playedOn'].set('2026-10-11');
      c()['save']();
      const dto = rankingSpy.createTournamentResult.calls.mostRecent().args[1];
      expect(dto.playedAt).toBe(new Date('2026-10-11T12:00:00').toISOString());
    });

    it('points: 0-0 is refused, a 16-16 tie saves', () => {
      rankingSpy.createTournamentResult.and.returnValue(of(rated));
      c()['setScoreType']('points');
      c()['setPoint'](0, 0);
      c()['setPoint'](1, 0);
      c()['save']();
      fixture.detectChanges();
      expect(rankingSpy.createTournamentResult).not.toHaveBeenCalled();
      expect(q('points-error')).not.toBeNull();

      c()['setPoint'](0, 16);
      c()['setPoint'](1, 16);
      c()['save']();
      const dto = rankingSpy.createTournamentResult.calls.mostRecent().args[1];
      expect(dto.games[0].score).toEqual({ type: 'points', points: [16, 16] });
    });

    it('surfaces the API’s invalid_set_score message when the server disagrees', () => {
      rankingSpy.createTournamentResult.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: {
                result: null,
                errors: [
                  {
                    statusCode: 400,
                    message: 'invalid_set_score: set 1 (6-5) is not a legal padel set',
                  },
                ],
              },
            }),
        ),
      );
      typeSets([
        [6, 1],
        [6, 1],
      ]);
      c()['save']();
      fixture.detectChanges();
      const box = q('server-error')?.textContent ?? '';
      expect(box).toContain('სეტის ანგარიში არასწორია');
      expect(box).toContain('set 1 (6-5) is not a legal padel set');
    });

    it('the saved row appears with its per-player deltas and the form resets', () => {
      rankingSpy.createTournamentResult.and.returnValue(of(rated));
      typeSets([
        [6, 1],
        [6, 1],
      ]);
      c()['save']();
      fixture.detectChanges();

      expect(
        c()
          ['results']()
          .map((r: ScorecardView) => r.id),
      ).toEqual(['s1']);
      const deltas = Array.from(el().querySelectorAll('[data-testid="result-delta"]')).map((d) =>
        d.textContent?.trim(),
      );
      expect(deltas).toEqual(['+12', '+12', '−12', '−12']);
      expect(q('result-score')?.textContent?.trim()).toBe('6-1 6-1');
      // ready for the next match
      expect(c()['sides']()[0][0].pick).toBe('');
      expect(c()['submitted']()).toBeFalse();
    });
  });

  describe('partner phone → registration (PATCH)', () => {
    beforeEach(async () => {
      await setup();
      pickBothPairs();
      typeSets([
        [6, 1],
        [6, 1],
      ]);
    });

    it('PATCHes the typed partner phone first, then saves the result and refreshes the pickers', () => {
      const order: string[] = [];
      tournamentSpy.updateRegistration.calls.reset();
      tournamentSpy.updateRegistration.and.callFake((_t, id, dto) => {
        order.push('patch');
        return of({ ...regs.find((r) => r._id === id)!, ...dto, partnerPhone: '+995555000004' });
      });
      rankingSpy.createTournamentResult.and.callFake(() => {
        order.push('result');
        return of(rated);
      });
      const refreshed = regs.map((r) =>
        r._id === 'r2' ? { ...r, partnerPhone: '+995555000004' } : r,
      );
      tournamentSpy.getRegistrations.and.returnValue(of(refreshed));

      c()['save']();

      // the registration already has partnerName 'Dato' → only the phone travels
      expect(tournamentSpy.updateRegistration).toHaveBeenCalledOnceWith('t1', 'r2', {
        partnerPhone: '555 000 004',
      });
      expect(order).toEqual(['patch', 'result']);
      expect(tournamentSpy.getRegistrations).toHaveBeenCalledTimes(2);
      // the picker no longer flags the partner's phone as missing
      const partner = c()['pool']()[1].people[1];
      expect(c()['personLabel'](partner)).toContain('+995555000004');
      expect(c()['personLabel'](partner)).not.toContain('ტელეფონი აკლია');
    });

    it('a registration without a partner name gets the typed one as well', () => {
      const nameless = regs.map((r) => (r._id === 'r2' ? { ...r, partnerName: undefined } : r));
      c()['registrations'].set(nameless);
      c()['setName'](1, 1, 'Dato Kapanadze');
      expect(c()['partnerPatches']()).toEqual([
        {
          registrationId: 'r2',
          dto: { partnerPhone: '555 000 004', partnerName: 'Dato Kapanadze' },
        },
      ]);
    });

    it('a failed PATCH stops before anything is rated', () => {
      tournamentSpy.updateRegistration.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: {
                errors: [{ statusCode: 400, message: 'partnerPhone must be a valid phone' }],
              },
            }),
        ),
      );
      c()['save']();
      fixture.detectChanges();
      expect(rankingSpy.createTournamentResult).not.toHaveBeenCalled();
      const box = q('server-error')?.textContent ?? '';
      expect(box).toContain('პარტნიორის ტელეფონი რეგისტრაციაში ვერ შეინახა');
      expect(box).toContain('partnerPhone must be a valid phone');
      expect(c()['isSaving']()).toBeFalse();
    });

    it('a phone the registration already holds is not PATCHed again', () => {
      c()['registrations'].set(
        regs.map((r) => (r._id === 'r2' ? { ...r, partnerPhone: '+995555000004' } : r)),
      );
      expect(c()['partnerPatches']()).toEqual([]);
    });
  });

  describe('account lookup of typed phones', () => {
    beforeEach(async () => {
      await setup();
      c()['toggleForm']();
      c()['pick'](0, 0, 'walkin');
    });

    it('debounces: only the settled number is looked up', fakeAsync(() => {
      c()['setPhone'](0, 0, '555 111 222');
      tick(100);
      c()['setPhone'](0, 0, '555 111 223');
      tick(LOOKUP_DEBOUNCE_MS - 1);
      expect(rankingSpy.lookupCustomer).not.toHaveBeenCalled();
      tick(1);
      expect(rankingSpy.lookupCustomer).toHaveBeenCalledOnceWith('555 111 223');
    }));

    it('an unparsable number never reaches the API', fakeAsync(() => {
      c()['setPhone'](0, 0, '12');
      tick(LOOKUP_DEBOUNCE_MS);
      expect(rankingSpy.lookupCustomer).not.toHaveBeenCalled();
    }));

    it('found: the account’s name + avatar replace the name field; no name is sent', fakeAsync(() => {
      rankingSpy.lookupCustomer.and.returnValue(
        of({ found: true, userId: 'u9', name: 'Luka Tsereteli', memberId: 42 }),
      );
      c()['setPhone'](0, 0, '555 111 222');
      tick(LOOKUP_DEBOUNCE_MS);
      fixture.detectChanges();

      expect(q('account-0-0')?.textContent).toContain('Luka Tsereteli');
      expect(q('account-0-0')?.textContent).toContain('ID 000042');
      expect(q('name-0-0')).toBeNull();
      expect(c()['slotErrors']()[0][0].name).toBeUndefined();
      expect(c()['buildDto']().participants[0]).toEqual({ key: 'a', phone: '555 111 222' });
    }));

    it('not found: the name stays required, with a hint', fakeAsync(() => {
      c()['setPhone'](0, 0, '555 111 222');
      tick(LOOKUP_DEBOUNCE_MS);
      fixture.detectChanges();

      expect(q('no-account-0-0')).not.toBeNull();
      expect(q('name-0-0')).not.toBeNull();
      expect(c()['slotErrors']()[0][0].name).toBe('სახელი — მინიმუმ 2 სიმბოლო');
    }));

    it('an answer for a number the slot no longer holds is ignored', fakeAsync(() => {
      rankingSpy.lookupCustomer.and.returnValue(of({ found: true, userId: 'u9', name: 'Luka' }));
      c()['setPhone'](0, 0, '555 111 222');
      tick(LOOKUP_DEBOUNCE_MS);
      expect(c()['accountOf'](c()['sides']()[0][0])?.name).toBe('Luka');
      // the operator corrects the number: the old account no longer applies
      rankingSpy.lookupCustomer.and.returnValue(of({ found: false }));
      c()['setPhone'](0, 0, '555 111 333');
      expect(c()['accountOf'](c()['sides']()[0][0])).toBeNull();
      tick(LOOKUP_DEBOUNCE_MS);
      expect(c()['lookupOf'](c()['sides']()[0][0])?.state).toBe('missing');
    }));
  });

  describe('singles', () => {
    beforeEach(async () => setup({ ...tournament, type: 'singles' }));

    it('one slot per side, teams [[a], [b]]', () => {
      rankingSpy.createTournamentResult.and.returnValue(of(rated));
      expect(c()['mode']()).toBe('singles');
      c()['pick'](0, 0, 'r1:c');
      c()['pick'](1, 0, 'r2:c');
      typeSets([[7, 6]]);
      c()['save']();
      const dto = rankingSpy.createTournamentResult.calls.mostRecent().args[1];
      expect(dto.participants.map((p) => p.key)).toEqual(['a', 'b']);
      expect(dto.games[0].teams).toEqual([['a'], ['b']]);
    });
  });

  describe('void', () => {
    beforeEach(async () => setup(tournament, [rated]));

    it('reason dialog → DELETE → the row turns void', () => {
      dialogsSpy.open.and.returnValue(of('wrong pair'));
      rankingSpy.voidTournamentResult.and.returnValue(
        of({ ...rated, status: 'void', voidReason: 'wrong pair', deltas: undefined }),
      );
      fixture.detectChanges();
      expect(q('result-void')).not.toBeNull();

      c()['voidResult'](rated);
      fixture.detectChanges();

      expect(rankingSpy.voidTournamentResult).toHaveBeenCalledWith('t1', 's1', 'wrong pair');
      expect(c()['results']()[0].status).toBe('void');
      expect(q('result-void')).toBeNull();
    });

    it('a cancelled reason dialog sends nothing', () => {
      dialogsSpy.open.and.returnValue(of(null));
      c()['voidResult'](rated);
      expect(rankingSpy.voidTournamentResult).not.toHaveBeenCalled();
    });
  });
});
