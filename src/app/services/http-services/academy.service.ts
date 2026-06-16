import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Academy, CreateAcademyDto, UpdateAcademyDto } from '../../shared/models/academy.model';
import { ApiResponse } from '../../shared/models/api-response.model';

@Injectable({
  providedIn: 'root',
})
export class AcademyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/academy`;

  createAcademy(academy: CreateAcademyDto): Observable<Academy> {
    return this.http
      .post<ApiResponse<Academy>>(this.apiUrl, academy)
      .pipe(map((res) => res.result.data));
  }

  getAllAcademies(): Observable<Academy[]> {
    return this.http.get<ApiResponse<Academy[]>>(this.apiUrl).pipe(map((res) => res.result.data));
  }

  getAcademyById(id: string): Observable<Academy> {
    return this.http
      .get<ApiResponse<Academy>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => res.result.data));
  }

  /**
   * Resolves the caller's own academy via `GET /academy/my`. The backend
   * derives the academy from the authenticated operator's admin membership and
   * returns `null` data for a superadmin or an operator with no academy. A
   * single call that the API authorizes for any operator — unlike
   * `GET /academy/:id`, which 403s for non-superadmins.
   */
  getMyAcademy(): Observable<Academy | null> {
    return this.http
      .get<ApiResponse<Academy | null>>(`${this.apiUrl}/my`)
      .pipe(map((res) => res.result.data));
  }

  updateAcademy(id: string, academy: UpdateAcademyDto): Observable<Academy> {
    return this.http
      .put<ApiResponse<Academy>>(`${this.apiUrl}/${id}`, academy)
      .pipe(map((res) => res.result.data));
  }

  deleteAcademy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
