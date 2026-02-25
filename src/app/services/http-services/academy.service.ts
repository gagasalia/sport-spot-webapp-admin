import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Tenant, CreateTenantDto, UpdateTenantDto } from '../../shared/models/academy.model';

interface ApiResponse<T> {
  result: {
    data: T;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AcademyService {
  private readonly apiUrl = `${environment.apiUrl}/tenants`;

  constructor(private http: HttpClient) {}

  createTenant(tenant: CreateTenantDto): Observable<Tenant> {
    return this.http
      .post<ApiResponse<Tenant>>(this.apiUrl, tenant)
      .pipe(map((res) => res.result.data));
  }

  getAllTenants(): Observable<Tenant[]> {
    return this.http.get<ApiResponse<Tenant[]>>(this.apiUrl).pipe(map((res) => res.result.data));
  }

  getTenantById(id: string): Observable<Tenant> {
    return this.http
      .get<ApiResponse<Tenant>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => res.result.data));
  }

  updateTenant(id: string, tenant: UpdateTenantDto): Observable<Tenant> {
    return this.http
      .put<ApiResponse<Tenant>>(`${this.apiUrl}/${id}`, tenant)
      .pipe(map((res) => res.result.data));
  }

  deleteTenant(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
