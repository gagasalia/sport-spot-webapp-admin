import { TuiRoot } from '@taiga-ui/core';
import { TuiChip } from '@taiga-ui/kit';
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuiRoot, TuiChip],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('sportify-admin');
}
