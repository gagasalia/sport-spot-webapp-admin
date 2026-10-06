/**
 * Display helpers for the draw view (docs/33 §5): round names, placeholders
 * ("A1", "W1", "გამარჯვებული · 1/4 №2"), side names, scores and the
 * stage / round label of a match. Labels are RAW Georgian behind
 * `liveLabels` or translated with `tr()` at call time — never baked.
 */
import { liveLabels, tr } from '../../../shared/i18n/lang';
import {
  EntrantView,
  KnockoutRoundView,
  MATCH_KIND_THIRD_PLACE,
  MatchOutcome,
  MatchScore,
  MatchView,
  SideSource,
  StandingZone,
} from '../../../shared/models/tournament-engine.model';
import { isoToWallClock, shortDay } from './schedule.util';

/** Bracket column headers (API round key → RAW Georgian). */
export const ROUND_LABELS: Record<string, string> = liveLabels({
  playin: 'საკვალიფიკაციო',
  r64: '1/32',
  r32: '1/16',
  r16: '1/8',
  quarter: '1/4',
  semi: 'ნახევარფინალი',
  final: 'ფინალი',
});

export const ZONE_LABELS: Record<StandingZone, string> = liveLabels({
  direct: 'პირდაპირ ბადეში',
  playoff: 'საკვალიფიკაციოში',
  wildcard: 'დამატებითი ადგილი',
  out: 'გავარდა',
});

export const OUTCOME_LABELS: Record<MatchOutcome, string> = liveLabels({
  played: 'ნათამაშები',
  walkover: 'ტექნიკური მოგება',
  retired: 'თამაშიდან მოხსნა',
});

/** The live name of a bracket round by its number ("1/4", "ფინალი"). */
export function roundLabel(round: number, rounds: KnockoutRoundView[]): string {
  const name = rounds.find((r) => r.round === round)?.name;
  return name ? (ROUND_LABELS[name] ?? name) : String(round);
}

/** "A1", "W1", "გამარჯვებული · 1/4 №2", "დამარცხებული · ნახევარფინალი №1". */
export function placeholderLabel(source: SideSource | undefined, rounds: KnockoutRoundView[]): string {
  if (!source) return '—';
  if (source.type === 'group') return `${source.group ?? ''}${source.position ?? ''}`;
  if (source.type === 'wildcard') return `W${source.rank ?? ''}`;
  if (source.type === 'winner' || source.type === 'loser') {
    const who = tr(source.type === 'winner' ? 'გამარჯვებული' : 'დამარცხებული');
    return `${who} · ${roundLabel(source.round ?? 0, rounds)} №${(source.order ?? 0) + 1}`;
  }
  return '—';
}

/** One side as names (a pair "ნინო / ლუკა"; individual americano "ა / ბ"). */
export function sideNames(
  match: MatchView,
  side: number,
  entrants: ReadonlyMap<string, EntrantView>,
  rounds: KnockoutRoundView[] = [],
): string {
  const view = match.sides[side];
  if (!view) return '—';
  if (view.entrants.length) {
    return view.entrants.map((id) => entrants.get(id)?.name ?? '—').join(' / ');
  }
  return placeholderLabel(view.placeholder, rounds);
}

/** The side is still a placeholder (no entrant known yet). */
export function isPlaceholderSide(match: MatchView, side: number): boolean {
  return !match.sides[side]?.entrants.length;
}

/** Both sides are known — a result can be entered. */
export function isPlayable(match: MatchView): boolean {
  return match.sides.length === 2 && match.sides.every((s) => s.entrants.length > 0);
}

/** One side's numbers: sets "6 3 10", points "16". */
export function sideScore(score: MatchScore | undefined, side: number): string[] {
  if (!score) return [];
  if (score.type === 'points') {
    const value = score.points?.[side];
    return value === undefined ? [] : [String(value)];
  }
  return (score.sets ?? []).map((set) => String(set[side] ?? ''));
}

/** "6-4 3-6 10-8" / "16:8" — the first side's number first. */
export function scoreLabel(score: MatchScore | undefined): string {
  if (!score) return '';
  if (score.type === 'points') {
    const [a, b] = score.points ?? [];
    return `${a ?? '–'}:${b ?? '–'}`;
  }
  return (score.sets ?? []).map(([a, b]) => `${a}-${b}`).join(' ');
}

/** "ჯგუფი A · ტური 2", "1/4", "მესამე ადგილი", "რაუნდი 3". */
export function matchStageLabel(match: MatchView, rounds: KnockoutRoundView[]): string {
  if (match.stage === 'group') {
    return `${tr('ჯგუფი')} ${match.group ?? ''} · ${tr('ტური')} ${match.round}`;
  }
  if (match.stage === 'social') {
    return `${tr('რაუნდი')} ${match.round}`;
  }
  if (match.kind === MATCH_KIND_THIRD_PLACE) {
    return tr('მესამე ადგილი');
  }
  return roundLabel(match.round, rounds);
}

/** "18.10 · 14:30" in the facility's wall clock; '' when unscheduled. */
export function matchTimeLabel(match: MatchView): string {
  if (!match.scheduledAt) return '';
  const { date, time } = isoToWallClock(match.scheduledAt);
  return `${shortDay(date)} · ${time}`;
}

/** Entrants by id, for O(1) name lookups in templates. */
export function entrantMap(entrants: EntrantView[]): Map<string, EntrantView> {
  return new Map(entrants.map((e) => [e.id, e]));
}
