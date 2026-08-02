import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { SsDatepickerPanelComponent } from './datepicker-panel.component';
import { SsDatepickerService } from './datepicker.service';
import { SsDialogService, SsOpenDialog } from './dialog.service';
import { SsToastService } from './toast.service';

/**
 * Renders the dialog stack, datepicker popover and toast rail for
 * {@link SsDialogService} / {@link SsDatepickerService} /
 * {@link SsToastService}. Mounted once in the app root, inside the themed DOM,
 * so all overlays inherit the active theme tokens. Styles live in
 * `sport-spot-theme.css` (`.ss-dialog-*`, `.ss-pop*`, `.ss-toast*`).
 */
@Component({
  selector: 'ss-ui-outlet',
  standalone: true,
  imports: [NgComponentOutlet, SsDatepickerPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (d of dialogService.dialogs(); track d.id) {
      <div class="ss-dialog-backdrop" (click)="onBackdrop(d)">
        <div
          class="ss-dialog"
          [class.ss-dialog--s]="d.size === 's'"
          [class.ss-dialog--l]="d.size === 'l'"
          role="dialog"
          aria-modal="true"
          (click)="$event.stopPropagation()"
        >
          @if (d.label || d.closable) {
            <div class="ss-dialog-head">
              <h2 class="ss-dialog-title georgian-text" lang="ka">{{ d.label }}</h2>
              @if (d.closable) {
                <button
                  class="ss-icon-btn"
                  type="button"
                  aria-label="Close"
                  (click)="d.ctx.dismiss()"
                >
                  <i class="ss-ic" style="--ss-ic: url('assets/taiga-ui/icons/x.svg')"></i>
                </button>
              }
            </div>
          }
          <div class="ss-dialog-body">
            <ng-container *ngComponentOutlet="d.component; injector: d.injector" />
          </div>
        </div>
      </div>
    }

    @if (datepicker.state(); as dp) {
      <ss-datepicker-panel [anchor]="dp.input" />
    }

    <div class="ss-toasts" aria-live="polite">
      @for (t of toastService.toasts(); track t.id) {
        <button
          type="button"
          class="ss-toast"
          [class.ss-toast--success]="t.appearance === 'success'"
          [class.ss-toast--error]="t.appearance === 'error'"
          [class.ss-toast--warning]="t.appearance === 'warning'"
          (click)="toastService.dismiss(t.id)"
        >
          <span class="georgian-text" lang="ka">{{ t.message }}</span>
        </button>
      }
    </div>
  `,
})
export class SsUiOutletComponent {
  protected readonly dialogService = inject(SsDialogService);
  protected readonly toastService = inject(SsToastService);
  protected readonly datepicker = inject(SsDatepickerService);

  constructor() {
    this.datepicker.init();
  }

  protected onBackdrop(dialog: SsOpenDialog): void {
    if (dialog.dismissible) dialog.ctx.dismiss();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    const stack = this.dialogService.dialogs();
    const top = stack[stack.length - 1];
    if (top?.dismissible) top.ctx.dismiss();
  }
}
