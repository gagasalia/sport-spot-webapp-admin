import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarRow {
  label: string;
  value: number;
  /** Preformatted value text (defaults to the raw number). */
  display?: string;
}

/**
 * Horizontal bar breakdown (venues, hour bands, segments, lead times):
 * label · bar scaled to the max · value. Zero/negative-safe.
 */
@Component({
  selector: 'ss-bar-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rows">
      @for (row of rows(); track row.label) {
        <div class="row" [title]="row.label + ' — ' + (row.display ?? row.value)">
          <span class="label georgian-text" lang="ka">{{ row.label }}</span>
          <span class="track">
            <span
              class="fill"
              [class.is-negative]="row.value < 0"
              [style.width.%]="widthOf(row)"
            ></span>
          </span>
          <span class="value ss-num">{{ row.display ?? row.value }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .rows {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
      }
      .row {
        display: grid;
        grid-template-columns: minmax(72px, 150px) 1fr auto;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .label {
        font-size: 12.5px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .track {
        height: 8px;
        border-radius: 999px;
        background: var(--tui-background-neutral-1);
        overflow: hidden;
      }
      .fill {
        display: block;
        height: 100%;
        border-radius: 999px;
        background: var(--accent);
        transition: width var(--dur-3) var(--ease);
      }
      .fill.is-negative {
        background: var(--danger);
      }
      .value {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
      }
    `,
  ],
})
export class BarListComponent {
  readonly rows = input.required<BarRow[]>();

  private readonly max = computed(() =>
    Math.max(1, ...this.rows().map((r) => Math.abs(r.value))),
  );

  widthOf(row: BarRow): number {
    return (Math.abs(row.value) / this.max()) * 100;
  }
}
