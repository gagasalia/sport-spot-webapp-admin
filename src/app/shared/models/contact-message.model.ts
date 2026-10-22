/**
 * Contact inbox (docs/38): messages the player site's `/contact` form sends,
 * triaged by superadmins. Read-only facts come from the API as stored; the
 * only writes are the status (new / read / archived) and delete.
 */

import { liveLabels } from '../i18n/lang';

export type ContactTopic = 'general' | 'booking' | 'partnership' | 'bug' | 'other';
export type ContactMessageStatus = 'new' | 'read' | 'archived';

/** A message as returned by `GET /contact-messages` and `GET /contact-messages/:id`. */
export interface ContactMessage {
  _id: string;
  name: string;
  /** E.164; absent when the sender gave an email only. */
  phone?: string;
  email?: string;
  topic: ContactTopic;
  subject?: string;
  message: string;
  status: ContactMessageStatus;
  /** The sender's interface language at submit time. */
  lang: 'ka' | 'en';
  /** Path of the page the form was on ('/contact'). */
  page?: string;
  /** The signed-in sender's account id, when the submit carried a token. */
  user?: string | null;
  /** First time a superadmin opened it. */
  readAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Query of `GET /contact-messages`; undefined keys are left out of the URL. */
export interface ContactMessageListQuery {
  page: number;
  limit: number;
  status?: ContactMessageStatus;
  topic?: ContactTopic;
  q?: string;
}

// ── labels + badge classes ──────────────────────────────────────────────────
// Values stay RAW Georgian — `liveLabels` translates on every read, so a
// language flip re-renders instead of going stale (i18n rule: never bake).

export const CONTACT_STATUS_LABELS: Record<ContactMessageStatus, string> = liveLabels({
  new: 'ახალი',
  read: 'წაკითხული',
  archived: 'დაარქივებული',
});

export const CONTACT_STATUS_CLASSES: Record<ContactMessageStatus, string> = {
  new: 'ss-badge ss-badge--accent',
  read: 'ss-badge ss-badge--neutral',
  archived: 'ss-badge ss-badge--info',
};

export const CONTACT_TOPIC_LABELS: Record<ContactTopic, string> = liveLabels({
  general: 'ზოგადი კითხვა',
  booking: 'ჯავშანი',
  partnership: 'პარტნიორობა',
  bug: 'შეცდომა აპლიკაციაში',
  other: 'სხვა თემა',
});

export const CONTACT_STATUSES = Object.keys(CONTACT_STATUS_LABELS) as ContactMessageStatus[];
export const CONTACT_TOPICS = Object.keys(CONTACT_TOPIC_LABELS) as ContactTopic[];
