import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/**
 * Attaches `Authorization: Bearer <token>` to requests targeting
 * `environment.apiUrl`, except the public login endpoint. Registered before
 * the loading/error interceptors so every downstream interceptor sees the
 * authenticated request.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiRequest = req.url.startsWith(environment.apiUrl);
  const isLoginRequest = req.url === `${environment.apiUrl}/auth/login`;

  if (!isApiRequest || isLoginRequest) {
    return next(req);
  }

  const token = inject(AuthService).getToken();
  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
