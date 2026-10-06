import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TPipe } from '../../shared/i18n/t.pipe';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../shared/ui/dialog.service';

export type EventScope = 'all' | 'one';

export interface EventScopeDialogData {
  /** The question, already in the live language. */
  content: string;
  /** "კაცები A" — the category the action was started from. */
  category: string;
  destructive?: boolean;
}

/**
 * A lifecycle action on one category of an EVENT (docs/33 §2.5): apply it to
 * «ყველა კატეგორია» (`wholeEvent: true`) or to this category only.
 * Dismissal completes without emitting (= cancel).
 */
@Component({
  selector: 'app-event-scope-dialog',
  standalone: true,
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4" data-testid="event-scope-dialog">
      <p class="m-0 georgian-text" lang="ka">{{ data.content }}</p>
      <div class="flex flex-wrap justify-end gap-2">
        <button class="ss-btn ss-btn--flat" type="button" (click)="context.dismiss()">
          <span class="georgian-text" lang="ka">{{ 'გაუქმება' | t }}</span>
        </button>
        <button
          class="ss-btn ss-btn--outline"
          type="button"
          data-testid="scope-one"
          (click)="context.completeWith('one')"
        >
          <span class="georgian-text" lang="ka">{{ 'მხოლოდ' | t }} „{{ data.category }}“</span>
        </button>
        <button
          type="button"
          data-testid="scope-all"
          [class]="data.destructive ? 'ss-btn ss-btn--danger' : 'ss-btn ss-btn--primary'"
          (click)="context.completeWith('all')"
        >
          <span class="georgian-text" lang="ka">{{ 'ყველა კატეგორია' | t }}</span>
        </button>
      </div>
    </div>
  `,
})
export class EventScopeDialogComponent {
  protected readonly context = inject(SS_DIALOG_CONTEXT) as SsDialogContext<
    EventScope,
    EventScopeDialogData
  >;
  protected readonly data = this.context.data;
}
