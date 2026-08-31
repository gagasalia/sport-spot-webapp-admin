import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import {
  Campaign,
  CampaignParticipant,
  CreateCampaignDto,
  UpdateCampaignDto,
} from '../../shared/models/campaign.model';

export interface PaginatedCampaigns {
  data: Campaign[];
  page?: ApiPage;
}

export interface PaginatedParticipants {
  data: CampaignParticipant[];
  page?: ApiPage;
}

/** Query options for `getCampaigns`; undefined keys are omitted from the URL.
 * No text search: campaigns store no copy (docs/24 v2). */
export interface CampaignListOpts {
  page: number;
  limit: number;
  /** Superadmin-only filter; admins are auto-scoped server-side. */
  academyId?: string;
  facilityId?: string;
  active?: boolean;
}

/**
 * Admin campaign API (docs/24 §4). Money crosses the wire as integer **tetri**;
 * the pages convert to/from GEL at their edge. Every payload is the standard
 * envelope (`{ result: { data, page? }, errors }`). Admins are auto-scoped to
 * their own academy server-side; the `academyId` filter and the create-time
 * `academyId` are superadmin-only.
 */
@Injectable({ providedIn: 'root' })
export class CampaignService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/campaigns`;

  /** GET /campaigns — paginated list with optional active/scope filters. */
  getCampaigns(opts: CampaignListOpts): Observable<PaginatedCampaigns> {
    let params = new HttpParams().set('page', opts.page).set('limit', opts.limit);
    if (opts.academyId !== undefined) params = params.set('academyId', opts.academyId);
    if (opts.facilityId !== undefined) params = params.set('facilityId', opts.facilityId);
    if (opts.active !== undefined) params = params.set('active', opts.active);
    return this.http
      .get<ApiResponse<Campaign[]>>(this.apiUrl, { params })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }

  /** POST /campaigns */
  createCampaign(dto: CreateCampaignDto): Observable<Campaign> {
    return this.http
      .post<ApiResponse<Campaign>>(this.apiUrl, dto)
      .pipe(map((res) => res.result.data));
  }

  /**
   * PATCH /campaigns/:id — partial update; explicit `null` clears an optional
   * field. 409 means the terms are locked (players have already joined).
   */
  updateCampaign(id: string, dto: UpdateCampaignDto): Observable<Campaign> {
    return this.http
      .patch<ApiResponse<Campaign>>(`${this.apiUrl}/${id}`, dto)
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /campaigns/:id — 409 means it has participants (deactivate instead). */
  deleteCampaign(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<boolean>>(`${this.apiUrl}/${id}`)
      .pipe(map(() => undefined));
  }

  /** GET /campaigns/:id/participants — paginated, player identity flattened. */
  getParticipants(id: string, page = 1, limit = 20): Observable<PaginatedParticipants> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<ApiResponse<CampaignParticipant[]>>(`${this.apiUrl}/${id}/participants`, {
        params,
      })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }
}
