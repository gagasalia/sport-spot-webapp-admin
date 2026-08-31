import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { JwtPayload, LoginResponse, NonAdminLoginError } from '../models/auth.model';
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

  /** True when the session belongs to an admin or superadmin account. */
  readonly isAdmin = computed(() => hasAdminRole(this._currentUser()));

  /**
   * Authenticates the user, persists the token, and updates `currentUser`.
   * Admin accounts sign in by USERNAME (stored lowercased, so lowercase here).
   * Non-admin accounts are rejected with {@link NonAdminLoginError} and their
   * token is never persisted — the admin panel is operator-only.
   */
  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<ApiResponse<LoginResponse>>(
        `${this.apiUrl}/auth/login`,
        { username: username.trim().toLowerCase(), password },
        // The login form has its own `isSubmitting` indicator, so skip the global
        // overlay spinner that would otherwise cover the form during the request.
        { context: new HttpContext().set(SKIP_LOADING, true) },
      )
      .pipe(
        map((res) => res.result.data),
        tap((data) => {
          if (!hasAdminRole(decodeJwt(data.accessToken))) {
            throw new NonAdminLoginError();
          }
          this.setToken(data.accessToken);
        }),
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

/** True when the decoded token carries an admin or superadmin role. */
function hasAdminRole(payload: JwtPayload | null): boolean {
  const types = payload?.userType ?? [];
  return types.includes(UserType.ADMIN) || types.includes(UserType.SUPERADMIN);
}

/** Suppresses the global loading spinner; re-exported for callers that need it. */
export { SKIP_LOADING };
