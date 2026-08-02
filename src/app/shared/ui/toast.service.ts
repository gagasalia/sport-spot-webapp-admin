import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface SsToastOptions {
  /** Visual style; matches the old Taiga appearances used across the app. */
  appearance?: 'success' | 'error' | 'warning' | 'info' | (string & {});
  /** Auto-dismiss delay in ms. */
  autoClose?: number;
}

export interface SsToast {
  id: number;
  message: string;
  appearance: string;
}

/**
 * Kit toast service — drop-in for the old `TuiAlertService.open(msg, {appearance})`
 * call shape: returns a completed observable so existing
 * `.open(...).pipe(take(1)).subscribe()` call sites keep working unchanged.
 * Toasts render via `SsUiOutletComponent` in the app root.
 */
@Injectable({ providedIn: 'root' })
export class SsToastService {
  private seq = 0;
  readonly toasts = signal<SsToast[]>([]);

  open(message: string, options: SsToastOptions = {}): Observable<void> {
    const toast: SsToast = {
      id: ++this.seq,
      message,
      appearance: options.appearance ?? 'info',
    };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), options.autoClose ?? 4000);
    return of(undefined);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
