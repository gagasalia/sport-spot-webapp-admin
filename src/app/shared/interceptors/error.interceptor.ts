import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TuiAlertService } from '@taiga-ui/core';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const alerts = inject(TuiAlertService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Show error alert in Georgian
      alerts
        .open('მოხდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით.', {
          appearance: 'error',
        })
        .subscribe();

      // Log error for debugging
      console.error('HTTP Error:', error);

      return throwError(() => error);
    }),
  );
};
