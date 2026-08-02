import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface StackPart {
  name: string;
  value: number;
  /** CSS color (kit token var). */
  color: string;
}

export interface StackRow {
  label: string;
  parts: StackPart[];
}

/**
 * Horizontal stacked bars for composed trends (new vs returning users,
 * cancelled vs kept bookings): each row's segments scale against the global
 * max total; a legend derives from the first row.
 */
@Component({
  selector: 'ss-stack-bars',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length > 0) {
      <div class="legend">
        @for (part of rows()[0].parts; track part.name) {
          <span class="legend-item georgian-text" lang="ka">
            <i class="swatch" [style.background]="part.color"></i>
            {{ part.name }}
          </span>
        }
      </div>
      <div class="rows">
        @for (row of rows(); track row.label) {
          <div class="row" [title]="titleOf(row)">
            <span class="label ss-num">{{ row.label }}</span>
            <span class="track">
              @for (part of row.parts; track part.name) {
                <span
                  class="seg"
                  [style.background]="part.color"
                  [style.width.%]="widthOf(part.value)"
                ></span>
              }
            </span>
            <span class="value ss-num">{{ totalOf(row) }}</span>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-bottom: 10px;
      }
      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
        color: var(--text-muted);
      }
      .swatch {
        width: 10px;
        height: 10px;
        border-radius: 3px;
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .row {
        display: grid;
        grid-template-columns: minmax(64px, 96px) 1fr auto;
        align-items: center;
        gap: 10px;
      }
      .label {
        font-size: 11.5px;
        color: var(--text-faint);
        white-space: nowrap;
      }
      .track {
        display: flex;
        gap: 1px;
        height: 10px;
        border-radius: 999px;
        background: var(--tui-background-neutral-1);
        overflow: hidden;
      }
      .seg {
        display: block;
        height: 100%;
        transition: width var(--dur-3) var(--ease);
      }
      .value {
        font-size: 12px;
        font-weight: 600;
        color: var(--text);
      }
    `,
  ],
})
export class StackBarsComponent {
  readonly rows = input.required<StackRow[]>();

  private readonly max = computed(() =>
    Math.max(1, ...this.rows().map((r) => this.totalOf(r))),
  );

  totalOf(row: StackRow): number {
    return row.parts.reduce((s, p) => s + p.value, 0);
  }

  widthOf(value: number): number {
    return (Math.max(0, value) / this.max()) * 100;
  }

  titleOf(row: StackRow): string {
    return `${row.label} — ${row.parts
      .map((p) => `${p.name}: ${p.value}`)
      .join(', ')}`;
  }
}
