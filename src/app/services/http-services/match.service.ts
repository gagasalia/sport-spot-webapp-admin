import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import {
  AdminMatch,
  AdminMatchPlayer,
  MatchStatus,
} from '../../shared/models/match.model';

export interface PaginatedMatches {
  data: AdminMatch[];
  page?: ApiPage;
}

/**
 * Operator open-match moderation API (docs/15 §4): matches hosted at the
 * academy's venues (server-side tenancy; superadmins see everything), the
 * full membership list incl. contact snapshots, and the moderation cancel.
 */
@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getMatches(
    options: { facility?: string; status?: MatchStatus; page?: number; limit?: number } = {},
  ): Observable<PaginatedMatches> {
    let params = new HttpParams()
      .set('page', options.page ?? 1)
      .set('limit', options.limit ?? 50);
    if (options.facility) {
      params = params.set('facility', options.facility);
    }
    if (options.status) {
      params = params.set('status', options.status);
    }
    return this.http
      .get<ApiResponse<AdminMatch[]>>(`${this.apiUrl}/matches/operator`, { params })
      .pipe(map((res) => ({ data: res.result.data, page: res.result.page })));
  }

  /** Every membership row — joined/left/removed — with contacts. */
  getPlayers(matchId: string): Observable<AdminMatchPlayer[]> {
    return this.http
      .get<
        ApiResponse<AdminMatchPlayer[]>
      >(`${this.apiUrl}/matches/${matchId}/players/operator`)
      .pipe(map((res) => res.result.data));
  }

  /** Moderation cancel — recorded as cancelledBy:'admin'. */
  cancelMatch(matchId: string): Observable<AdminMatch> {
    return this.http
      .post<ApiResponse<AdminMatch>>(`${this.apiUrl}/matches/${matchId}/admin-cancel`, {})
      .pipe(map((res) => res.result.data));
  }
}
