/**
 * Tournament vocabulary (RAW Georgian behind `liveLabels`, translated on every
 * read) and the EVENT grouping of the operator list (docs/33 §2.5): sibling
 * tournaments sharing `event.id` are the categories of one event.
 */
import { isEnglish, liveLabels, tr } from '../../shared/i18n/lang';
import {
  Tournament,
  TournamentCategory,
  TournamentFormat,
  TournamentLevel,
  TournamentStatus,
  TournamentType,
} from '../../shared/models/tournament.model';

export const TYPE_LABELS: Record<TournamentType, string> = liveLabels({
  singles: 'სინგლები',
  doubles: 'წყვილები',
});
export const FORMAT_LABELS: Record<TournamentFormat, string> = liveLabels({
  knockout: 'ნოკაუტი',
  round_robin: 'წრიული',
  groups_playoffs: 'ჯგუფები + პლეიოფი',
  championship: 'ჩემპიონატი',
  americano: 'ამერიკანო',
  mexicano: 'მექსიკანო',
});
export const LEVEL_LABELS: Record<TournamentLevel, string> = liveLabels({
  any: 'ნებისმიერი',
  beginner: 'დამწყები',
  intermediate: 'საშუალო',
  advanced: 'გამოცდილი',
});
export const CATEGORY_LABELS: Record<TournamentCategory, string> = liveLabels({
  men: 'კაცები',
  women: 'ქალები',
  mixed: 'შერეული',
});

export const STATUS_LABELS: Record<TournamentStatus, string> = liveLabels({
  draft: 'დრაფტი',
  published: 'გამოქვეყნებული',
  completed: 'დასრულებული',
  cancelled: 'გაუქმებული',
});

/** Theme-aware ss-badge variants per status. */
export const STATUS_CLASSES: Record<TournamentStatus, string> = {
  draft: 'ss-badge ss-badge--neutral',
  published: 'ss-badge ss-badge--positive',
  completed: 'ss-badge ss-badge--info',
  cancelled: 'ss-badge ss-badge--negative',
};

/**
 * A category's display name inside its event: the operator's label (English
 * one in an English session), else "კაცები · საშუალო" from category + level.
 */
export function categoryLabel(
  t: Pick<Tournament, 'event' | 'category' | 'level'>,
): string {
  const label = (isEnglish() && t.event?.labelEn) || t.event?.label;
  if (label) return label;
  const parts = [CATEGORY_LABELS[t.category] ?? t.category];
  if (t.level && t.level !== 'any') parts.push(LEVEL_LABELS[t.level] ?? t.level);
  return parts.join(' · ');
}

/** One row of the operator list: a plain tournament, or an event with its categories. */
export type TournamentBlock =
  | { kind: 'single'; key: string; tournament: Tournament }
  | { kind: 'event'; key: string; head: Tournament; categories: Tournament[] };

/**
 * Groups the list by `event.id`, keeping the list's order (the API sorts
 * siblings together: they share the start). Categories follow `event.order`.
 */
export function groupTournaments(list: Tournament[]): TournamentBlock[] {
  const blocks: TournamentBlock[] = [];
  const events = new Map<string, Extract<TournamentBlock, { kind: 'event' }>>();
  for (const tournament of list) {
    const eventId = tournament.event?.id;
    if (!eventId) {
      blocks.push({ kind: 'single', key: tournament._id, tournament });
      continue;
    }
    let block = events.get(eventId);
    if (!block) {
      block = { kind: 'event', key: `event:${eventId}`, head: tournament, categories: [] };
      events.set(eventId, block);
      blocks.push(block);
    }
    block.categories.push(tournament);
  }
  for (const block of events.values()) {
    block.categories.sort((a, b) => (a.event?.order ?? 0) - (b.event?.order ?? 0));
    block.head = block.categories[0];
  }
  return blocks;
}

/** "კაცები A · ნოკაუტი" — the console header subtitle / dialog labels. */
export function tournamentTitle(t: Tournament, name: string): string {
  return t.event ? `${name} · ${categoryLabel(t)}` : name;
}

/** Live "უფასო" / "25 ₾". */
export function feeLabel(entryFeeTetri: number): string {
  return entryFeeTetri === 0 ? tr('უფასო') : `${(Number(entryFeeTetri) || 0) / 100} ₾`;
}
