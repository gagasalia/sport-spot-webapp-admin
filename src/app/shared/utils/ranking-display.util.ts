import { liveLabels, tr } from '../i18n/lang';
import {
  GameScore,
  ParticipantKey,
  ScorecardDeltaView,
  ScorecardGameView,
  ScorecardParticipantView,
  ScorecardSource,
  ScorecardStatus,
  ScorecardView,
} from '../models/ranking.model';

/**
 * Display helpers shared by the ranking surfaces of the admin (tournament
 * results dialog, moderation list, customer rating card). Labels are RAW
 * Georgian behind live proxies — never a baked translation (docs/16 v2).
 */

/**
 * Tier names (docs/25 §2.8): the i18n keys `tier.1 … tier.7` resolve to these
 * WORKING Georgian names, which the gettext dictionary (en.ts) translates. A
 * rename touches this table and en.ts only — tiers are derived, never stored.
 */
export const TIER_KEYS: Readonly<Record<string, string>> = {
  'tier.1': 'ახალბედა',
  'tier.2': 'მოყვარული',
  'tier.3': 'პრეტენდენტი',
  'tier.4': 'კონკურენტი',
  'tier.5': 'ექსპერტი',
  'tier.6': 'მასტერი',
  'tier.7': 'ჩემპიონი',
};

/** Live-language tier name for 1..7; '' for anything else (calibrating). */
export function tierLabel(tier: number | null | undefined): string {
  const georgian = tier == null ? undefined : TIER_KEYS[`tier.${tier}`];
  return georgian ? tr(georgian) : '';
}

export const SCORECARD_STATUS_LABELS: Record<ScorecardStatus, string> = liveLabels({
  pending: 'დასადასტურებელი',
  confirmed: 'დადასტურებული',
  rejected: 'უარყოფილი',
  expired: 'ვადაგასული',
  void: 'ანულირებული',
});

export const SCORECARD_STATUS_CLASSES: Record<ScorecardStatus, string> = {
  pending: 'ss-badge ss-badge--warning',
  confirmed: 'ss-badge ss-badge--positive',
  rejected: 'ss-badge ss-badge--negative',
  expired: 'ss-badge ss-badge--muted',
  void: 'ss-badge ss-badge--neutral',
};

export const SCORECARD_SOURCE_LABELS: Record<ScorecardSource, string> = liveLabels({
  friendly: 'მეგობრული',
  open_match: 'ღია თამაში',
  tournament: 'ტურნირი',
});

export function participantOf(
  card: ScorecardView,
  key: ParticipantKey,
): ScorecardParticipantView | undefined {
  return card.participants.find((p) => p.key === key);
}

/** One team of one game as names: "ნინო + ლუკა". */
export function teamNames(card: ScorecardView, game: ScorecardGameView, side: 0 | 1): string {
  return (game.teams[side] ?? [])
    .map((key) => participantOf(card, key)?.name || key.toUpperCase())
    .join(' + ');
}

/** "6-1 6-1" for sets, "16:12" for points — the first team's number first. */
export function scoreLabel(score: GameScore): string {
  if (score.type === 'points') {
    const [a, b] = score.points ?? [];
    return `${a ?? '–'}:${b ?? '–'}`;
  }
  return (score.sets ?? []).map(([a, b]) => `${a}-${b}`).join(' ');
}

export function deltaOf(card: ScorecardView, key: ParticipantKey): ScorecardDeltaView | undefined {
  return card.deltas?.find((d) => d.key === key);
}

/** Signed whole-number delta: "+12", "−8" (true minus), "±0". */
export function formatDelta(delta: number): string {
  const rounded = Math.round(delta);
  if (rounded === 0) return '±0';
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
}

/** Badge colour of a delta: gains positive, losses negative, zero neutral. */
export function deltaClass(delta: number): string {
  const rounded = Math.round(delta);
  if (rounded > 0) return 'ss-badge ss-badge--positive';
  if (rounded < 0) return 'ss-badge ss-badge--negative';
  return 'ss-badge ss-badge--neutral';
}

/** "1500 → 1512" tooltip for a delta badge. */
export function deltaTitle(delta: ScorecardDeltaView): string {
  return `${Math.round(delta.ratingBefore)} → ${Math.round(delta.ratingAfter)}`;
}
