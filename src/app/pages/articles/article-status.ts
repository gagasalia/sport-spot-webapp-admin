import { liveLabels, tr } from '../../shared/i18n/lang';
import { ArticleStatus } from '../../shared/models/article.model';
import { SsConfirmData } from '../../shared/ui/confirm.component';

/**
 * Editor status-bar button of each move — keyed by the TARGET status (RAW
 * Georgian behind `liveLabels`, so a language flip re-renders them).
 */
export const ARTICLE_ACTION_LABELS: Record<ArticleStatus, string> = liveLabels({
  ready: 'მზადაა გამოსაქვეყნებლად',
  published: 'გამოქვეყნება ახლა',
  scheduled: 'დაგეგმვა',
  archived: 'არქივი',
  draft: 'დრაფტში დაბრუნება',
});

/** The list's per-row quick moves, in button order. */
export const ARTICLE_QUICK_ACTIONS: readonly ArticleStatus[] = [
  'published',
  'scheduled',
  'ready',
  'archived',
];

/** Shorter labels for the list rows («მზადაა» alone is the status badge's word). */
export const ARTICLE_QUICK_ACTION_LABELS: Record<ArticleStatus, string> = liveLabels({
  ready: 'მზადად მონიშვნა',
  published: 'გამოქვეყნება ახლა',
  scheduled: 'დაგეგმვა',
  archived: 'არქივი',
  draft: 'დრაფტში დაბრუნება',
});

export interface ArticleStatusConfirm {
  label: string;
  data: SsConfirmData;
}

/**
 * The confirmation of a move that changes what players see (publish,
 * archive) or that the list fires without opening the article (ready).
 * Scheduling has its own dialog; back-to-draft is harmless and never asks.
 */
export function articleStatusConfirm(
  target: ArticleStatus,
  title: string,
): ArticleStatusConfirm | null {
  const quoted = `„${title}“`;
  switch (target) {
    case 'published':
      return {
        label: tr('სტატიის გამოქვეყნება'),
        data: {
          content: `${tr('სტატია ახლავე გამოჩნდება საიტზე')}: ${quoted}`,
          yes: tr('გამოქვეყნება'),
          no: tr('გაუქმება'),
        },
      };
    case 'archived':
      return {
        label: tr('არქივში გადატანა'),
        data: {
          content: `${tr('სტატია საიტიდან მოიხსნება')}: ${quoted}`,
          yes: tr('არქივში გადატანა'),
          no: tr('გაუქმება'),
          appearance: 'destructive',
        },
      };
    case 'ready':
      return {
        label: tr('მზადაა გამოსაქვეყნებლად'),
        data: {
          content: `${tr('სტატია მოინიშნება, როგორც მზად გამოსაქვეყნებლად')}: ${quoted}`,
          yes: tr('დიახ'),
          no: tr('გაუქმება'),
        },
      };
    default:
      return null;
  }
}

/** Success toast of a completed move. */
export function articleStatusSuccess(target: ArticleStatus): string {
  switch (target) {
    case 'published':
      return tr('გამოქვეყნდა');
    case 'scheduled':
      return tr('დაიგეგმა');
    case 'archived':
      return tr('არქივში გადავიდა');
    default:
      return tr('სტატუსი შეიცვალა');
  }
}
