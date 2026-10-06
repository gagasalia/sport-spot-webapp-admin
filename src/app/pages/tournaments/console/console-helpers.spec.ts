import { HttpErrorResponse } from '@angular/common/http';
import { switchLang } from '../../../shared/i18n/lang';
import {
  GroupView,
  KnockoutRoundView,
  MatchView,
  StandingRowView,
} from '../../../shared/models/tournament-engine.model';
import { TournamentRegistration } from '../../../shared/models/tournament.model';
import { changedOrders, isLevel } from './close-groups-dialog.component';
import { bracketColumns } from './draw/bracket.component';
import {
  entrantMap,
  matchStageLabel,
  placeholderLabel,
  scoreLabel,
  sideNames,
  sideScore,
} from './draw-display.util';
import { describeEngineError } from './engine-errors.util';
import { EMPTY_DRAFT, addEntrantBody, draftError, editEntrantBody } from './steps/entrants-step.component';
import { matchSections } from './steps/matches-step.component';

const rounds: KnockoutRoundView[] = [
  { round: 1, name: 'playin', slots: 8, matches: [] },
  { round: 2, name: 'quarter', slots: 4, matches: [] },
  { round: 3, name: 'semi', slots: 2, matches: [] },
  { round: 4, name: 'final', slots: 1, matches: [] },
];

function match(id: string, patch: Partial<MatchView> = {}): MatchView {
  return {
    id,
    stage: 'knockout',
    round: 1,
    order: 0,
    sides: [{ entrants: [] }, { entrants: [] }],
    status: 'pending',
    rated: false,
    ...patch,
  };
}

function row(entrant: string, patch: Partial<StandingRowView> = {}): StandingRowView {
  return {
    entrant,
    rank: 1,
    played: 3,
    won: 2,
    lost: 1,
    drawn: 0,
    setsFor: 4,
    setsAgainst: 2,
    gamesFor: 30,
    gamesAgainst: 20,
    pointsFor: 0,
    pointsAgainst: 0,
    zone: null,
    ...patch,
  };
}

function apiError(status: number, message: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { result: null, errors: [{ statusCode: status, message }] } });
}

describe('console helpers', () => {
  beforeEach(() => switchLang('ka'));

  describe('draw display', () => {
    const entrants = entrantMap([
      { id: 'a', name: 'ნინო / ლუკა', players: [] },
      { id: 'b', name: 'ანა / გიო', players: [] },
    ]);

    it('placeholders: "A1", "W1", "გამარჯვებული · 1/4 №2"', () => {
      expect(placeholderLabel({ type: 'group', group: 'A', position: 1 }, rounds)).toBe('A1');
      expect(placeholderLabel({ type: 'wildcard', rank: 1 }, rounds)).toBe('W1');
      expect(placeholderLabel({ type: 'winner', round: 2, order: 1 }, rounds)).toBe('გამარჯვებული · 1/4 №2');
      expect(placeholderLabel({ type: 'loser', round: 3, order: 0 }, rounds)).toBe(
        'დამარცხებული · ნახევარფინალი №1',
      );
      switchLang('en');
      expect(placeholderLabel({ type: 'winner', round: 3, order: 0 }, rounds)).toBe('Winner · Semi-final №1');
      switchLang('ka');
    });

    it('side names: entrants (individual americano = two), else the placeholder', () => {
      const known = match('m', { sides: [{ entrants: ['a'] }, { entrants: ['a', 'b'] }] });
      expect(sideNames(known, 0, entrants, rounds)).toBe('ნინო / ლუკა');
      expect(sideNames(known, 1, entrants, rounds)).toBe('ნინო / ლუკა / ანა / გიო');
      const pending = match('p', { sides: [{ entrants: [], placeholder: { type: 'group', group: 'B', position: 2 } }, { entrants: ['b'] }] });
      expect(sideNames(pending, 0, entrants, rounds)).toBe('B2');
    });

    it('scores per side and as one label', () => {
      const score = { type: 'sets' as const, sets: [[6, 4], [3, 6], [10, 8]] };
      expect(sideScore(score, 0)).toEqual(['6', '3', '10']);
      expect(sideScore(score, 1)).toEqual(['4', '6', '8']);
      expect(scoreLabel(score)).toBe('6-4 3-6 10-8');
      expect(scoreLabel({ type: 'points', points: [16, 8] })).toBe('16:8');
    });

    it('stage labels', () => {
      expect(matchStageLabel(match('g', { stage: 'group', group: 'A', round: 2 }), rounds)).toBe('ჯგუფი A · ტური 2');
      expect(matchStageLabel(match('k', { round: 2 }), rounds)).toBe('1/4');
      expect(matchStageLabel(match('b', { round: 4, kind: 'third_place' }), rounds)).toBe('მესამე ადგილი');
      expect(matchStageLabel(match('s', { stage: 'social', round: 3 }), rounds)).toBe('რაუნდი 3');
    });

    it('bracket columns place every match by its order (round 1 sparse — byes)', () => {
      const r1 = [match('q1', { order: 1 }), match('q2', { order: 6 })];
      const knockout = {
        rounds: [
          { round: 1, name: 'playin', slots: 8, matches: ['q1', 'q2'] },
          { round: 2, name: 'quarter', slots: 4, matches: [] },
        ],
        thirdPlace: null,
      };
      const columns = bracketColumns(knockout, new Map(r1.map((m) => [m.id, m])));
      expect(columns[0].cells.map((c) => c?.id ?? null)).toEqual([null, 'q1', null, null, null, null, 'q2', null]);
      expect(columns[1].cells.length).toBe(4);
    });
  });

  describe('engine errors → inline sentences', () => {
    it('maps the `<code>: <text>` codes and keeps the API text as the detail', () => {
      expect(describeEngineError(apiError(409, 'draw_exists: reset the draw to change this'))).toEqual({
        message: 'კენჭისყრა უკვე ჩატარებულია — შესაცვლელად ჯერ გააუქმეთ კენჭისყრა',
        detail: 'reset the draw to change this',
      });
      expect(describeEngineError(apiError(400, 'invalid_result: the two scores must add up to 24'))).toEqual({
        message: 'შედეგი არასწორია',
        detail: 'the two scores must add up to 24',
      });
      expect(describeEngineError(apiError(409, 'draw_exists')).message).toContain('კენჭისყრა უკვე');
    });

    it('plain API messages, 403 and the rest', () => {
      expect(describeEngineError(apiError(400, 'Tournament is full')).message).toBe(
        'ადგილები შევსებულია — გაზარდეთ ტურნირის ადგილები',
      );
      expect(describeEngineError(apiError(403, 'Forbidden')).message).toBe('ამ ტურნირზე წვდომა არ გაქვთ');
      expect(describeEngineError(apiError(400, 'name must be longer'))).toEqual({
        message: 'შეამოწმე ველები — მოთხოვნა ვერ დამუშავდა',
        detail: 'name must be longer',
      });
      expect(describeEngineError(new Error('offline')).message).toBe('მოქმედება ვერ შესრულდა, სცადეთ თავიდან');
    });
  });

  describe('close groups', () => {
    it('rows are level when everything the table shows is equal', () => {
      expect(isLevel(row('a'), row('b'), 'sets')).toBeTrue();
      expect(isLevel(row('a'), row('b', { gamesFor: 31, gamesAgainst: 21 }), 'sets')).toBeFalse();
      expect(isLevel(row('a', { pointsFor: 40, pointsAgainst: 30 }), row('b', { pointsFor: 40, pointsAgainst: 30 }), 'points')).toBeTrue();
    });

    it('sends only the orders the organizer changed', () => {
      const groups: GroupView[] = [
        { key: 'A', entrants: ['a', 'b'], standings: [row('a'), row('b')], closed: false },
        { key: 'B', entrants: ['c', 'd'], standings: [row('c'), row('d')], closed: false },
      ];
      expect(changedOrders(groups, { A: ['a', 'b'], B: ['c', 'd'] })).toBeUndefined();
      expect(changedOrders(groups, { A: ['b', 'a'], B: ['c', 'd'] })).toEqual({ A: ['b', 'a'] });
    });
  });

  describe('matches step sections', () => {
    const list = [
      match('f', { round: 3, order: 0, status: 'ready', court: 'C1' }),
      match('bronze', { round: 3, order: 1, kind: 'third_place' }),
      match('g2', { stage: 'group', group: 'B', round: 1, status: 'done' }),
      match('g1', { stage: 'group', group: 'A', round: 1, order: 1 }),
      match('s1', { round: 2, order: 0, status: 'done', court: 'C1' }),
    ];

    it('group rounds, then the bracket by round, the bronze match before the final', () => {
      const sections = matchSections(list, { status: 'all', group: null, court: null });
      expect(sections.map((s) => s.matches.map((m) => m.id))).toEqual([['g1', 'g2'], ['s1'], ['bronze'], ['f']]);
    });

    it('filters by status, group and court', () => {
      const todo = matchSections(list, { status: 'todo', group: null, court: null });
      expect(todo.flatMap((s) => s.matches.map((m) => m.id))).toEqual(['g1', 'bronze', 'f']);
      const groupB = matchSections(list, { status: 'all', group: 'B', court: null });
      expect(groupB.flatMap((s) => s.matches.map((m) => m.id))).toEqual(['g2']);
      const court = matchSections(list, { status: 'done', group: null, court: 'C1' });
      expect(court.flatMap((s) => s.matches.map((m) => m.id))).toEqual(['s1']);
    });
  });

  describe('entrant drafts', () => {
    const reg = (patch: Partial<TournamentRegistration> = {}): TournamentRegistration => ({
      _id: 'r1',
      tournament: 't1',
      status: 'registered',
      paymentStatus: 'pay_at_venue',
      playerName: 'გიორგი',
      playerPhone: '+995555000001',
      partnerName: 'ნიკა',
      ...patch,
    });

    it('a new entrant needs a name; phones must be acceptable', () => {
      expect(draftError(EMPTY_DRAFT, true)).toBe('სახელი — მინიმუმ 2 სიმბოლო');
      expect(draftError({ ...EMPTY_DRAFT, playerName: 'გიო', playerPhone: '12' }, true)).toBe(
        'ტელეფონის ფორმატი არასწორია',
      );
      expect(draftError({ ...EMPTY_DRAFT, playerName: 'გიო', playerPhone: '555 00 00 01' }, true)).toBeNull();
      expect(draftError(EMPTY_DRAFT, false)).toBeNull();
    });

    it('the add body leaves empty optionals out (and the partner for singles)', () => {
      const draft = { playerName: ' გიო ', playerPhone: '', partnerName: 'ნიკა', partnerPhone: '555000002' };
      expect(addEntrantBody(draft, true)).toEqual({ playerName: 'გიო', partnerName: 'ნიკა', partnerPhone: '555000002' });
      expect(addEntrantBody(draft, false)).toEqual({ playerName: 'გიო' });
    });

    it('an edit sends changed, non-empty fields only — the player’s own only on a hand-added row', () => {
      const draft = { playerName: 'გიორგი ბ.', playerPhone: '555000001', partnerName: 'ნიკა', partnerPhone: '555000009' };
      // same phone in another notation is no change
      expect(editEntrantBody(draft, reg(), { byHand: true, doubles: true })).toEqual({
        playerName: 'გიორგი ბ.',
        partnerPhone: '555000009',
      });
      expect(editEntrantBody(draft, reg(), { byHand: false, doubles: true })).toEqual({ partnerPhone: '555000009' });
      expect(editEntrantBody({ ...draft, playerName: 'გიორგი', partnerPhone: '' }, reg(), { byHand: true, doubles: true })).toBeNull();
    });
  });
});
