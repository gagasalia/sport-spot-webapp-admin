import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../shared/models/api-response.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';
import {
  Tournament,
  TournamentRegistration,
  UpdateRegistrationDto,
} from '../../shared/models/tournament.model';
import {
  AddEntrantDto,
  AutoScheduleDto,
  AutoScheduleResult,
  CloseGroupsDto,
  DrawView,
  MatchResultDto,
  ScheduleMatchDto,
  SeedsDto,
  ShiftScheduleDto,
  StructureDto,
  TournamentCategoryDto,
  TournamentCourt,
} from '../../shared/models/tournament-engine.model';

/**
 * The tournament ENGINE for operators (docs/33 §5) — every route under
 * `/tournaments/:id` the organizer console uses: categories, courts,
 * structure, entrants, seeds, the draw, results and the schedule.
 *
 * Every engine write answers with the fresh DRAW VIEW: callers replace their
 * state with it and never re-read. Entrant writes answer with the
 * registration row instead (the console re-reads the draw after those).
 *
 * Every call is quiet (SKIP_ERROR_TOAST): the console shows the API's own
 * `<code>: <text>` inline where the action happened (engine-errors.util).
 */
@Injectable({ providedIn: 'root' })
export class TournamentEngineService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private url(id: string, path = ''): string {
    return `${this.apiUrl}/tournaments/${id}${path}`;
  }

  private quiet(): { context: HttpContext } {
    return { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };
  }

  // ─── Reads ────────────────────────────────────────────────────────────────

  /** GET /tournaments/:id/draw — the full view (drafts and phones included). */
  getDraw(id: string): Observable<DrawView> {
    return this.http
      .get<ApiResponse<DrawView>>(this.url(id, '/draw'), this.quiet())
      .pipe(map((res) => res.result.data));
  }

  /** GET /tournaments/:id/categories — every category of the event, this one included. */
  getCategories(id: string): Observable<Tournament[]> {
    return this.http
      .get<ApiResponse<Tournament[]>>(this.url(id, '/categories'), this.quiet())
      .pipe(map((res) => res.result.data ?? []));
  }

  /** GET /tournaments/:id/courts — the host facility's courts (scheduler). */
  getCourts(id: string): Observable<TournamentCourt[]> {
    return this.http
      .get<ApiResponse<TournamentCourt[]>>(this.url(id, '/courts'), this.quiet())
      .pipe(map((res) => res.result.data ?? []));
  }

  // ─── Event categories ─────────────────────────────────────────────────────

  /** POST /tournaments/:id/categories — a new sibling category (the created tournament). */
  addCategory(id: string, dto: TournamentCategoryDto): Observable<Tournament> {
    return this.http
      .post<ApiResponse<Tournament>>(this.url(id, '/categories'), dto, this.quiet())
      .pipe(map((res) => res.result.data));
  }

  // ─── Structure + entrants + seeds ─────────────────────────────────────────

  /** PUT /tournaments/:id/structure — only while no draw. */
  setStructure(id: string, dto: StructureDto): Observable<DrawView> {
    return this.http
      .put<ApiResponse<DrawView>>(this.url(id, '/structure'), dto, this.quiet())
      .pipe(map((res) => res.result.data));
  }

  /** POST /tournaments/:id/registrations — an entrant added by hand. */
  addEntrant(id: string, dto: AddEntrantDto): Observable<TournamentRegistration> {
    return this.http
      .post<ApiResponse<TournamentRegistration>>(this.url(id, '/registrations'), dto, this.quiet())
      .pipe(map((res) => res.result.data));
  }

  /** PATCH /tournaments/:id/registrations/:regId — names / phones. */
  updateEntrant(
    id: string,
    registrationId: string,
    dto: UpdateRegistrationDto,
  ): Observable<TournamentRegistration> {
    return this.http
      .patch<ApiResponse<TournamentRegistration>>(
        this.url(id, `/registrations/${registrationId}`),
        dto,
        this.quiet(),
      )
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /tournaments/:id/registrations/:regId — cancel + refund, before the draw. */
  removeEntrant(id: string, registrationId: string): Observable<TournamentRegistration> {
    return this.http
      .delete<ApiResponse<TournamentRegistration>>(
        this.url(id, `/registrations/${registrationId}`),
        this.quiet(),
      )
      .pipe(map((res) => res.result.data));
  }

  /** PUT /tournaments/:id/seeds — `{ order }` (best first) or `{ method }`. */
  setSeeds(id: string, dto: SeedsDto): Observable<DrawView> {
    return this.http
      .put<ApiResponse<DrawView>>(this.url(id, '/seeds'), dto, this.quiet())
      .pipe(map((res) => res.result.data));
  }

  // ─── The draw ─────────────────────────────────────────────────────────────

  /** POST /tournaments/:id/draw — generate (as a draft). */
  generateDraw(id: string, shuffle: boolean): Observable<DrawView> {
    return this.http
      .post<ApiResponse<DrawView>>(this.url(id, '/draw'), { shuffle }, this.quiet())
      .pipe(map((res) => res.result.data));
  }

  /** POST /tournaments/:id/draw/publish — players see it. */
  publishDraw(id: string): Observable<DrawView> {
    return this.http
      .post<ApiResponse<DrawView>>(this.url(id, '/draw/publish'), {}, this.quiet())
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /tournaments/:id/draw — reset; `force` voids the entered results. */
  resetDraw(id: string, force = false): Observable<DrawView> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return this.http
      .delete<ApiResponse<DrawView>>(this.url(id, '/draw'), { ...this.quiet(), params })
      .pipe(map((res) => res.result.data));
  }

  /** PATCH /tournaments/:id/draw/swap — two entrants trade places (before any result). */
  swapEntrants(id: string, a: string, b: string): Observable<DrawView> {
    return this.http
      .patch<ApiResponse<DrawView>>(this.url(id, '/draw/swap'), { a, b }, this.quiet())
      .pipe(map((res) => res.result.data));
  }

  /** POST /tournaments/:id/draw/groups/close — fix the tables, fill the bracket. */
  closeGroups(id: string, dto: CloseGroupsDto): Observable<DrawView> {
    return this.http
      .post<ApiResponse<DrawView>>(this.url(id, '/draw/groups/close'), dto, this.quiet())
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /tournaments/:id/draw/groups/close — reopen (no bracket result yet). */
  reopenGroups(id: string): Observable<DrawView> {
    return this.http
      .delete<ApiResponse<DrawView>>(this.url(id, '/draw/groups/close'), this.quiet())
      .pipe(map((res) => res.result.data));
  }

  /** POST /tournaments/:id/draw/rounds/next — mexicano next round / americano extra round. */
  nextRound(id: string): Observable<DrawView> {
    return this.http
      .post<ApiResponse<DrawView>>(this.url(id, '/draw/rounds/next'), {}, this.quiet())
      .pipe(map((res) => res.result.data));
  }

  // ─── Results ──────────────────────────────────────────────────────────────

  /** PATCH /tournaments/:id/matches/:matchId/result — enter or replace (rated at once). */
  setResult(id: string, matchId: string, dto: MatchResultDto): Observable<DrawView> {
    return this.http
      .patch<ApiResponse<DrawView>>(this.url(id, `/matches/${matchId}/result`), dto, this.quiet())
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /tournaments/:id/matches/:matchId/result — clear (voids its rating entry). */
  clearResult(id: string, matchId: string): Observable<DrawView> {
    return this.http
      .delete<ApiResponse<DrawView>>(this.url(id, `/matches/${matchId}/result`), this.quiet())
      .pipe(map((res) => res.result.data));
  }

  // ─── Schedule ─────────────────────────────────────────────────────────────

  /** PATCH /tournaments/:id/matches/:matchId — court / time (null clears). */
  scheduleMatch(id: string, matchId: string, dto: ScheduleMatchDto): Observable<DrawView> {
    return this.http
      .patch<ApiResponse<DrawView>>(this.url(id, `/matches/${matchId}`), dto, this.quiet())
      .pipe(map((res) => res.result.data));
  }

  /** POST /tournaments/:id/schedule/auto — fill courts × time slots. */
  autoSchedule(id: string, dto: AutoScheduleDto): Observable<AutoScheduleResult> {
    return this.http
      .post<ApiResponse<AutoScheduleResult>>(this.url(id, '/schedule/auto'), dto, this.quiet())
      .pipe(map((res) => res.result.data));
  }

  /** POST /tournaments/:id/schedule/shift — delay everything not played yet. */
  shiftSchedule(id: string, dto: ShiftScheduleDto): Observable<DrawView> {
    return this.http
      .post<ApiResponse<DrawView>>(this.url(id, '/schedule/shift'), dto, this.quiet())
      .pipe(map((res) => res.result.data));
  }
}
