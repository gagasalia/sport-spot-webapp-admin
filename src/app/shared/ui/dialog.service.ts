import { Injectable, InjectionToken, Injector, Type, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Context injected into dialog components — mirrors the old Taiga
 * `TuiDialogContext` surface (`data` in, `completeWith(value)` out) so dialog
 * components only swap the injection token, not their logic.
 */
export class SsDialogContext<O = unknown, I = unknown> {
  constructor(
    readonly data: I,
    private readonly close: (result: O | undefined, emitted: boolean) => void,
  ) {}

  /** Emit `value` to the opener and close the dialog. */
  completeWith(value: O): void {
    this.close(value, true);
  }

  /** Close without emitting (backdrop / X / Esc). */
  dismiss(): void {
    this.close(undefined, false);
  }
}

export const SS_DIALOG_CONTEXT = new InjectionToken<SsDialogContext>('SS_DIALOG_CONTEXT');

export interface SsDialogOptions {
  /** Header title; omitted → no header text (X still shows when closable). */
  label?: string;
  size?: 's' | 'm' | 'l';
  /** Backdrop / Esc closes the dialog (default true). */
  dismissible?: boolean;
  /** Show the X close button (default true). */
  closable?: boolean;
  /** Arbitrary payload exposed as `context.data`. */
  data?: unknown;
}

export interface SsOpenDialog {
  id: number;
  component: Type<unknown>;
  injector: Injector;
  label?: string;
  size: 's' | 'm' | 'l';
  dismissible: boolean;
  closable: boolean;
  ctx: SsDialogContext<unknown, unknown>;
}

/**
 * Kit dialog service — drop-in for the old `TuiDialogService.open()` shape:
 * cold observable, opens on subscribe, `completeWith(v)` emits `v` then
 * completes, dismissal completes without emitting (so `subscribe(v => if (v))`
 * confirm-style call sites behave identically). Dialogs render via
 * `SsUiOutletComponent` in the app root; stacking is supported.
 */
@Injectable({ providedIn: 'root' })
export class SsDialogService {
  private readonly rootInjector = inject(Injector);
  private seq = 0;
  readonly dialogs = signal<SsOpenDialog[]>([]);

  open<O>(component: Type<unknown>, options: SsDialogOptions = {}): Observable<O> {
    return new Observable<O>((subscriber) => {
      const id = ++this.seq;
      const ctx = new SsDialogContext<O, unknown>(options.data, (result, emitted) => {
        this.remove(id);
        if (emitted) subscriber.next(result as O);
        subscriber.complete();
      });
      const injector = Injector.create({
        providers: [{ provide: SS_DIALOG_CONTEXT, useValue: ctx }],
        parent: this.rootInjector,
      });
      this.dialogs.update((list) => [
        ...list,
        {
          id,
          component,
          injector,
          label: options.label,
          size: options.size ?? 'm',
          dismissible: options.dismissible ?? true,
          closable: options.closable ?? true,
          ctx: ctx as SsDialogContext<unknown, unknown>,
        },
      ]);
      // Unsubscribe (e.g. take(1) after an emission) also tears the dialog down.
      return () => this.remove(id);
    });
  }

  private remove(id: number): void {
    this.dialogs.update((list) => list.filter((d) => d.id !== id));
  }
}
