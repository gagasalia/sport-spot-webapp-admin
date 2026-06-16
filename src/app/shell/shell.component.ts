import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { WA_LOCAL_STORAGE, WA_WINDOW } from '@ng-web-apis/common';
import {
  TuiButton,
  TuiDataList,
  TuiDropdown,
  TUI_DARK_MODE,
  TUI_DARK_MODE_KEY,
} from '@taiga-ui/core';
import { TuiBadgeNotification, TuiChevron } from '@taiga-ui/kit';
import { TuiNavigation } from '@taiga-ui/layout';
import { TuiTabBar } from '@taiga-ui/addon-mobile';
import { AuthService } from '../shared/services/auth.service';

/**
 * Authenticated application chrome: header, sidebar, mobile tab bar and the
 * dark-mode toggle. Rendered only behind the route-level `authGuard`, so the
 * shell never paints (and never reads auth state) on the public `/login` page.
 * Feature pages render into the shell's own `<router-outlet>`.
 *
 * Dropdown portals are intentionally NOT wired here. `TuiRoot` (in `App`)
 * already renders `<tui-dropdowns>`, which is the `TuiPortals` host that owns
 * the root `TuiDropdownService` — Taiga's default. A previous Phase-2 split
 * re-provided `TuiDropdownService` + `tuiAsPortal` on this shell and extended
 * `TuiPortals`, but without a `#viewContainer` in the template the host's
 * `vcr` was undefined, so every `tuiSelect`/`tuiDropdown` open threw
 * "Cannot read properties of undefined (reading 'createComponent')". Letting
 * `TuiRoot` own the portals fixes it; the `TuiDropdown` directive import below
 * is only the consumer side used by the mobile tab bar.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TuiButton,
    TuiDataList,
    TuiDropdown,
    TuiBadgeNotification,
    TuiChevron,
    TuiNavigation,
    TuiTabBar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  private readonly key = inject(TUI_DARK_MODE_KEY);
  private readonly storage = inject(WA_LOCAL_STORAGE);
  private readonly media = inject(WA_WINDOW).matchMedia('(prefers-color-scheme: dark)');
  private readonly window = inject(WA_WINDOW);
  private readonly auth = inject(AuthService);

  protected readonly darkMode = inject(TUI_DARK_MODE);
  protected readonly isSuperAdmin = this.auth.isSuperAdmin;
  protected expanded = signal(true);
  protected isMobile = signal(false);
  protected configDropdownOpen = signal(false);
  protected superAdminDropdownOpen = signal(false);

  constructor() {
    this.checkMobile();
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.checkMobile();
  }

  private checkMobile(): void {
    this.isMobile.set(this.window.innerWidth <= 768);
  }

  protected handleToggle(): void {
    this.expanded.update((e) => !e);
  }

  protected toggleDarkMode(): void {
    this.darkMode.set(!this.darkMode());
  }

  protected resetDarkMode(): void {
    this.darkMode.set(this.media.matches);
    this.storage?.removeItem(this.key);
  }

  protected toggleConfigDropdown(): void {
    this.configDropdownOpen.update((open) => !open);
  }
}
