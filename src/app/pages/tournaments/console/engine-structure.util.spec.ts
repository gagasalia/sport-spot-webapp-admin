import { switchLang } from '../../../shared/i18n/lang';
import { TournamentStructure } from '../../../shared/models/tournament-engine.model';
import {
  advancementPositions,
  bracketShape,
  defaultForm,
  entrantShortfall,
  formError,
  formToDto,
  formToStructure,
  groupSizes,
  minimumEntrants,
  nextAdvancement,
  qualifierCount,
  renderSummary,
  socialRoundShape,
  structureSummary,
  structureToForm,
  trimAdvancement,
} from './engine-structure.util';
import { renderMsg } from './msg.util';

/** Client mirror of sport-spot-api engine/structure.ts (docs/33 §2.1). */
describe('engine-structure.util', () => {
  beforeEach(() => switchLang('ka'));

  describe('defaults (normalizeStructure(format, {}))', () => {
    it('knockout: best of 3 with a super-tiebreak decider, no bronze', () => {
      const dto = formToDto('knockout', defaultForm('knockout'));
      expect(dto).toEqual({
        scoring: { type: 'sets', bestOf: 3, superTiebreak: true },
        knockout: { thirdPlace: false },
        rated: true,
      });
    });

    it('groups + playoffs: 2 groups, top two straight through, bracket best of 3', () => {
      expect(formToDto('groups_playoffs', defaultForm('groups_playoffs'))).toEqual({
        scoring: { type: 'sets', bestOf: 1, superTiebreak: false },
        knockoutScoring: { type: 'sets', bestOf: 3, superTiebreak: true },
        groups: { count: 2, rounds: 1, advancement: ['direct', 'direct'], wildcards: 0 },
        knockout: { thirdPlace: false },
        rated: true,
      });
    });

    it('a league is one group: only the rounds go over', () => {
      expect(formToDto('round_robin', defaultForm('round_robin'))).toEqual({
        scoring: { type: 'sets', bestOf: 1, superTiebreak: false },
        groups: { rounds: 1 },
        rated: true,
      });
    });

    it('americano / mexicano: points to 24, 7 rounds, 2 courts, 1+4 v 2+3', () => {
      expect(formToDto('mexicano', defaultForm('mexicano'))).toEqual({
        scoring: { type: 'points', pointsTarget: 24 },
        social: { rounds: 7, courts: 2, pairing: '1-4_2-3' },
        rated: true,
      });
    });
  });

  it('a stored structure fills the form; timed rounds send pointsTarget: null', () => {
    const stored: TournamentStructure = {
      scoring: { type: 'points' },
      social: { rounds: 5, courts: 3, pairing: '1-3_2-4' },
      rated: false,
    };
    const form = structureToForm('americano', stored);
    expect(form.pointsTarget).toBeNull();
    expect(form.socialRounds).toBe(5);
    expect(form.rated).toBeFalse();
    expect(formToDto('americano', form).scoring).toEqual({ type: 'points', pointsTarget: null });
  });

  it('a best-of-1 never sends a super tiebreak; trailing "out" positions are trimmed', () => {
    const form = { ...defaultForm('groups_playoffs'), koBestOf: 1 as const, koSuperTiebreak: true };
    form.advancement = ['direct', 'playoff', 'out', 'out'];
    const dto = formToDto('groups_playoffs', form);
    expect(dto.knockoutScoring).toEqual({ type: 'sets', bestOf: 1, superTiebreak: false });
    expect(dto.groups?.advancement).toEqual(['direct', 'playoff']);
    expect(trimAdvancement(['out'])).toEqual(['out']);
  });

  it('flags what the API would refuse', () => {
    const form = defaultForm('groups_playoffs');
    expect(formError('groups_playoffs', form)).toBeNull();
    expect(formError('groups_playoffs', { ...form, advancement: ['out', 'out'] })).toBe(
      'ჯგუფიდან ერთი ადგილი მაინც უნდა გადიოდეს',
    );
    expect(formError('groups_playoffs', { ...form, groupCount: 17 })).toContain('16');
    expect(formError('americano', { ...defaultForm('americano'), pointsTarget: 70 })).toContain('64');
    expect(formError('americano', { ...defaultForm('americano'), pointsTarget: null })).toBeNull();
    expect(formError('mexicano', { ...defaultForm('mexicano'), socialCourts: 0 })).toContain('12');
  });

  it('advancement chips cycle direct → playoff → out → direct', () => {
    expect(nextAdvancement('direct')).toBe('playoff');
    expect(nextAdvancement('playoff')).toBe('out');
    expect(nextAdvancement('out')).toBe('direct');
  });

  it('offers one chip per position of the largest group (1…8)', () => {
    expect(advancementPositions(12, 4, 2)).toBe(3);
    expect(advancementPositions(13, 4, 2)).toBe(4);
    expect(advancementPositions(0, 2, 3)).toBe(3);
    expect(advancementPositions(40, 1, 2)).toBe(8);
  });

  describe('shape math', () => {
    it('groups take the extras first', () => {
      expect(groupSizes(14, 4)).toEqual([4, 4, 3, 3]);
    });

    it('qualifiers: direct, playoff and the wildcards the groups can supply', () => {
      expect(qualifierCount([3, 3, 3, 3], ['direct', 'playoff', 'playoff'], 0)).toEqual({
        direct: 4,
        playoff: 8,
        wildcards: 0,
        total: 12,
      });
      // best third-placed teams: only groups with a 3rd place count
      expect(qualifierCount([3, 3, 2], ['direct', 'direct'], 4).wildcards).toBe(2);
    });

    it('bracket: byes to the top seeds, a play-in when playoff positions fill round 1', () => {
      const playIn = bracketShape(12, false, true)!;
      expect(playIn).toEqual(
        jasmine.objectContaining({ size: 16, rounds: 4, firstRoundMatches: 4, byes: 4, playIn: true, mainRound: 'quarter', matches: 11, bronze: false }),
      );
      const knockout = bracketShape(5, true, false)!;
      expect(knockout).toEqual(
        jasmine.objectContaining({ size: 8, firstRoundMatches: 1, byes: 3, playIn: false, mainRound: 'quarter', matches: 5, bronze: true }),
      );
      // 3 entrants: one semi-final is a bye — no bronze match
      expect(bracketShape(3, true, false)!.bronze).toBeFalse();
      expect(bracketShape(4, true, false)!.matches).toBe(4);
      expect(bracketShape(1, false, false)).toBeNull();
    });

    it('social rounds: courts cap the matches, the rest rest', () => {
      expect(socialRoundShape('americano', 'singles', 8, 2, 7)).toEqual({ perRound: 2, resting: 0, total: 14 });
      expect(socialRoundShape('americano', 'singles', 10, 2, 3)).toEqual({ perRound: 2, resting: 2, total: 6 });
      expect(socialRoundShape('mexicano', 'doubles', 5, 4, 4)).toEqual({ perRound: 2, resting: 1, total: 8 });
      // pairs americano: the round robin split by the courts, first `rounds` of it
      expect(socialRoundShape('americano', 'doubles', 6, 2, 5).total).toBe(8);
    });
  });

  describe('entrantShortfall (mirrors the API)', () => {
    const groups = formToStructure('groups_playoffs', { ...defaultForm('groups_playoffs'), groupCount: 4 });

    it('groups need two entrants each', () => {
      expect(renderMsg(entrantShortfall('groups_playoffs', 'doubles', groups, 7))).toBe(
        '4 ჯგუფს მინიმუმ 8 მონაწილე სჭირდება',
      );
      expect(entrantShortfall('groups_playoffs', 'doubles', groups, 8)).toBeNull();
    });

    it('individual americano needs a full court; knockout two', () => {
      const social = formToStructure('americano', defaultForm('americano'));
      expect(renderMsg(entrantShortfall('americano', 'singles', social, 3))).toBe('საჭიროა მინიმუმ 4 მონაწილე');
      expect(entrantShortfall('americano', 'doubles', social, 3)).toBeNull();
      expect(entrantShortfall('knockout', 'doubles', formToStructure('knockout', defaultForm('knockout')), 1)).not.toBeNull();
    });

    it('fewer than two bracket seeds', () => {
      const one = formToStructure('groups_playoffs', {
        ...defaultForm('groups_playoffs'),
        groupCount: 1,
        advancement: ['direct'],
      });
      expect(renderMsg(entrantShortfall('groups_playoffs', 'doubles', one, 4))).toBe(
        'ბადეში ორზე ნაკლები გუნდი გავა',
      );
    });

    it('minimum entrants per format', () => {
      expect(minimumEntrants('americano', 'singles', null)).toBe(4);
      expect(minimumEntrants('knockout', 'doubles', null)).toBe(2);
      expect(minimumEntrants('groups_playoffs', 'doubles', groups)).toBe(8);
    });
  });

  describe('live summary', () => {
    it('renders the brief’s example exactly', () => {
      const structure = formToStructure('groups_playoffs', {
        ...defaultForm('groups_playoffs'),
        groupCount: 4,
        advancement: ['direct', 'playoff', 'playoff'],
      });
      const summary = structureSummary('groups_playoffs', 'doubles', structure, 12);
      expect(summary.groupMatches).toBe(12);
      expect(summary.bracketMatches).toBe(11);
      expect(summary.shortfall).toBeNull();
      expect(renderSummary(summary)).toBe(
        '12 წყვილი → 4 ჯგუფი × 3 → 4 პირდაპირ + 8 საკვალიფიკაციოში → 1/4 ფინალი · 12 მატჩი ჯგუფებში + 11 ბადეში',
      );
    });

    it('re-renders in English on a language flip (nothing baked)', () => {
      const structure = formToStructure('knockout', defaultForm('knockout'));
      const summary = structureSummary('knockout', 'singles', structure, 10);
      expect(renderSummary(summary)).toBe('10 მოთამაშე → 1/8 ფინალი + 6 გადის პირდაპირ მეორე წრეში · 9 მატჩი');
      switchLang('en');
      expect(renderSummary(summary)).toBe('10 players → Round of 16 + 6 go straight to round 2 · 9 matches');
      switchLang('ka');
    });

    it('a league counts its round-robin matches (double round = twice)', () => {
      const structure = formToStructure('championship', { ...defaultForm('championship'), groupRounds: 2 });
      const summary = structureSummary('championship', 'doubles', structure, 6);
      expect(summary.groupMatches).toBe(30);
      expect(renderSummary(summary)).toBe(
        '6 წყვილი → ერთი ცხრილი — ყველა ყველასთან, ორ წრედ · 30 მატჩი',
      );
    });

    it('americano shows rounds × matches and who rests', () => {
      const structure = formToStructure('americano', defaultForm('americano'));
      const summary = structureSummary('americano', 'singles', structure, 10);
      expect(renderSummary(summary)).toBe('10 მოთამაშე → 7 რაუნდი × 2 მატჩი + რაუნდში ისვენებს 2 · 14 მატჩი');
    });

    it('carries the shortfall when the entrants do not fit', () => {
      const structure = formToStructure('groups_playoffs', { ...defaultForm('groups_playoffs'), groupCount: 4 });
      const summary = structureSummary('groups_playoffs', 'doubles', structure, 6);
      expect(renderMsg(summary.shortfall)).toBe('4 ჯგუფს მინიმუმ 8 მონაწილე სჭირდება');
    });
  });
});
