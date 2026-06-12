import { ChangeDetectionStrategy, Component, signal, inject, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { WA_LOCAL_STORAGE, WA_WINDOW } from '@ng-web-apis/common';
import { tuiAsPortal, TuiPortals } from '@taiga-ui/cdk';
import {
  TuiButton,
  TuiDataList,
  TuiDropdown,
  TuiDropdownService,
  TUI_DARK_MODE,
  TUI_DARK_MODE_KEY,
  TuiRoot,
  TuiLoader,
  tuiLoaderOptionsProvider,
} from '@taiga-ui/core';
import { TuiBadgeNotification, TuiChevron } from '@taiga-ui/kit';
import { TuiNavigation } from '@taiga-ui/layout';
import { TuiTabBar } from '@taiga-ui/addon-mobile';
import { LoadingService } from './shared/services/loading.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TuiRoot,
    TuiButton,
    TuiDataList,
    TuiDropdown,
    TuiBadgeNotification,
    TuiChevron,
    TuiNavigation,
    TuiLoader,
    TuiTabBar,
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    TuiDropdownService,
    tuiAsPortal(TuiDropdownService),
    tuiLoaderOptionsProvider({
      size: 'l',
      inheritColor: false,
      overlay: true,
    }),
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App extends TuiPortals {
  private readonly key = inject(TUI_DARK_MODE_KEY);
  private readonly storage = inject(WA_LOCAL_STORAGE);
  private readonly media = inject(WA_WINDOW).matchMedia('(prefers-color-scheme: dark)');
  private readonly loadingService = inject(LoadingService);
  private readonly window = inject(WA_WINDOW);

  protected readonly darkMode = inject(TUI_DARK_MODE);
  protected readonly loading = this.loadingService.loading;
  protected expanded = signal(true);
  protected isMobile = signal(false);
  protected configDropdownOpen = signal(false);
  protected superAdminDropdownOpen = signal(false);

  constructor() {
    super();
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
