import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../shared/models/api-response.model';
import {
  StatsCancellations,
  StatsHeatmap,
  StatsOccupancy,
  StatsOverview,
  StatsQuery,
  StatsRevenue,
  StatsUsers,
} from '../../shared/models/stats.model';

/**
 * GET /statistics/* — admin analytics. The backend scopes results by role
 * (an admin is pinned to their own academy; a superadmin may pass academyId)
 * and caches responses ~5 min, so repeated filter switches are cheap.
 */
@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/statistics`;

  getOverview(query: StatsQuery): Observable<StatsOverview> {
    return this.get<StatsOverview>('overview', query);
  }

  getOccupancy(query: StatsQuery): Observable<StatsOccupancy> {
    return this.get<StatsOccupancy>('occupancy', query);
  }

  getHeatmap(query: StatsQuery): Observable<StatsHeatmap> {
    return this.get<StatsHeatmap>('heatmap', query);
  }

  getRevenue(query: StatsQuery): Observable<StatsRevenue> {
    return this.get<StatsRevenue>('revenue', query);
  }

  getUsers(query: StatsQuery): Observable<StatsUsers> {
    return this.get<StatsUsers>('users', query);
  }

  getCancellations(query: StatsQuery): Observable<StatsCancellations> {
    return this.get<StatsCancellations>('cancellations', query);
  }

  private get<T>(metric: string, query: StatsQuery): Observable<T> {
    let params = new HttpParams()
      .set('from', query.from)
      .set('to', query.to);
    for (const key of [
      'academyId',
      'facilityId',
      'courtId',
      'sportType',
      'granularity',
    ] as const) {
      const value = query[key];
      if (value) {
        params = params.set(key, value);
      }
    }
    return this.http
      .get<ApiResponse<T>>(`${this.apiUrl}/${metric}`, { params })
      .pipe(map((res) => res.result.data));
  }
}
