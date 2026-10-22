import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, filter, switchMap, take } from 'rxjs';
import { ContactMessageService } from '../../services/http-services/contact-message.service';
import {
  CONTACT_STATUSES,
  CONTACT_STATUS_CLASSES,
  CONTACT_STATUS_LABELS,
  CONTACT_TOPICS,
  CONTACT_TOPIC_LABELS,
  ContactMessage,
  ContactMessageStatus,
  ContactTopic,
} from '../../shared/models/contact-message.model';
import { tr } from '../../shared/i18n/lang';
import { TPipe } from '../../shared/i18n/t.pipe';
import { SsToastService } from '../../shared/ui/toast.service';
import { SsDialogService } from '../../shared/ui/dialog.service';
import { SsConfirmComponent, SsConfirmData } from '../../shared/ui/confirm.component';
import {
  ContactMessageAction,
  ContactMessageDialogComponent,
  ContactMessageDialogData,
} from './contact-message-dialog.component';

const PAGE_SIZE = 20;
const PREVIEW_CHARS = 90;

/**
 * შეტყობინებები — the superadmin inbox (docs/38): every message the player
 * site's `/contact` form sent, newest first, with status tabs (new / read /
 * archived / all), a topic filter and a search. A row opens the reading
 * dialog (which marks a new message read); archive / unarchive / delete
 * act from the dialog or from the row's own controls.
 */
@Component({
  selector: 'app-contact-messages',
  standalone: true,
  imports: [DatePipe, FormsModule, TPipe],
  templateUrl: './contact-messages.component.html',
  styleUrl: './contact-messages.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactMessagesComponent implements OnInit {
  private readonly inbox = inject(ContactMessageService);
  private readonly dialogs = inject(SsDialogService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusOptions = CONTACT_STATUSES;
  protected readonly topicOptions = CONTACT_TOPICS;
  /** The shell badge's number, shown beside the title too. */
  protected readonly unread = this.inbox.unread;

  // filters ('' = any)
  protected readonly q = signal('');
  protected readonly statusFilter = signal<ContactMessageStatus | ''>('');
  protected readonly topicFilter = signal<ContactTopic | ''>('');

  // list state
  protected readonly rows = signal<ContactMessage[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly limit = PAGE_SIZE;
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.limit)),
  );
  protected readonly isMobile = signal(window.innerWidth <= 768);

  /** Drops stale responses when the user types faster than the API answers. */
  private requestSeq = 0;
  private readonly search$ = new Subject<void>();

  @HostListener('window:resize')
  protected onResize(): void {
    this.isMobile.set(window.innerWidth <= 768);
  }

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadFromFirstPage());
    this.load();
    this.refreshUnread();
  }

  // ── filters ────────────────────────────────────────────────────────────────

  protected onSearchChange(value: string): void {
    this.q.set(value);
    this.search$.next();
  }

  protected onStatusFilterChange(status: ContactMessageStatus | ''): void {
    if (status === this.statusFilter()) return;
    this.statusFilter.set(status);
    this.reloadFromFirstPage();
  }

  protected onTopicFilterChange(topic: ContactTopic | ''): void {
    this.topicFilter.set(topic);
    this.reloadFromFirstPage();
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  private reloadFromFirstPage(): void {
    this.page.set(1);
    this.load();
  }

  private load(): void {
    const seq = ++this.requestSeq;
    this.isLoading.set(true);
    this.hasError.set(false);
    this.inbox
      .getMessages({
        page: this.page(),
        limit: this.limit,
        status: this.statusFilter() || undefined,
        topic: this.topicFilter() || undefined,
        q: this.q().trim() || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: ({ data, page }) => {
          if (seq !== this.requestSeq) return;
          this.rows.set(data);
          this.total.set(page?.total ?? data.length);
          this.isLoading.set(false);
        },
        error: () => {
          if (seq !== this.requestSeq) return;
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  private refreshUnread(): void {
    this.inbox
      .refreshUnread()
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  // ── reading ────────────────────────────────────────────────────────────────

  /**
   * Row click / Enter opens the reading dialog — unless the event started on
   * one of the row's own controls (archive, delete), which act in place.
   */
  protected onRowActivate(event: Event, m: ContactMessage): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, select, a, input')) return;
    this.openMessage(m);
  }

  /**
   * Fetches the fresh row (the API marks a NEW message read on this read),
   * patches the list and the badge, then opens the dialog; the dialog's
   * action, if any, is performed here.
   */
  protected openMessage(m: ContactMessage): void {
    this.inbox
      .getMessage(m._id)
      .pipe(take(1))
      .subscribe({
        next: (fresh) => {
          this.patchRow(fresh._id, fresh);
          if (m.status === 'new') this.refreshUnread();
          this.dialogs
            .open<ContactMessageAction>(ContactMessageDialogComponent, {
              label: fresh.subject || tr('შეტყობინება'),
              size: 'm',
              data: { message: fresh } as ContactMessageDialogData,
            })
            .pipe(take(1), takeUntilDestroyed(this.destroyRef))
            .subscribe((action) => this.onDialogAction(fresh, action));
        },
        error: () => {
          this.alerts
            .open(tr('მონაცემების ჩატვირთვა ვერ მოხერხდა. სცადეთ თავიდან.'), {
              appearance: 'error',
            })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  private onDialogAction(m: ContactMessage, action: ContactMessageAction | undefined): void {
    switch (action) {
      case 'unread':
        this.setStatus(m, 'new');
        return;
      case 'archive':
        this.setStatus(m, 'archived');
        return;
      case 'unarchive':
        this.setStatus(m, 'read');
        return;
      case 'delete':
        this.deleteMessage(m);
        return;
      default:
        return;
    }
  }

  // ── status + delete ────────────────────────────────────────────────────────

  /** Optimistic switch: the badge updates at once and reverts on error. */
  protected setStatus(m: ContactMessage, status: ContactMessageStatus): void {
    if (!status || m.status === status) return;
    const previous = m.status;
    this.patchRow(m._id, { status });
    this.inbox
      .setStatus(m._id, status)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.patchRow(updated._id, updated);
          this.refreshUnread();
          this.alerts.open(tr('შეინახა'), { appearance: 'success' }).pipe(take(1)).subscribe();
        },
        error: () => {
          this.patchRow(m._id, { status: previous });
          this.alerts
            .open(tr('შენახვა ვერ მოხერხდა, სცადეთ თავიდან'), { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  /** Archive from the row (or un-archive when the row is already archived). */
  protected toggleArchive(m: ContactMessage): void {
    this.setStatus(m, m.status === 'archived' ? 'read' : 'archived');
  }

  protected deleteMessage(m: ContactMessage): void {
    this.dialogs
      .open<boolean>(SsConfirmComponent, {
        label: tr('შეტყობინების წაშლა'),
        size: 's',
        data: {
          content: `${tr('ნამდვილად წავშალოთ ეს შეტყობინება?')} — ${m.name}`,
          yes: tr('წაშლა'),
          no: tr('გაუქმება'),
          appearance: 'destructive',
        } as SsConfirmData,
      })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => this.inbox.deleteMessage(m._id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.load();
          this.refreshUnread();
          this.alerts.open(tr('წაიშალა'), { appearance: 'success' }).pipe(take(1)).subscribe();
        },
        error: () => {
          this.alerts
            .open(tr('წაშლა ვერ მოხერხდა, სცადეთ თავიდან'), { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  private patchRow(id: string, patch: Partial<ContactMessage>): void {
    this.rows.update((list) => list.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  }

  // ── display helpers ────────────────────────────────────────────────────────

  protected statusLabel(status: ContactMessageStatus): string {
    return CONTACT_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: ContactMessageStatus): string {
    return CONTACT_STATUS_CLASSES[status] ?? CONTACT_STATUS_CLASSES.read;
  }

  protected topicLabel(topic: ContactTopic): string {
    return CONTACT_TOPIC_LABELS[topic] ?? topic;
  }

  /** 'phone · email' — whichever the sender gave. */
  protected channels(m: ContactMessage): string {
    return [m.phone, m.email].filter(Boolean).join(' · ');
  }

  /** The first line-ish of the message, trimmed to one row. */
  protected preview(m: ContactMessage): string {
    const text = (m.subject ? `${m.subject} — ` : '') + m.message.replace(/\s+/g, ' ').trim();
    return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS - 1)}…` : text;
  }
}
