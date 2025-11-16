import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Show loading before request starts
  loadingService.show();

  return next(req).pipe(
    finalize(() => {
      // Hide loading when request completes (success or error)
      console.log('Finalizing request, hiding loading indicator.');
      loadingService.hide();
    })
  );
};
