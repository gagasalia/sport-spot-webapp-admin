import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';
import { SKIP_LOADING } from '../../shared/interceptors/loading.interceptor';
import {
  CustomerLookupView,
  CustomerScorecardsQuery,
  RatingCardView,
  ScorecardView,
  ScorecardsAdminQuery,
  TournamentResultDto,
} from '../../shared/models/ranking.model';

export interface PaginatedScorecards {
  data: ScorecardView[];
  page?: ApiPage;
}

/**
 * The API's error text: `{ result: null, errors: [{ statusCode, message }] }`
 * (AllExceptionsFilter). '' when the body carries none.
 */
export function apiErrorMessage(err: unknown): string {
  if (!(err instanceof HttpErrorResponse)) return '';
  const body = err.error as { errors?: Array<{ message?: unknown }> } | null;
  const message = body?.errors?.[0]?.message;
  return typeof message === 'string' ? message : '';
}

/**
 * Ranking API for operators (docs/25 §5):
 *
 * - tournament results (admin/superadmin, tenancy via the tournament's
 *   academy): list, enter one pairing (confirmed + rated at once), void;
 * - the superadmin moderation list + void of a confirmed scorecard;
 * - a customer's rating card and scorecards in every status (any operator);
 * - the operator phone lookup (does a typed number have an account?).
 *
 * Writes opt out of the generic error toast (SKIP_ERROR_TOAST): their callers
 * surface the API's own message (`invalid_set_score: …`, 409s) inline.
 */
@Injectable({ providedIn: 'root' })
export class RankingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private quiet(): HttpContext {
    return new HttpContext().set(SKIP_ERROR_TOAST, true);
  }

  /** GET /tournaments/:id/results — oldest first, with phones + deltas. */
  tournamentResults(tournamentId: string): Observable<ScorecardView[]> {
    return this.http
      .get<ApiResponse<ScorecardView[]>>(`${this.apiUrl}/tournaments/${tournamentId}/results`)
      .pipe(map((res) => res.result.data ?? []));
  }

  /** POST /tournaments/:id/results — returns the rated scorecard (with deltas). */
  createTournamentResult(
    tournamentId: string,
    dto: TournamentResultDto,
  ): Observable<ScorecardView> {
    return this.http
      .post<ApiResponse<ScorecardView>>(`${this.apiUrl}/tournaments/${tournamentId}/results`, dto, {
        context: this.quiet(),
      })
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /tournaments/:id/results/:scorecardId { reason } — void (replay repairs ratings). */
  voidTournamentResult(
    tournamentId: string,
    scorecardId: string,
    reason: string,
  ): Observable<ScorecardView> {
    return this.http
      .delete<ApiResponse<ScorecardView>>(
        `${this.apiUrl}/tournaments/${tournamentId}/results/${scorecardId}`,
        { body: { reason }, context: this.quiet() },
      )
      .pipe(map((res) => res.result.data));
  }

  /** GET /ranking/scorecards — superadmin moderation list, newest first. */
  scorecards(query: ScorecardsAdminQuery = {}): Observable<PaginatedScorecards> {
    let params = new HttpParams();
    if (query.status) params = params.set('status', query.status);
    if (query.shadowOnly) params = params.set('shadowOnly', 'true');
    if (query.userId) params = params.set('userId', query.userId);
    if (query.phone) params = params.set('phone', query.phone);
    if (query.page != null) params = params.set('page', String(query.page));
    if (query.limit != null) params = params.set('limit', String(query.limit));
    return this.http
      .get<ApiResponse<ScorecardView[]>>(`${this.apiUrl}/ranking/scorecards`, { params })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }

  /** POST /ranking/scorecards/:id/void { reason } — confirmed rows only (409 otherwise). */
  voidScorecard(id: string, reason: string): Observable<ScorecardView> {
    return this.http
      .post<ApiResponse<ScorecardView>>(
        `${this.apiUrl}/ranking/scorecards/${id}/void`,
        { reason },
        { context: this.quiet() },
      )
      .pipe(map((res) => res.result.data));
  }

  /** GET /ranking/customers/:userId/card — any operator. */
  customerCard(userId: string): Observable<RatingCardView> {
    return this.http
      .get<ApiResponse<RatingCardView>>(`${this.apiUrl}/ranking/customers/${userId}/card`, {
        context: this.quiet(),
      })
      .pipe(map((res) => res.result.data));
  }

  /** GET /ranking/customers/:userId/scorecards — every status, newest first, with phones. */
  customerScorecards(
    userId: string,
    query: CustomerScorecardsQuery = {},
  ): Observable<PaginatedScorecards> {
    let params = new HttpParams();
    if (query.status) params = params.set('status', query.status);
    if (query.page != null) params = params.set('page', String(query.page));
    if (query.limit != null) params = params.set('limit', String(query.limit));
    return this.http
      .get<ApiResponse<ScorecardView[]>>(`${this.apiUrl}/ranking/customers/${userId}/scorecards`, {
        params,
        context: this.quiet(),
      })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }

  /**
   * GET /ranking/customers/lookup?phone= — typing-driven, so it skips both
   * the global loading overlay and the generic error toast.
   */
  lookupCustomer(phone: string): Observable<CustomerLookupView> {
    const params = new HttpParams().set('phone', phone);
    return this.http
      .get<ApiResponse<CustomerLookupView>>(`${this.apiUrl}/ranking/customers/lookup`, {
        params,
        context: this.quiet().set(SKIP_LOADING, true),
      })
      .pipe(map((res) => res.result.data ?? { found: false }));
  }
}
