import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../shared/i18n/t.pipe';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../shared/ui/dialog.service';
import {
  CONTACT_STATUS_CLASSES,
  CONTACT_STATUS_LABELS,
  CONTACT_TOPIC_LABELS,
  ContactMessage,
} from '../../shared/models/contact-message.model';

/** What the reader decided to do with the message; dismissal = nothing. */
export type ContactMessageAction = 'unread' | 'archive' | 'unarchive' | 'delete';

/** Payload for {@link ContactMessageDialogComponent}. */
export interface ContactMessageDialogData {
  message: ContactMessage;
}

/**
 * The inbox's reading pane (docs/38): every fact of one message with tap-to-
 * call / tap-to-mail links, plus the triage actions. The dialog only EMITS
 * the chosen action — the list page performs it, so the row, the badge and
 * the toast all update in one place.
 */
@Component({
  selector: 'app-contact-message-dialog',
  standalone: true,
  imports: [DatePipe, RouterLink, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4" data-testid="contact-message-dialog">
      <div class="flex flex-wrap items-center gap-2">
        <span class="georgian-text" lang="ka" [class]="statusClass">{{ statusLabel }}</span>
        <span class="ss-badge ss-badge--neutral georgian-text" lang="ka">{{ topicLabel }}</span>
        <span class="text-xs" style="color: var(--tui-text-secondary)">
          {{ m.createdAt | date: 'dd.MM.yyyy HH:mm' }}
        </span>
      </div>

      <div class="cm-facts">
        <div class="cm-fact">
          <span class="ss-label georgian-text" lang="ka">{{ 'გამგზავნი' | t }}</span>
          <span class="font-medium georgian-text" lang="ka" data-testid="cm-name">{{ m.name }}</span>
        </div>
        @if (m.phone) {
          <div class="cm-fact">
            <span class="ss-label georgian-text" lang="ka">{{ 'ტელეფონი' | t }}</span>
            <a class="cm-link" [href]="'tel:' + m.phone" data-testid="cm-phone">{{ m.phone }}</a>
          </div>
        }
        @if (m.email) {
          <div class="cm-fact">
            <span class="ss-label georgian-text" lang="ka">{{ 'ელ. ფოსტა' | t }}</span>
            <a class="cm-link" [href]="'mailto:' + m.email" data-testid="cm-email">{{ m.email }}</a>
          </div>
        }
        @if (m.user) {
          <div class="cm-fact">
            <span class="ss-label georgian-text" lang="ka">{{ 'ანგარიში' | t }}</span>
            <a
              class="cm-link georgian-text"
              lang="ka"
              [routerLink]="['/customers', m.user]"
              (click)="context.dismiss()"
              data-testid="cm-user"
            >
              {{ 'მომხმარებლის გვერდი' | t }}
            </a>
          </div>
        }
        @if (m.subject) {
          <div class="cm-fact">
            <span class="ss-label georgian-text" lang="ka">{{ 'თემა' | t }}</span>
            <span class="georgian-text" lang="ka">{{ m.subject }}</span>
          </div>
        }
      </div>

      <div class="cm-body georgian-text" lang="ka" data-testid="cm-body">{{ m.message }}</div>

      <div class="text-xs" style="color: var(--tui-text-tertiary)">
        {{ m.lang === 'en' ? 'EN' : 'KA' }}
        @if (m.page) {
          · {{ m.page }}
        }
        @if (m.readAt) {
          · <span class="georgian-text" lang="ka">{{ 'წაკითხული' | t }}</span>
          {{ m.readAt | date: 'dd.MM.yyyy HH:mm' }}
        }
      </div>

      <div class="flex flex-wrap justify-end gap-2">
        @if (m.status !== 'new') {
          <button
            class="ss-btn ss-btn--outline ss-btn--s"
            type="button"
            (click)="context.completeWith('unread')"
            data-testid="cm-unread"
          >
            <span class="georgian-text" lang="ka">{{ 'წაუკითხავად მონიშვნა' | t }}</span>
          </button>
        }
        @if (m.status === 'archived') {
          <button
            class="ss-btn ss-btn--outline ss-btn--s"
            type="button"
            (click)="context.completeWith('unarchive')"
            data-testid="cm-unarchive"
          >
            <span class="georgian-text" lang="ka">{{ 'არქივიდან დაბრუნება' | t }}</span>
          </button>
        } @else {
          <button
            class="ss-btn ss-btn--outline ss-btn--s"
            type="button"
            (click)="context.completeWith('archive')"
            data-testid="cm-archive"
          >
            <span class="georgian-text" lang="ka">{{ 'დაარქივება' | t }}</span>
          </button>
        }
        <button
          class="ss-btn ss-btn--danger ss-btn--s"
          type="button"
          (click)="context.completeWith('delete')"
          data-testid="cm-delete"
        >
          <span class="georgian-text" lang="ka">{{ 'წაშლა' | t }}</span>
        </button>
        <button class="ss-btn ss-btn--primary ss-btn--s" type="button" (click)="context.dismiss()">
          <span class="georgian-text" lang="ka">{{ 'დახურვა' | t }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .cm-facts {
        display: grid;
        gap: 10px 18px;
        grid-template-columns: 1fr;
      }
      @media (min-width: 640px) {
        .cm-facts {
          grid-template-columns: 1fr 1fr;
        }
      }
      .cm-fact {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .cm-fact > * {
        overflow-wrap: anywhere;
      }
      .cm-link {
        color: var(--tui-text-action);
        text-decoration: none;
      }
      .cm-link:hover {
        text-decoration: underline;
      }
      .cm-body {
        padding: 14px 16px;
        border-radius: var(--r-md, 10px);
        background: var(--tui-background-neutral-1);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        line-height: 1.6;
      }
    `,
  ],
})
export class ContactMessageDialogComponent {
  protected readonly context = inject(SS_DIALOG_CONTEXT) as SsDialogContext<
    ContactMessageAction,
    ContactMessageDialogData
  >;

  protected readonly m: ContactMessage = this.context.data?.message ?? ({} as ContactMessage);

  protected get statusLabel(): string {
    return CONTACT_STATUS_LABELS[this.m.status] ?? this.m.status;
  }

  protected get statusClass(): string {
    return CONTACT_STATUS_CLASSES[this.m.status] ?? CONTACT_STATUS_CLASSES.read;
  }

  protected get topicLabel(): string {
    return CONTACT_TOPIC_LABELS[this.m.topic] ?? this.m.topic;
  }
}
