import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import {
  ContactMessage,
  ContactMessageListQuery,
  ContactMessageStatus,
} from '../../shared/models/contact-message.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';

export interface PaginatedContactMessages {
  data: ContactMessage[];
  page?: ApiPage;
}

/**
 * Superadmin contact-inbox API (`/contact-messages`, docs/38). Every payload
 * is the standard envelope. `unread` is the shell badge's number: refreshed
 * on navigation by the shell and after every status change by the inbox
 * page, so the count never lags what the operator just did. Mutations opt
 * out of the interceptor's generic error toast — the inbox shows its own.
 */
@Injectable({ providedIn: 'root' })
export class ContactMessageService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/contact-messages`;

  /** Unread (`new`) messages — the nav badge. */
  readonly unread = signal(0);

  /** GET /contact-messages — newest first; unset and empty filters are left out. */
  getMessages(query: ContactMessageListQuery): Observable<PaginatedContactMessages> {
    let params = new HttpParams().set('page', query.page).set('limit', query.limit);
    for (const key of ['status', 'topic', 'q'] as const) {
      const value = query[key];
      if (value !== undefined && value !== '') {
        params = params.set(key, value);
      }
    }
    return this.http
      .get<ApiResponse<ContactMessage[]>>(this.apiUrl, { params })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }

  /** GET /contact-messages/unread-count → updates `unread`, emits the number. */
  refreshUnread(): Observable<number> {
    return this.http
      .get<ApiResponse<{ count: number }>>(`${this.apiUrl}/unread-count`, {
        context: this.quiet(),
      })
      .pipe(
        map((res) => res.result.data?.count ?? 0),
        tap((count) => this.unread.set(count)),
      );
  }

  /** GET /contact-messages/:id — the API marks a NEW message read. */
  getMessage(id: string): Observable<ContactMessage> {
    return this.http
      .get<ApiResponse<ContactMessage>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => res.result.data));
  }

  /** PATCH /contact-messages/:id/status { status } */
  setStatus(id: string, status: ContactMessageStatus): Observable<ContactMessage> {
    return this.http
      .patch<ApiResponse<ContactMessage>>(
        `${this.apiUrl}/${id}/status`,
        { status },
        { context: this.quiet() },
      )
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /contact-messages/:id — the response body is ignored. */
  deleteMessage(id: string): Observable<void> {
    return this.http
      .delete<unknown>(`${this.apiUrl}/${id}`, { context: this.quiet() })
      .pipe(map(() => undefined));
  }

  private quiet(): HttpContext {
    return new HttpContext().set(SKIP_ERROR_TOAST, true);
  }
}
