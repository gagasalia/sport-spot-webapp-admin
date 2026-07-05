import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import {
  AdjustBalanceDto,
  WalletBalance,
  WalletMutation,
  WalletTransaction,
} from '../../shared/models/wallet.model';

export interface PaginatedWalletTransactions {
  data: WalletTransaction[];
  page?: ApiPage;
}

/**
 * Superadmin wallet management API (`/um/:id/wallet*`). The routes are
 * superadmin-gated server-side; a mandatory `note` explains every manual
 * adjustment in the user's ledger.
 */
@Injectable({ providedIn: 'root' })
export class WalletAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getBalance(userId: string): Observable<WalletBalance> {
    return this.http
      .get<ApiResponse<WalletBalance>>(`${this.apiUrl}/um/${userId}/wallet`)
      .pipe(map((res) => res.result.data));
  }

  getTransactions(
    userId: string,
    page = 1,
    limit = 20,
  ): Observable<PaginatedWalletTransactions> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<
        ApiResponse<WalletTransaction[]>
      >(`${this.apiUrl}/um/${userId}/wallet/transactions`, { params })
      .pipe(map((res) => ({ data: res.result.data, page: res.result.page })));
  }

  /** Positive `amountTetri` credits the user, negative debits (never below 0). */
  adjust(userId: string, dto: AdjustBalanceDto): Observable<WalletMutation> {
    return this.http
      .post<ApiResponse<WalletMutation>>(`${this.apiUrl}/um/${userId}/wallet/adjust`, dto)
      .pipe(map((res) => res.result.data));
  }
}
