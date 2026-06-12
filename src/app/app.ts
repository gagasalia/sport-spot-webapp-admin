import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TUI_DARK_MODE, TuiRoot, TuiLoader, tuiLoaderOptionsProvider } from '@taiga-ui/core';
import { LoadingService } from './shared/services/loading.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuiRoot, TuiLoader],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    tuiLoaderOptionsProvider({
      size: 'l',
      inheritColor: false,
      overlay: true,
    }),
  ],
  templateUrl: './app.html',
})
export class App {
  private readonly loadingService = inject(LoadingService);

  protected readonly darkMode = inject(TUI_DARK_MODE);
  protected readonly loading = this.loadingService.loading;
}
