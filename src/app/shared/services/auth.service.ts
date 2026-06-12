import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { JwtPayload, LoginResponse } from '../models/auth.model';
import { UserType } from '../models/user.model';
import { decodeJwt } from '../utils/jwt.util';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';

export const TOKEN_STORAGE_KEY = 'ss_token';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /** Decoded claims of the persisted token, or `null` when logged out. */
  private readonly _currentUser = signal<JwtPayload | null>(this.readTokenPayload());
  readonly currentUser = this._currentUser.asReadonly();

  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  readonly isSuperAdmin = computed(() =>
    (this._currentUser()?.userType ?? []).includes(UserType.SUPERADMIN),
  );

  /** Authenticates the user, persists the token, and updates `currentUser`. */
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<ApiResponse<LoginResponse>>(
        `${this.apiUrl}/auth/login`,
        { email, password },
        // The login form has its own `isSubmitting` indicator, so skip the global
        // overlay spinner that would otherwise cover the form during the request.
        { context: new HttpContext().set(SKIP_LOADING, true) },
      )
      .pipe(
        map((res) => res.result.data),
        tap((data) => this.setToken(data.accessToken)),
      );
  }

  /** Clears the persisted token and the current user. */
  logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    this._currentUser.set(null);
  }

  /** The raw persisted access token, or `null`. */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  private setToken(token: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    this._currentUser.set(decodeJwt(token));
  }

  private readTokenPayload(): JwtPayload | null {
    return decodeJwt(localStorage.getItem(TOKEN_STORAGE_KEY));
  }
}

/** Suppresses the global loading spinner; re-exported for callers that need it. */
export { SKIP_LOADING };
