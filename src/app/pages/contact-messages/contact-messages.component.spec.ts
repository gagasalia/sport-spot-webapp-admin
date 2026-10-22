import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { of, throwError } from 'rxjs';

import { ContactMessagesComponent } from './contact-messages.component';
import { ContactMessageDialogComponent } from './contact-message-dialog.component';
import { TPipe } from '../../shared/i18n/t.pipe';
import { ContactMessageService } from '../../services/http-services/contact-message.service';
import {
  ContactMessage,
  ContactMessageListQuery,
} from '../../shared/models/contact-message.model';
import { SsToastService } from '../../shared/ui/toast.service';
import { SsDialogService } from '../../shared/ui/dialog.service';
import { SsConfirmComponent } from '../../shared/ui/confirm.component';

const fresh: ContactMessage = {
  _id: 'm-1',
  name: 'გიორგი',
  phone: '+995555123456',
  topic: 'booking',
  message: 'ჯავშანი არ ჩანს ჩემს გვერდზე, გთხოვთ შეამოწმოთ',
  status: 'new',
  lang: 'ka',
  createdAt: '2026-10-22T10:00:00.000Z',
};

const older: ContactMessage = {
  _id: 'm-2',
  name: 'Ann',
  email: 'ann@example.com',
  topic: 'partnership',
  subject: 'Club in Batumi',
  message: 'We would like to join the platform.',
  status: 'read',
  lang: 'en',
  readAt: '2026-10-21T09:00:00.000Z',
  createdAt: '2026-10-21T08:00:00.000Z',
};

describe('ContactMessagesComponent', () => {
  let component: ContactMessagesComponent;
  let fixture: ComponentFixture<ContactMessagesComponent>;
  let inboxSpy: jasmine.SpyObj<ContactMessageService> & { unread: ReturnType<typeof signal<number>> };
  let dialogSpy: jasmine.SpyObj<SsDialogService>;
  let alertSpy: jasmine.SpyObj<SsToastService>;

  const lastQuery = (): ContactMessageListQuery =>
    inboxSpy.getMessages.calls.mostRecent().args[0];

  beforeEach(async () => {
    inboxSpy = Object.assign(
      jasmine.createSpyObj<ContactMessageService>('ContactMessageService', [
        'getMessages',
        'getMessage',
        'setStatus',
        'deleteMessage',
        'refreshUnread',
      ]),
      { unread: signal(1) },
    );
    inboxSpy.getMessages.and.returnValue(
      of({ data: [fresh, older], page: { page: 1, size: 20, total: 41 } }),
    );
    inboxSpy.getMessage.and.returnValue(of({ ...fresh, status: 'read' }));
    inboxSpy.setStatus.and.callFake((id, status) =>
      of({ ...(id === fresh._id ? fresh : older), status }),
    );
    inboxSpy.deleteMessage.and.returnValue(of(undefined));
    inboxSpy.refreshUnread.and.returnValue(of(0));

    dialogSpy = jasmine.createSpyObj<SsDialogService>('SsDialogService', ['open']);
    dialogSpy.open.and.returnValue(of(undefined));
    alertSpy = jasmine.createSpyObj<SsToastService>('SsToastService', ['open']);
    alertSpy.open.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [ContactMessagesComponent],
      providers: [
        { provide: ContactMessageService, useValue: inboxSpy },
        { provide: SsDialogService, useValue: dialogSpy },
        { provide: SsToastService, useValue: alertSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(ContactMessagesComponent, {
        // set:{imports} REPLACES the array — TPipe must ride along or `| t` is
        // NG0302; the template renders `| date` too.
        set: { imports: [DatePipe, TPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ContactMessagesComponent);
    component = fixture.componentInstance;
    component['isMobile'].set(false);
    fixture.detectChanges();
  });

  it('loads page 1 without filters on init and refreshes the unread badge', () => {
    expect(inboxSpy.getMessages).toHaveBeenCalledTimes(1);
    expect(lastQuery()).toEqual({
      page: 1,
      limit: 20,
      status: undefined,
      topic: undefined,
      q: undefined,
    });
    expect(inboxSpy.refreshUnread).toHaveBeenCalled();
    expect(component['total']()).toBe(41);
  });

  it('renders one row per message: sender, channels, topic, preview, status; unread rows marked', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="message-row"]');
    expect(rows.length).toBe(2);
    const first = rows[0].textContent as string;
    expect(first).toContain('გიორგი');
    expect(first).toContain('+995555123456');
    expect(first).toContain('ჯავშანი არ ჩანს');
    expect(rows[0].classList).toContain('is-unread');
    expect(rows[1].classList).not.toContain('is-unread');
    const second = rows[1].textContent as string;
    expect(second).toContain('ann@example.com');
    // subject leads the preview
    expect(second).toContain('Club in Batumi — We would like');

    const badges = fixture.nativeElement.querySelectorAll('[data-testid="message-status"]');
    expect(badges[0].textContent.trim()).toBe('ახალი');
    expect(badges[0].className).toContain('ss-badge--accent');
    expect(badges[1].textContent.trim()).toBe('წაკითხული');
    expect(fixture.nativeElement.querySelector('[data-testid="inbox-unread"]')?.textContent.trim()).toBe(
      '1',
    );
  });

  it('the status tabs reload from page 1 with that status', () => {
    component['page'].set(3);
    (fixture.nativeElement.querySelector('[data-testid="inbox-tab-archived"]') as HTMLElement).click();
    expect(lastQuery().status).toBe('archived');
    expect(lastQuery().page).toBe(1);
    // the same tab again is a no-op
    const calls = inboxSpy.getMessages.calls.count();
    (fixture.nativeElement.querySelector('[data-testid="inbox-tab-archived"]') as HTMLElement).click();
    expect(inboxSpy.getMessages.calls.count()).toBe(calls);
  });

  it('typing a search debounces then reloads with q', fakeAsync(() => {
    component['onSearchChange']('ann');
    expect(inboxSpy.getMessages).toHaveBeenCalledTimes(1);
    tick(400);
    expect(inboxSpy.getMessages).toHaveBeenCalledTimes(2);
    expect(lastQuery().q).toBe('ann');
  }));

  it('a row click fetches the message (marking it read), patches the row, refreshes the badge and opens the dialog', () => {
    const calls = inboxSpy.refreshUnread.calls.count();
    (fixture.nativeElement.querySelector('[data-testid="message-row"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(inboxSpy.getMessage).toHaveBeenCalledWith('m-1');
    expect(inboxSpy.refreshUnread.calls.count()).toBe(calls + 1);
    expect(dialogSpy.open).toHaveBeenCalledWith(
      ContactMessageDialogComponent,
      jasmine.objectContaining({ data: { message: { ...fresh, status: 'read' } } }),
    );
    const badge = fixture.nativeElement.querySelector('[data-testid="message-status"]');
    expect(badge.textContent.trim()).toBe('წაკითხული');
  });

  it("the dialog's archive action PATCHes the status", () => {
    dialogSpy.open.and.returnValue(of('archive'));
    (fixture.nativeElement.querySelector('[data-testid="message-row"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(inboxSpy.setStatus).toHaveBeenCalledWith('m-1', 'archived');
    expect(fixture.nativeElement.querySelector('[data-testid="message-status"]').textContent.trim()).toBe(
      'დაარქივებული',
    );
  });

  it('the row archive button toggles archived ↔ read without opening the dialog', () => {
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="message-archive"]');
    (buttons[1] as HTMLElement).click();
    expect(inboxSpy.setStatus).toHaveBeenCalledWith('m-2', 'archived');
    expect(dialogSpy.open).not.toHaveBeenCalled();
    fixture.detectChanges();
    (fixture.nativeElement.querySelectorAll('[data-testid="message-archive"]')[1] as HTMLElement).click();
    expect(inboxSpy.setStatus).toHaveBeenCalledWith('m-2', 'read');
  });

  it('a failed status change reverts the badge and toasts', () => {
    inboxSpy.setStatus.and.returnValue(throwError(() => new Error('500')));
    (fixture.nativeElement.querySelector('[data-testid="message-archive"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="message-status"]').textContent.trim()).toBe(
      'ახალი',
    );
    expect(alertSpy.open).toHaveBeenCalledWith(
      jasmine.stringMatching(/შენახვა ვერ მოხერხდა/),
      jasmine.objectContaining({ appearance: 'error' }),
    );
  });

  it('delete asks for confirmation, then DELETEs and reloads', () => {
    dialogSpy.open.and.returnValue(of(true));
    (fixture.nativeElement.querySelector('[data-testid="message-delete"]') as HTMLElement).click();
    expect(dialogSpy.open).toHaveBeenCalledWith(
      SsConfirmComponent,
      jasmine.objectContaining({ size: 's' }),
    );
    expect(inboxSpy.deleteMessage).toHaveBeenCalledWith('m-1');
    expect(inboxSpy.getMessages).toHaveBeenCalledTimes(2);
  });

  it('a declined confirmation deletes nothing', () => {
    dialogSpy.open.and.returnValue(of(false));
    (fixture.nativeElement.querySelector('[data-testid="message-delete"]') as HTMLElement).click();
    expect(inboxSpy.deleteMessage).not.toHaveBeenCalled();
  });

  it('shows the error state with a retry when the list fails', () => {
    inboxSpy.getMessages.and.returnValue(throwError(() => new Error('500')));
    component['retry']();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('მონაცემების ჩატვირთვა ვერ მოხერხდა');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="message-row"]').length).toBe(0);
  });
});
