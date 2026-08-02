import { Injectable, signal } from '@angular/core';

/** Any plain date field in the kit gets the popover — no per-page wiring. */
export const SS_DATEPICKER_TRIGGER = "input[type='date'].ss-input";

export interface SsDatepickerState {
  /** The date input the popover is anchored to and writes into. */
  input: HTMLInputElement;
}

/**
 * Kit datepicker: replaces the UA calendar popup for every
 * `input[type='date'].ss-input` via document-level event delegation, so pages
 * keep their plain native inputs (and 'YYYY-MM-DD' string form controls) and
 * get the themed popover for free. The panel is rendered by `ss-ui-outlet`
 * inside the themed DOM; selected values are written back through native
 * `input`/`change` events, which reactive forms already listen to.
 */
@Injectable({ providedIn: 'root' })
export class SsDatepickerService {
  readonly state = signal<SsDatepickerState | null>(null);

  private initialized = false;

  /** Installs the document-level triggers; called once by `ss-ui-outlet`. */
  init(): void {
    if (this.initialized || typeof document === 'undefined') {
      return;
    }
    this.initialized = true;

    // focusin covers tabbing into the field; click re-opens the popover when
    // the already-focused input is clicked again after an in-place close.
    document.addEventListener('focusin', (e) => this.maybeOpen(e.target));
    document.addEventListener('click', (e) => this.maybeOpen(e.target));
    // Keyboard path (and a guard against Chrome summoning the hidden UA
    // calendar): Space / Enter / Alt+ArrowDown re-opens the kit popover.
    document.addEventListener(
      'keydown',
      (e) => {
        const target = e.target;
        if (
          !(target instanceof HTMLInputElement) ||
          !target.matches(SS_DATEPICKER_TRIGGER) ||
          target.disabled ||
          target.readOnly
        ) {
          return;
        }
        if (e.key === ' ' || e.key === 'Enter' || (e.altKey && e.key === 'ArrowDown')) {
          e.preventDefault();
          this.maybeOpen(target);
        }
      },
      true,
    );
  }

  close(): void {
    this.state.set(null);
  }

  private maybeOpen(target: EventTarget | null): void {
    if (
      target instanceof HTMLInputElement &&
      target.matches(SS_DATEPICKER_TRIGGER) &&
      !target.disabled &&
      !target.readOnly &&
      this.state()?.input !== target
    ) {
      this.state.set({ input: target });
    }
  }
}
