import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import {
  CustomerBookingRow,
  CustomerDetail,
  CustomerModeration,
  CustomerProfile,
  CustomerRow,
  CustomersQuery,
  UpdateCustomerContactDto,
} from '../../shared/models/customer.model';

export interface PaginatedCustomers {
  data: CustomerRow[];
  page?: ApiPage;
}

export interface PaginatedCustomerBookings {
  data: CustomerBookingRow[];
  page?: ApiPage;
}

/**
 * /customers — operator customer management. The backend scopes everything by
 * role: a plain admin only sees (and moderates) players with bookings in
 * their own academy; a superadmin sees all and may pass academyId.
 */
@Injectable({
  providedIn: 'root',
})
export class CustomersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/customers`;

  list(query: CustomersQuery = {}): Observable<PaginatedCustomers> {
    let params = new HttpParams();
    for (const key of ['q', 'flag', 'academyId'] as const) {
      const value = query[key];
      if (value) params = params.set(key, value);
    }
    for (const key of ['page', 'limit'] as const) {
      const value = query[key];
      if (value != null) params = params.set(key, String(value));
    }
    return this.http
      .get<ApiResponse<CustomerRow[]>>(this.apiUrl, { params })
      .pipe(map((res) => ({ data: res.result.data, page: res.result.page })));
  }

  detail(id: string): Observable<CustomerDetail> {
    return this.http
      .get<ApiResponse<CustomerDetail>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => res.result.data));
  }

  bookings(
    id: string,
    page = 1,
    limit = 20,
  ): Observable<PaginatedCustomerBookings> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this.http
      .get<ApiResponse<CustomerBookingRow[]>>(`${this.apiUrl}/${id}/bookings`, {
        params,
      })
      .pipe(map((res) => ({ data: res.result.data, page: res.result.page })));
  }

  ban(id: string, reason: string): Observable<CustomerModeration> {
    return this.http
      .patch<ApiResponse<CustomerModeration>>(`${this.apiUrl}/${id}/ban`, {
        reason,
      })
      .pipe(map((res) => res.result.data));
  }

  unban(id: string): Observable<CustomerModeration> {
    return this.http
      .patch<ApiResponse<CustomerModeration>>(`${this.apiUrl}/${id}/unban`, {})
      .pipe(map((res) => res.result.data));
  }

  flag(id: string, reason: string): Observable<CustomerModeration> {
    return this.http
      .patch<ApiResponse<CustomerModeration>>(`${this.apiUrl}/${id}/flag`, {
        reason,
      })
      .pipe(map((res) => res.result.data));
  }

  unflag(id: string): Observable<CustomerModeration> {
    return this.http
      .patch<ApiResponse<CustomerModeration>>(`${this.apiUrl}/${id}/unflag`, {})
      .pipe(map((res) => res.result.data));
  }

  fixContact(
    id: string,
    dto: UpdateCustomerContactDto,
  ): Observable<CustomerProfile> {
    return this.http
      .patch<ApiResponse<CustomerProfile>>(`${this.apiUrl}/${id}/contact`, dto)
      .pipe(map((res) => res.result.data));
  }
}
