/**
 * Client mirror of the API's per-format structure rules (sport-spot-api
 * `tournaments/engine/structure.ts`, `qualifiers.ts`, `bracket.ts`, docs/33
 * §2.1): the defaults a format starts with, the editable form state, the
 * request body, why a field of entrants cannot be drawn (`entrantShortfall`)
 * and the LIVE SUMMARY the «ფორმატი» step shows.
 *
 * Pure. Every user-facing text is RAW Georgian (`SummaryPart.key`, shortfall
 * keys) — rendered through `tr()` at render time, never baked.
 */
import { Msg, renderMsg } from './msg.util';
import { TournamentFormat, TournamentType } from '../../../shared/models/tournament.model';
import {
  Advancement,
  BestOf,
  DEFAULT_POINTS_TARGET,
  GROUPS_MAX,
  GROUP_POSITIONS_MAX,
  MexicanoPairing,
  POINTS_TARGET_MAX,
  POINTS_TARGET_MIN,
  SOCIAL_COURTS_MAX,
  SOCIAL_INDIVIDUAL_MIN,
  SOCIAL_ROUNDS_MAX,
  ScoringType,
  StageScoring,
  StructureDto,
  TournamentStructure,
  WILDCARDS_MAX,
} from '../../../shared/models/tournament-engine.model';

export const isSocialFormat = (format: TournamentFormat): boolean =>
  format === 'americano' || format === 'mexicano';

export const hasGroupStage = (format: TournamentFormat): boolean =>
  format === 'round_robin' || format === 'championship' || format === 'groups_playoffs';

export const hasKnockoutStage = (format: TournamentFormat): boolean =>
  format === 'knockout' || format === 'groups_playoffs';

/** Individual americano / mexicano: one player per entrant, games are 2 v 2. */
export const isIndividualSocial = (format: TournamentFormat, type: TournamentType): boolean =>
  isSocialFormat(format) && type === 'singles';

// ─── Form state ───────────────────────────────────────────────────────────────

/** Everything the «ფორმატი» step edits, flat (only the format's blocks are sent). */
export interface StructureForm {
  /** Group / league stage scoring (social formats are always points). */
  scoringType: ScoringType;
  bestOf: BestOf;
  superTiebreak: boolean;
  /** null = timed rounds ("დროზე"). */
  pointsTarget: number | null;
  /** Group rounds: 1 = single, 2 = double round robin. */
  groupRounds: 1 | 2;
  groupCount: number;
  advancement: Advancement[];
  wildcards: number;
  /** Bracket scoring of groups + knockout (sets). */
  koBestOf: BestOf;
  koSuperTiebreak: boolean;
  thirdPlace: boolean;
  socialRounds: number;
  socialCourts: number;
  pairing: MexicanoPairing;
  rated: boolean;
}

/** Points targets offered as chips (anything else is "custom"). */
export const POINTS_PRESETS = [16, 21, 24, 32] as const;

const ADVANCEMENT_CYCLE: Record<Advancement, Advancement> = {
  direct: 'playoff',
  playoff: 'out',
  out: 'direct',
};

/** direct → playoff → out → direct (the advancement chip's tap). */
export function nextAdvancement(rule: Advancement): Advancement {
  return ADVANCEMENT_CYCLE[rule];
}

/** The format's defaults (normalizeStructure(format, {}) on the API). */
export function defaultForm(format: TournamentFormat): StructureForm {
  const social = isSocialFormat(format);
  return {
    scoringType: social ? 'points' : 'sets',
    bestOf: format === 'knockout' ? 3 : 1,
    superTiebreak: format === 'knockout',
    pointsTarget: DEFAULT_POINTS_TARGET,
    groupRounds: 1,
    groupCount: format === 'groups_playoffs' ? 2 : 1,
    advancement: ['direct', 'direct'],
    wildcards: 0,
    koBestOf: 3,
    koSuperTiebreak: true,
    thirdPlace: false,
    socialRounds: 7,
    socialCourts: 2,
    pairing: '1-4_2-3',
    rated: true,
  };
}

function asBestOf(value: number | undefined, fallback: BestOf): BestOf {
  return value === 1 || value === 3 || value === 5 ? value : fallback;
}

/** The stored structure (or nothing yet) → the editable form. */
export function structureToForm(
  format: TournamentFormat,
  structure: TournamentStructure | null | undefined,
): StructureForm {
  const form = defaultForm(format);
  if (!structure) {
    return form;
  }
  const scoring = structure.scoring;
  if (scoring?.type === 'sets') {
    form.scoringType = 'sets';
    form.bestOf = asBestOf(scoring.bestOf, form.bestOf);
    form.superTiebreak = !!scoring.superTiebreak;
  } else if (scoring?.type === 'points') {
    form.scoringType = 'points';
    form.pointsTarget = scoring.pointsTarget ?? null;
  }
  const ko = structure.knockoutScoring;
  if (ko?.type === 'sets') {
    form.koBestOf = asBestOf(ko.bestOf, form.koBestOf);
    form.koSuperTiebreak = !!ko.superTiebreak;
  }
  if (structure.groups) {
    form.groupRounds = structure.groups.rounds === 2 ? 2 : 1;
    form.groupCount = structure.groups.count || form.groupCount;
    if (structure.groups.advancement?.length) {
      form.advancement = [...structure.groups.advancement];
    }
    form.wildcards = structure.groups.wildcards ?? 0;
  }
  form.thirdPlace = !!structure.knockout?.thirdPlace;
  if (structure.social) {
    form.socialRounds = structure.social.rounds;
    form.socialCourts = structure.social.courts;
    form.pairing = structure.social.pairing ?? form.pairing;
  }
  form.rated = structure.rated ?? true;
  return form;
}

/** A trailing run of `out` says nothing (positions past it never advance). */
export function trimAdvancement(advancement: Advancement[]): Advancement[] {
  const out = [...advancement];
  while (out.length > 1 && out[out.length - 1] === 'out') {
    out.pop();
  }
  return out;
}

/** PUT /structure body: only the blocks this format uses. */
export function formToDto(format: TournamentFormat, form: StructureForm): StructureDto {
  if (isSocialFormat(format)) {
    return {
      scoring: { type: 'points', pointsTarget: form.pointsTarget },
      social: { rounds: form.socialRounds, courts: form.socialCourts, pairing: form.pairing },
      rated: form.rated,
    };
  }
  const sets = (bestOf: BestOf, superTiebreak: boolean) => ({
    type: 'sets' as const,
    bestOf,
    superTiebreak: bestOf > 1 && superTiebreak,
  });
  if (format === 'knockout') {
    return {
      scoring: sets(form.bestOf, form.superTiebreak),
      knockout: { thirdPlace: form.thirdPlace },
      rated: form.rated,
    };
  }
  const scoring =
    form.scoringType === 'points'
      ? { type: 'points' as const, pointsTarget: form.pointsTarget }
      : sets(form.bestOf, form.superTiebreak);
  if (format !== 'groups_playoffs') {
    return { scoring, groups: { rounds: form.groupRounds }, rated: form.rated };
  }
  return {
    scoring,
    knockoutScoring: sets(form.koBestOf, form.koSuperTiebreak),
    groups: {
      count: form.groupCount,
      rounds: form.groupRounds,
      advancement: trimAdvancement(form.advancement),
      wildcards: form.wildcards,
    },
    knockout: { thirdPlace: form.thirdPlace },
    rated: form.rated,
  };
}

/** The form as the normalized structure the API would store (for the summary). */
export function formToStructure(format: TournamentFormat, form: StructureForm): TournamentStructure {
  const dto = formToDto(format, form);
  const toScoring = (s: StructureDto['scoring']): StageScoring =>
    s?.type === 'points'
      ? s.pointsTarget == null
        ? { type: 'points' }
        : { type: 'points', pointsTarget: s.pointsTarget }
      : {
          type: 'sets',
          bestOf: asBestOf(s?.bestOf, 3),
          superTiebreak: !!s?.superTiebreak,
        };
  const structure: TournamentStructure = { scoring: toScoring(dto.scoring), rated: form.rated };
  if (dto.knockoutScoring) structure.knockoutScoring = toScoring(dto.knockoutScoring);
  if (dto.knockout) structure.knockout = { thirdPlace: !!dto.knockout.thirdPlace };
  if (dto.social) {
    structure.social = {
      rounds: form.socialRounds,
      courts: form.socialCourts,
      pairing: form.pairing,
    };
  }
  if (hasGroupStage(format)) {
    structure.groups = {
      count: format === 'groups_playoffs' ? form.groupCount : 1,
      rounds: form.groupRounds,
      advancement: format === 'groups_playoffs' ? trimAdvancement(form.advancement) : [],
      wildcards: format === 'groups_playoffs' ? form.wildcards : 0,
    };
  }
  return structure;
}

/** RAW-Georgian problem of the form, or null — mirrors the API's StructureError. */
export function formError(format: TournamentFormat, form: StructureForm): string | null {
  const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
  const usesPoints = isSocialFormat(format) || (hasGroupStage(format) && form.scoringType === 'points');
  if (
    usesPoints &&
    form.pointsTarget !== null &&
    (!isInt(form.pointsTarget) ||
      form.pointsTarget < POINTS_TARGET_MIN ||
      form.pointsTarget > POINTS_TARGET_MAX)
  ) {
    return 'ქულების ლიმიტი — 8-დან 64-მდე (ან „დროზე“)';
  }
  if (isSocialFormat(format)) {
    if (!isInt(form.socialRounds) || form.socialRounds < 1 || form.socialRounds > SOCIAL_ROUNDS_MAX) {
      return 'რაუნდები — 1-დან 30-მდე';
    }
    if (!isInt(form.socialCourts) || form.socialCourts < 1 || form.socialCourts > SOCIAL_COURTS_MAX) {
      return 'კორტები — 1-დან 12-მდე';
    }
    return null;
  }
  if (format === 'groups_playoffs') {
    if (!isInt(form.groupCount) || form.groupCount < 1 || form.groupCount > GROUPS_MAX) {
      return 'ჯგუფების რაოდენობა — 1-დან 16-მდე';
    }
    if (!isInt(form.wildcards) || form.wildcards < 0 || form.wildcards > WILDCARDS_MAX) {
      return 'დამატებითი ადგილები — 0-დან 8-მდე';
    }
    if (form.advancement.every((rule) => rule === 'out')) {
      return 'ჯგუფიდან ერთი ადგილი მაინც უნდა გადიოდეს';
    }
  }
  return null;
}

// ─── Shape math (groups, qualifiers, bracket) ─────────────────────────────────

/** Sizes of `count` groups holding `entrants` (the first groups take extras). */
export function groupSizes(entrants: number, count: number): number[] {
  if (count < 1) return [];
  const base = Math.floor(entrants / count);
  const extra = entrants % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/** The position whose best teams take the wildcard places. */
export function wildcardPosition(advancement: Advancement[]): number {
  const firstOut = advancement.indexOf('out');
  return (firstOut === -1 ? advancement.length : firstOut) + 1;
}

/** How many wildcards the groups can actually supply. */
export function effectiveWildcards(sizes: number[], advancement: Advancement[], wildcards: number): number {
  const position = wildcardPosition(advancement);
  const candidates = sizes.filter((size) => size >= position).length;
  return Math.max(0, Math.min(wildcards || 0, candidates));
}

export interface QualifierCount {
  direct: number;
  playoff: number;
  wildcards: number;
  total: number;
}

/** Who reaches the bracket from groups of these sizes. */
export function qualifierCount(
  sizes: number[],
  advancement: Advancement[],
  wildcards: number,
): QualifierCount {
  let direct = 0;
  let playoff = 0;
  advancement.forEach((rule, index) => {
    const reach = sizes.filter((size) => size >= index + 1).length;
    if (rule === 'direct') direct += reach;
    else if (rule === 'playoff') playoff += reach;
  });
  const wild = effectiveWildcards(sizes, advancement, wildcards);
  return { direct, playoff, wildcards: wild, total: direct + playoff + wild };
}

/** API round key by how many matches the round holds ('final', 'semi', 'quarter', 'r16' …). */
export function knockoutRoundName(round: number, totalRounds: number): string {
  const matches = 2 ** (totalRounds - round);
  if (matches === 1) return 'final';
  if (matches === 2) return 'semi';
  if (matches === 4) return 'quarter';
  return `r${matches * 2}`;
}

export interface BracketShape {
  /** Seeds entering the bracket. */
  seeds: number;
  /** Tree size (a power of two). */
  size: number;
  rounds: number;
  /** Real matches of round 1 (the rest of its slots are byes). */
  firstRoundMatches: number;
  /** Seeds that skip round 1. */
  byes: number;
  /** Round 1 is a qualification round (playoff positions, fewer matches than slots). */
  playIn: boolean;
  /** The API round key of the first "real" round ('quarter' after a play-in …). */
  mainRound: string;
  /** Every bracket match (+ the bronze match). */
  matches: number;
  bronze: boolean;
}

export function bracketShape(seeds: number, thirdPlace: boolean, hasPlayoff: boolean): BracketShape | null {
  if (seeds < 2) return null;
  const size = nextPowerOfTwo(seeds);
  const rounds = Math.log2(size);
  const firstRoundMatches = seeds - size / 2;
  const playIn = hasPlayoff && firstRoundMatches < size / 2;
  // A bronze match needs both semi-finals to be real matches.
  const semiMatches = rounds - 1 >= 2 ? 2 : rounds === 2 ? firstRoundMatches : 0;
  const bronze = thirdPlace && rounds >= 2 && semiMatches === 2;
  return {
    seeds,
    size,
    rounds,
    firstRoundMatches,
    byes: size - seeds,
    playIn,
    mainRound: knockoutRoundName(playIn && rounds > 1 ? 2 : 1, rounds),
    matches: seeds - 1 + (bronze ? 1 : 0),
    bronze,
  };
}

/** Round-robin matches of one group of `size` (× rounds). */
export function roundRobinMatches(size: number, rounds: number): number {
  return size < 2 ? 0 : ((size * (size - 1)) / 2) * rounds;
}

/** Matches per planned round of americano / mexicano, and who rests. */
export function socialRoundShape(
  format: TournamentFormat,
  type: TournamentType,
  entrants: number,
  courts: number,
  rounds: number,
): { perRound: number; resting: number; total: number } {
  const individual = isIndividualSocial(format, type);
  if (individual) {
    const perRound = Math.max(0, Math.min(courts, Math.floor(entrants / 4)));
    return { perRound, resting: Math.max(0, entrants - perRound * 4), total: perRound * rounds };
  }
  if (format === 'mexicano') {
    const perRound = Math.max(0, Math.min(courts, Math.floor(entrants / 2)));
    return { perRound, resting: Math.max(0, entrants - perRound * 2), total: perRound * rounds };
  }
  // Pairs americano: the round robin, rounds split by the courts, first `rounds`.
  if (entrants < 2) return { perRound: 0, resting: entrants, total: 0 };
  const rrRounds = entrants % 2 === 0 ? entrants - 1 : entrants;
  const perRr = Math.floor(entrants / 2);
  const chunks: number[] = [];
  for (let r = 0; r < rrRounds; r++) {
    for (let left = perRr; left > 0; left -= courts) chunks.push(Math.min(courts, left));
  }
  const planned = chunks.slice(0, rounds);
  const perRound = planned[0] ?? 0;
  return {
    perRound,
    resting: Math.max(0, entrants - perRound * 2),
    total: planned.reduce((sum, n) => sum + n, 0),
  };
}

// ─── Shortfall (entrantShortfall on the API) ──────────────────────────────────

/** One RAW-Georgian part of the summary (rendered with renderMsg). */
export type SummaryPart = Msg;


/** Why `entrants` cannot be drawn into this structure, or null when they can. */
export function entrantShortfall(
  format: TournamentFormat,
  type: TournamentType,
  structure: TournamentStructure,
  entrants: number,
): SummaryPart | null {
  if (isSocialFormat(format)) {
    const min = isIndividualSocial(format, type) ? SOCIAL_INDIVIDUAL_MIN : 2;
    return entrants < min ? { key: 'საჭიროა მინიმუმ %s მონაწილე', args: [min] } : null;
  }
  if (format === 'knockout') {
    return entrants < 2 ? { key: 'საჭიროა მინიმუმ %s მონაწილე', args: [2] } : null;
  }
  const count = structure.groups?.count ?? 1;
  if (entrants < count * 2) {
    return { key: '%s ჯგუფს მინიმუმ %s მონაწილე სჭირდება', args: [count, count * 2] };
  }
  if (format === 'groups_playoffs') {
    const q = qualifierCount(
      groupSizes(entrants, count),
      structure.groups?.advancement ?? [],
      structure.groups?.wildcards ?? 0,
    );
    if (q.total < 2) {
      return { key: 'ბადეში ორზე ნაკლები გუნდი გავა', args: [] };
    }
  }
  return null;
}

/** The fewest entrants the structure can be drawn with. */
export function minimumEntrants(
  format: TournamentFormat,
  type: TournamentType,
  structure: TournamentStructure | null,
): number {
  if (isSocialFormat(format)) return isIndividualSocial(format, type) ? SOCIAL_INDIVIDUAL_MIN : 2;
  if (format === 'groups_playoffs') return Math.max(2, (structure?.groups?.count ?? 2) * 2);
  return 2;
}

// ─── Live summary ─────────────────────────────────────────────────────────────

/** Full round names for sentences ("→ 1/4 ფინალი"). */
export const ROUND_FULL_KEYS: Readonly<Record<string, string>> = {
  playin: 'საკვალიფიკაციო',
  r64: '1/32 ფინალი',
  r32: '1/16 ფინალი',
  r16: '1/8 ფინალი',
  quarter: '1/4 ფინალი',
  semi: 'ნახევარფინალი',
  final: 'ფინალი',
};

export interface StructureSummary {
  /** "12 წყვილი → 4 ჯგუფი × 3 → …" (joined with →). */
  flow: SummaryPart[][];
  /** "12 მატჩი ჯგუფებში + 11 ბადეში" (joined with +). */
  totals: SummaryPart[];
  groupMatches: number;
  bracketMatches: number;
  socialMatches: number;
  bracket: BracketShape | null;
  qualifiers: QualifierCount | null;
  shortfall: SummaryPart | null;
}

const unitKey = (type: TournamentType): string => (type === 'doubles' ? '%s წყვილი' : '%s მოთამაშე');

/** What this structure turns `entrants` into — computed client-side, live. */
export function structureSummary(
  format: TournamentFormat,
  type: TournamentType,
  structure: TournamentStructure,
  entrants: number,
): StructureSummary {
  const summary: StructureSummary = {
    flow: [[{ key: unitKey(type), args: [entrants] }]],
    totals: [],
    groupMatches: 0,
    bracketMatches: 0,
    socialMatches: 0,
    bracket: null,
    qualifiers: null,
    shortfall: entrantShortfall(format, type, structure, entrants),
  };

  if (isSocialFormat(format)) {
    const social = structure.social ?? { rounds: 7, courts: 2, pairing: '1-4_2-3' as const };
    const shape = socialRoundShape(format, type, entrants, social.courts, social.rounds);
    summary.socialMatches = shape.total;
    const step: SummaryPart[] = [{ key: '%s რაუნდი × %s მატჩი', args: [social.rounds, shape.perRound] }];
    if (shape.resting > 0) {
      step.push({ key: 'რაუნდში ისვენებს %s', args: [shape.resting] });
    }
    summary.flow.push(step);
    if (format === 'mexicano') {
      summary.flow.push([{ key: 'ყოველი შემდეგი რაუნდი — ცხრილის მიხედვით' }]);
    }
    summary.totals.push({ key: '%s მატჩი', args: [shape.total] });
    return summary;
  }

  if (format === 'knockout') {
    const shape = bracketShape(entrants, !!structure.knockout?.thirdPlace, false);
    summary.bracket = shape;
    if (shape) {
      const step: SummaryPart[] = [{ key: '%s', args: [{ t: ROUND_FULL_KEYS[shape.mainRound] }] }];
      if (shape.byes > 0) {
        step.push({ key: '%s გადის პირდაპირ მეორე წრეში', args: [shape.byes] });
      }
      summary.flow.push(step);
      summary.bracketMatches = shape.matches;
      summary.totals.push({ key: '%s მატჩი', args: [shape.matches] });
    }
    return summary;
  }

  // A group stage.
  const count = format === 'groups_playoffs' ? (structure.groups?.count ?? 2) : 1;
  const rounds = structure.groups?.rounds ?? 1;
  const sizes = groupSizes(entrants, count);
  summary.groupMatches = sizes.reduce((sum, size) => sum + roundRobinMatches(size, rounds), 0);

  if (format !== 'groups_playoffs') {
    summary.flow.push([
      { key: rounds === 2 ? 'ერთი ცხრილი — ყველა ყველასთან, ორ წრედ' : 'ერთი ცხრილი — ყველა ყველასთან' },
    ]);
    summary.totals.push({ key: '%s მატჩი', args: [summary.groupMatches] });
    return summary;
  }

  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  summary.flow.push([
    min === max
      ? { key: '%s ჯგუფი × %s', args: [count, max] }
      : { key: '%s ჯგუფი × %s–%s', args: [count, min, max] },
  ]);
  const advancement = structure.groups?.advancement ?? [];
  const q = qualifierCount(sizes, advancement, structure.groups?.wildcards ?? 0);
  summary.qualifiers = q;
  const advance: SummaryPart[] = [];
  if (q.direct) advance.push({ key: '%s პირდაპირ', args: [q.direct] });
  if (q.playoff) advance.push({ key: '%s საკვალიფიკაციოში', args: [q.playoff] });
  if (q.wildcards) advance.push({ key: '%s საუკეთესო შემდეგი ადგილიდან', args: [q.wildcards] });
  if (advance.length) summary.flow.push(advance);

  const shape = bracketShape(q.total, !!structure.knockout?.thirdPlace, advancement.includes('playoff'));
  summary.bracket = shape;
  summary.totals.push({ key: '%s მატჩი ჯგუფებში', args: [summary.groupMatches] });
  if (shape) {
    summary.flow.push([{ key: '%s', args: [{ t: ROUND_FULL_KEYS[shape.mainRound] }] }]);
    summary.bracketMatches = shape.matches;
    summary.totals.push({ key: '%s ბადეში', args: [shape.matches] });
  }
  return summary;
}


/** "12 წყვილი → 4 ჯგუფი × 3 → 4 პირდაპირ + 8 საკვალიფიკაციოში → 1/4 ფინალი · 12 მატჩი ჯგუფებში + 11 ბადეში". */
export function renderSummary(summary: StructureSummary): string {
  const flow = summary.flow.map((step) => step.map(renderMsg).join(' + ')).join(' → ');
  const totals = summary.totals.map(renderMsg).join(' + ');
  return totals ? `${flow} · ${totals}` : flow;
}

/** Positions the advancement editor offers: up to the largest group (1…8). */
export function advancementPositions(entrants: number, groupCount: number, current: number): number {
  const largest = Math.max(0, ...groupSizes(entrants, Math.max(1, groupCount)));
  return Math.min(GROUP_POSITIONS_MAX, Math.max(1, largest || current || 2));
}
