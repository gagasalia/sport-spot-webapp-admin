import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
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
} from '@taiga-ui/core';
import { TuiBadgeNotification, TuiChevron, TuiFade } from '@taiga-ui/kit';
import { TuiNavigation } from '@taiga-ui/layout';

@Component({
  selector: 'app-root',
  imports: [
    TuiRoot,
    TuiButton,
    TuiDataList,
    TuiDropdown,
    TuiBadgeNotification,
    TuiChevron,
    TuiFade,
    TuiNavigation,
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TuiDropdownService, tuiAsPortal(TuiDropdownService)],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App extends TuiPortals {
  private readonly key = inject(TUI_DARK_MODE_KEY);
  private readonly storage = inject(WA_LOCAL_STORAGE);
  private readonly media = inject(WA_WINDOW).matchMedia('(prefers-color-scheme: dark)');

  protected readonly darkMode = inject(TUI_DARK_MODE);
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
