import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TuiAlertService } from '@taiga-ui/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { TenantService } from '../services/tenant.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const alerts = inject(TuiAlertService);
  const auth = inject(AuthService);
  const tenant = inject(TenantService);
  const router = inject(Router);

  const isLoginRequest = req.url === `${environment.apiUrl}/auth/login`;

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // A 401 on a guarded request means the session is gone: clear it and bounce
      // to /login. The login call handles its own error inline — don't touch it.
      if (error.status === 401 && !isLoginRequest) {
        auth.logout();
        tenant.clear();
        router.navigate(['/login'], {
          queryParams: { returnUrl: router.url },
        });
        // Suppress the generic toast — the login page shows its own messaging.
        return throwError(() => error);
      }

      // Generic failure: surface a Georgian error alert (login errors excluded —
      // the login component renders an inline message instead of double-toasting).
      if (!isLoginRequest) {
        alerts
          .open('მოხდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით.', {
            appearance: 'error',
          })
          .subscribe();
      }

      console.error('HTTP Error:', error);

      return throwError(() => error);
    }),
  );
};
