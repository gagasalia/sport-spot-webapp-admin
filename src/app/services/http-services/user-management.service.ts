import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, CreateUserDto, UpdateUserDto, FilterUsersDto } from '../../shared/models/user.model';

interface ApiResponse<T> {
  result: {
    data: T;
  };
}

@Injectable({
  providedIn: 'root',
})
export class UserManagementService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createUser(user: CreateUserDto): Observable<User> {
    return this.http
      .post<ApiResponse<User>>(`${this.apiUrl}/um/create`, user)
      .pipe(map((res) => res.result.data));
  }

  findAllUsers(filters: FilterUsersDto = {}, context?: HttpContext): Observable<User[]> {
    return this.http
      .post<ApiResponse<User[]>>(`${this.apiUrl}/um/find`, filters, { context })
      .pipe(map((res) => res.result.data));
  }

  findUserById(id: string): Observable<User> {
    return this.http
      .get<ApiResponse<User>>(`${this.apiUrl}/um/${id}`)
      .pipe(map((res) => res.result.data));
  }

  updateUser(id: string, user: UpdateUserDto): Observable<User> {
    return this.http
      .patch<ApiResponse<User>>(`${this.apiUrl}/um/${id}`, user)
      .pipe(map((res) => res.result.data));
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/um/${id}`);
  }
}
