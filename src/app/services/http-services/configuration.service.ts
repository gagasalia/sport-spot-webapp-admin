import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Facility } from '../../shared/models/facility.model';

@Injectable({
  providedIn: 'root',
})
export class ConfigurationService {
  private apiUrl = `${environment.apiUrl}/configuration`;

  constructor(private http: HttpClient) {}

  getFacilities(): Observable<Facility[]> {
    // Temporarily testing loading interceptor with delay to see the loader
    // return this.http.get<Facility[]>(`${this.apiUrl}/facilities`);
    // TODO: Revert to mock data:
    return of([]);
  }

  getFacilityById(id: string): Observable<Facility> {
    return this.http.get<Facility>(`${this.apiUrl}/facilities/${id}`);
  }

  createFacility(facility: Omit<Facility, 'id'>): Observable<Facility> {
    return this.http.post<Facility>(`${this.apiUrl}/facilities`, facility);
  }

  updateFacility(id: string, facility: Partial<Facility>): Observable<Facility> {
    return this.http.put<Facility>(`${this.apiUrl}/facilities/${id}`, facility);
  }

  deleteFacility(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/facilities/${id}`);
  }
}
