import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

const STORAGE_KEY = 'ss-dark-mode';

/**
 * Dark-mode state (replaces Taiga's `TUI_DARK_MODE`). The theme attribute goes
 * on `<html>` so the `[tuiTheme='light']` token overrides in
 * `sport-spot-theme.css` reach everything — including body-attached overlays.
 * Persisted per browser; defaults to DARK — the premium-dark design is the
 * canonical look (matching the player app), light is the opt-in.
 */
@Injectable({ providedIn: 'root' })
export class SsThemeService {
  private readonly document = inject(DOCUMENT);

  readonly dark = signal<boolean>(this.initial());

  constructor() {
    effect(() => {
      const dark = this.dark();
      this.document.documentElement.setAttribute('tuiTheme', dark ? 'dark' : 'light');
      try {
        localStorage.setItem(STORAGE_KEY, String(dark));
      } catch {
        /* storage unavailable (private mode etc.) — theme still applies */
      }
    });
  }

  toggle(): void {
    this.dark.update((d) => !d);
  }

  private initial(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === 'true';
    } catch {
      /* fall through to the dark default */
    }
    return true;
  }
}
