import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Facility, CreateFacilityDto, UpdateFacilityDto } from '../../shared/models/facility.model';

@Injectable({
  providedIn: 'root',
})
export class FacilityService {
  private readonly apiUrl = `${environment.apiUrl}/facilities`;

  constructor(private http: HttpClient) {}

  /** GET /facilities/academy/{academyId} – list all facilities for an academy */
  getFacilitiesByAcademy(academyId: string): Observable<Facility[]> {
    return this.http.get<Facility[]>(`${this.apiUrl}/academy/${academyId}`);
  }

  /** GET /facilities/{id} – get single facility by id */
  getFacilityById(id: string): Observable<Facility> {
    return this.http.get<Facility>(`${this.apiUrl}/${id}`);
  }

  /** POST /facilities – create a new facility */
  createFacility(dto: CreateFacilityDto): Observable<Facility> {
    return this.http.post<Facility>(this.apiUrl, dto);
  }

  /** PUT /facilities/{id} – update an existing facility */
  updateFacility(id: string, dto: UpdateFacilityDto): Observable<Facility> {
    return this.http.put<Facility>(`${this.apiUrl}/${id}`, dto);
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
