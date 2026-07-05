import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import {
  CreateTournamentDto,
  Tournament,
  TournamentRegistration,
  TournamentStatus,
  UpdateTournamentDto,
} from '../../shared/models/tournament.model';

export interface PaginatedTournaments {
  data: Tournament[];
  page?: ApiPage;
}

/**
 * Operator tournament API (docs/13 §5). Tenancy is server-side: the academy
 * derives from the chosen facility; `getMyTournaments` lists the caller's
 * academy (every academy for superadmins).
 */
@Injectable({ providedIn: 'root' })
export class TournamentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getMyTournaments(page = 1, limit = 50): Observable<PaginatedTournaments> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<ApiResponse<Tournament[]>>(`${this.apiUrl}/tournaments/my`, { params })
      .pipe(map((res) => ({ data: res.result.data, page: res.result.page })));
  }

  createTournament(dto: CreateTournamentDto): Observable<Tournament> {
    return this.http
      .post<ApiResponse<Tournament>>(`${this.apiUrl}/tournaments`, dto)
      .pipe(map((res) => res.result.data));
  }

  updateTournament(id: string, dto: UpdateTournamentDto): Observable<Tournament> {
    return this.http
      .put<ApiResponse<Tournament>>(`${this.apiUrl}/tournaments/${id}`, dto)
      .pipe(map((res) => res.result.data));
  }

  /** Lifecycle transition; cancelling refunds every paid registration. */
  setStatus(id: string, status: TournamentStatus): Observable<Tournament> {
    return this.http
      .patch<ApiResponse<Tournament>>(`${this.apiUrl}/tournaments/${id}/status`, { status })
      .pipe(map((res) => res.result.data));
  }

  /** Drafts only. */
  deleteTournament(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<{ deleted: boolean }>>(`${this.apiUrl}/tournaments/${id}`)
      .pipe(map(() => undefined));
  }

  getRegistrations(id: string): Observable<TournamentRegistration[]> {
    return this.http
      .get<ApiResponse<TournamentRegistration[]>>(
        `${this.apiUrl}/tournaments/${id}/registrations`,
      )
      .pipe(map((res) => res.result.data));
  }
}
