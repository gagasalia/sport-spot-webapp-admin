import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ContactMessageService } from './contact-message.service';
import { ContactMessage } from '../../shared/models/contact-message.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';
import { environment } from '../../../environments/environment';

function wrap<T>(data: T, page?: unknown) {
  return { result: { data, page }, errors: [] };
}

const base = `${environment.apiUrl}/contact-messages`;

const message: ContactMessage = {
  _id: 'm-1',
  name: 'გიორგი',
  phone: '+995555123456',
  topic: 'booking',
  message: 'ჯავშანი არ ჩანს ჩემს გვერდზე',
  status: 'new',
  lang: 'ka',
  createdAt: '2026-10-22T10:00:00.000Z',
};

describe('ContactMessageService', () => {
  let service: ContactMessageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ContactMessageService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContactMessageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getMessages GETs /contact-messages with the given filters and unwraps rows + page', () => {
    let emitted: { data: ContactMessage[]; page?: { total: number } } | undefined;
    service
      .getMessages({ page: 2, limit: 20, status: 'new', topic: 'bug', q: 'გიორგი' })
      .subscribe((res) => (emitted = res));

    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.get('status')).toBe('new');
    expect(req.request.params.get('topic')).toBe('bug');
    expect(req.request.params.get('q')).toBe('გიორგი');
    req.flush(wrap([message], { page: 2, size: 20, total: 41 }));

    expect(emitted?.data).toEqual([message]);
    expect(emitted?.page?.total).toBe(41);
  });

  it('getMessages leaves empty filters out of the URL', () => {
    service.getMessages({ page: 1, limit: 20, q: '' }).subscribe();
    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.params.keys().sort()).toEqual(['limit', 'page']);
    req.flush(wrap([]));
  });

  it('refreshUnread GETs the count quietly and updates the signal', () => {
    let count: number | undefined;
    service.refreshUnread().subscribe((c) => (count = c));
    const req = httpMock.expectOne(`${base}/unread-count`);
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap({ count: 4 }));
    expect(count).toBe(4);
    expect(service.unread()).toBe(4);
  });

  it('getMessage GETs /contact-messages/:id', () => {
    let emitted: ContactMessage | undefined;
    service.getMessage('m-1').subscribe((m) => (emitted = m));
    const req = httpMock.expectOne(`${base}/m-1`);
    expect(req.request.method).toBe('GET');
    req.flush(wrap({ ...message, status: 'read' }));
    expect(emitted?.status).toBe('read');
  });

  it('setStatus PATCHes /contact-messages/:id/status quietly', () => {
    let emitted: ContactMessage | undefined;
    service.setStatus('m-1', 'archived').subscribe((m) => (emitted = m));
    const req = httpMock.expectOne(`${base}/m-1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'archived' });
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap({ ...message, status: 'archived' }));
    expect(emitted?.status).toBe('archived');
  });

  it('deleteMessage DELETEs /contact-messages/:id quietly and emits void', () => {
    let done = false;
    service.deleteMessage('m-1').subscribe(() => (done = true));
    const req = httpMock.expectOne(`${base}/m-1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap(true));
    expect(done).toBeTrue();
  });
});
