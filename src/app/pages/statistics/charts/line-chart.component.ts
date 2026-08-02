import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface LinePoint {
  label: string;
  value: number;
  /** Preformatted value for the tooltip (defaults to the raw number). */
  display?: string;
}

/**
 * Dependency-free SVG line chart: gradient area + accent line + hoverable
 * points (native <title> tooltips). Scales to its container width via
 * viewBox. Parents handle the empty state — zero points renders nothing.
 */
@Component({
  selector: 'ss-line-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (points().length > 0) {
      <svg
        class="chart"
        [attr.viewBox]="'0 0 ' + W + ' ' + H"
        preserveAspectRatio="none"
        role="img"
      >
        <defs>
          <linearGradient [attr.id]="gradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.28" />
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
          </linearGradient>
        </defs>
        @for (g of gridYs; track g) {
          <line
            [attr.x1]="PAD"
            [attr.x2]="W - PAD"
            [attr.y1]="g"
            [attr.y2]="g"
            class="grid"
          />
        }
        <path [attr.d]="areaPath()" [attr.fill]="'url(#' + gradId + ')'" />
        <path [attr.d]="linePath()" class="line" />
        @for (p of coords(); track p.label) {
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="7" class="dot-hit">
            <title>{{ p.label }} — {{ p.display }}</title>
          </circle>
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="2.6" class="dot" />
        }
      </svg>
      <div class="x-labels ss-num">
        <span>{{ points()[0].label }}</span>
        @if (points().length > 2) {
          <span>{{ points()[midIndex()].label }}</span>
        }
        @if (points().length > 1) {
          <span>{{ points()[points().length - 1].label }}</span>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .chart {
        display: block;
        width: 100%;
        height: 190px;
      }
      .grid {
        stroke: var(--hairline);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .line {
        fill: none;
        stroke: var(--accent);
        stroke-width: 2.25;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
      }
      .dot {
        fill: var(--accent);
        vector-effect: non-scaling-stroke;
      }
      .dot-hit {
        fill: transparent;
        cursor: default;
      }
      .dot-hit:hover + .dot {
        fill: var(--accent-hover);
      }
      .x-labels {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-top: 6px;
        font-size: 11px;
        color: var(--text-faint);
      }
    `,
  ],
})
export class LineChartComponent {
  readonly points = input.required<LinePoint[]>();

  readonly W = 600;
  readonly H = 190;
  readonly PAD = 10;
  readonly gradId = `ss-line-grad-${Math.random().toString(36).slice(2, 8)}`;
  readonly gridYs = [0.25, 0.5, 0.75].map(
    (f) => this.PAD + (this.H - 2 * this.PAD) * f,
  );

  readonly midIndex = computed(() => Math.floor((this.points().length - 1) / 2));

  readonly coords = computed(() => {
    const pts = this.points();
    const innerW = this.W - 2 * this.PAD;
    const innerH = this.H - 2 * this.PAD;
    const max = Math.max(1, ...pts.map((p) => Math.abs(p.value)));
    const min = Math.min(0, ...pts.map((p) => p.value));
    const span = max - min || 1;
    return pts.map((p, i) => ({
      x:
        pts.length === 1
          ? this.PAD + innerW / 2
          : this.PAD + (innerW * i) / (pts.length - 1),
      y: this.PAD + innerH - ((p.value - min) / span) * innerH,
      label: p.label,
      display: p.display ?? String(p.value),
    }));
  });

  readonly linePath = computed(() =>
    this.coords()
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' '),
  );

  readonly areaPath = computed(() => {
    const pts = this.coords();
    if (pts.length === 0) {
      return '';
    }
    const base = this.H - this.PAD;
    return (
      `M${pts[0].x.toFixed(1)},${base} ` +
      pts.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
      ` L${pts[pts.length - 1].x.toFixed(1)},${base} Z`
    );
  });
}
