import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
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
import { TuiBadgeNotification, TuiChevron, TuiFade } from '@taiga-ui/kit';
import { TuiNavigation } from '@taiga-ui/layout';
import { LoadingService } from './shared/services/loading.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    TuiRoot,
    TuiButton,
    TuiDataList,
    TuiDropdown,
    TuiBadgeNotification,
    TuiChevron,
    TuiFade,
    TuiNavigation,
    TuiLoader,
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

  protected readonly darkMode = inject(TUI_DARK_MODE);
  protected readonly loading = this.loadingService.loading;
  protected expanded = signal(true);

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
}
