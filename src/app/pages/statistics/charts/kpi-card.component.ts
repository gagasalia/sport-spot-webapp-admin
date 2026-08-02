import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * One dashboard KPI: eyebrow label, big number, and an optional change badge
 * vs the previous period. `invert` flips the good/bad coloring for metrics
 * where growth is bad (cancellation rate).
 */
@Component({
  selector: 'ss-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ss-card kpi">
      <div class="ss-eyebrow georgian-text" lang="ka">{{ label() }}</div>
      <div class="kpi-value ss-num">{{ value() }}</div>
      @if (delta() !== null) {
        <div
          class="kpi-delta ss-num"
          [class.is-up]="delta()! > 0"
          [class.is-down]="delta()! < 0"
          [class.is-bad]="isBad()"
        >
          {{ delta()! > 0 ? '▲' : delta()! < 0 ? '▼' : '•' }}
          {{ deltaText() }}
        </div>
      } @else if (hint()) {
        <div class="kpi-hint georgian-text" lang="ka">{{ hint() }}</div>
      }
    </div>
  `,
  styles: [
    `
      .kpi {
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
      }
      .kpi-value {
        font-size: 26px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .kpi-delta {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-faint);
      }
      .kpi-delta.is-up {
        color: var(--success);
      }
      .kpi-delta.is-down {
        color: var(--danger);
      }
      /* inverted metrics: growing is bad, shrinking is good */
      .kpi-delta.is-up.is-bad {
        color: var(--danger);
      }
      .kpi-delta.is-down.is-bad {
        color: var(--success);
      }
      .kpi-hint {
        font-size: 11.5px;
        color: var(--text-faint);
      }
    `,
  ],
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  /** Fractional change vs previous period (0.25 = +25%), or null to hide. */
  readonly delta = input<number | null>(null);
  /** True when an INCREASE is bad news (e.g. cancellation rate). */
  readonly invert = input(false);
  /** Small print shown when no delta applies. */
  readonly hint = input('');

  readonly isBad = computed(() => this.invert());

  readonly deltaText = computed(() => {
    const d = this.delta();
    if (d === null) {
      return '';
    }
    return `${Math.abs(d * 100).toFixed(0)}%`;
  });
}
