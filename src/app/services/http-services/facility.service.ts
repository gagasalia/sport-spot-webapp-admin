import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Facility, CreateFacilityDto, UpdateFacilityDto } from '../../shared/models/facility.model';
import { ApiResponse } from '../../shared/models/api-response.model';

@Injectable({
  providedIn: 'root',
})
export class FacilityService {
  private readonly apiUrl = `${environment.apiUrl}/facilities`;

  constructor(private http: HttpClient) {}

  /** GET /facilities/academy/{academyId} – list all facilities for an academy */
  getFacilitiesByAcademy(academyId: string): Observable<Facility[]> {
    return this.http
      .get<ApiResponse<Facility[]>>(`${this.apiUrl}/academy/${academyId}`)
      .pipe(map((res) => res.result.data));
  }

  /** GET /facilities/{id} – get single facility by id */
  getFacilityById(id: string): Observable<Facility> {
    return this.http
      .get<ApiResponse<Facility>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => res.result.data));
  }

  /** POST /facilities – create a new facility */
  createFacility(dto: CreateFacilityDto): Observable<Facility> {
    return this.http
      .post<ApiResponse<Facility>>(this.apiUrl, dto)
      .pipe(map((res) => res.result.data));
  }

  /** PUT /facilities/{id} – update an existing facility */
  updateFacility(id: string, dto: UpdateFacilityDto): Observable<Facility> {
    return this.http
      .put<ApiResponse<Facility>>(`${this.apiUrl}/${id}`, dto)
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /facilities/{id} – delete a facility */
  deleteFacility(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /** PATCH /facilities/{facilityId}/court/{courtId} – add a court to a facility */
  addCourtToFacility(facilityId: string, courtId: string): Observable<unknown> {
    return this.http.patch(`${this.apiUrl}/${facilityId}/court/${courtId}`, {});
  }
}
