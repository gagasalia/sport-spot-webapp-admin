import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { tr } from '../i18n/lang';
import { TPipe } from '../i18n/t.pipe';
import { tierLabel } from '../utils/ranking-display.util';

const STAR_SLOTS = [1, 2, 3, 4, 5];

/**
 * The rank badge (docs/25 §2.8): a tier emblem 1–7 with its five-star row
 * and the tier's name, or a greyed "?" emblem while the player calibrates.
 *
 * The emblem is a PLACEHOLDER (a token-coloured shield whose fill deepens
 * with the tier) until the Claude Design pass delivers the real set — the
 * component API `{ tier, stars, calibrating }` is the stable seam, so the swap
 * touches this template only.
 */
@Component({
  selector: 'ss-tier-badge',
  standalone: true,
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="tb"
      [class.is-calibrating]="hidden()"
      [class.is-deep]="!hidden() && (tier() ?? 0) > 4"
      [style.--tb-mix]="mix()"
      [attr.title]="title()"
      data-testid="tier-badge"
    >
      <svg class="tb-emblem" viewBox="0 0 32 36" aria-hidden="true">
        <path
          class="tb-shield"
          d="M16 1.5 29.5 7v10.5c0 8-5.6 14-13.5 17-7.9-3-13.5-9-13.5-17V7z"
        />
        <text class="tb-num" x="16" y="23" text-anchor="middle">{{ hidden() ? '?' : tier() }}</text>
      </svg>
      <span class="tb-body">
        <span class="tb-name georgian-text" lang="ka" data-testid="tier-name">
          {{ hidden() ? ('კალიბრაცია' | t) : name() }}
        </span>
        @if (!hidden()) {
          <span class="tb-stars" aria-hidden="true" data-testid="tier-stars">
            @for (slot of starSlots; track slot) {
              <span class="tb-star" [class.is-on]="slot <= (stars() ?? 0)">★</span>
            }
          </span>
        }
      </span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .tb {
      --tb-mix: 30%;
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .tb-emblem {
      width: 34px;
      height: 38px;
      flex: 0 0 auto;
    }
    .tb-shield {
      fill: color-mix(in srgb, var(--accent) var(--tb-mix), transparent);
      stroke: var(--accent);
      stroke-width: 1.5;
    }
    .tb-num {
      font-family: var(--font-num);
      font-size: 13px;
      font-weight: 700;
      fill: var(--text);
    }
    .is-deep .tb-num {
      fill: var(--on-accent);
    }
    .is-calibrating .tb-shield {
      fill: var(--tui-background-neutral-1);
      stroke: var(--hairline-2);
      stroke-dasharray: 3 2;
    }
    .is-calibrating .tb-num {
      fill: var(--text-faint);
    }
    .tb-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .tb-name {
      font-weight: 600;
      font-size: 14px;
      line-height: 1.2;
    }
    .tb-stars {
      display: inline-flex;
      gap: 1px;
      font-size: 12px;
      line-height: 1;
    }
    .tb-star {
      color: var(--hairline-2);
    }
    .tb-star.is-on {
      color: var(--warning);
    }
  `,
})
export class SsTierBadgeComponent {
  /** 1–7; null while calibrating. */
  readonly tier = input<number | null>(null);
  /** 1–5; null while calibrating. */
  readonly stars = input<number | null>(null);
  readonly calibrating = input(false);

  protected readonly starSlots = STAR_SLOTS;

  /** Calibrating, or no tier yet: the greyed "?" emblem, no stars. */
  protected readonly hidden = computed(() => this.calibrating() || !tierLabel(this.tier()));
  protected readonly name = computed(() => tierLabel(this.tier()));

  /** Shield fill: tier 1 → 22 %, tier 7 → 100 % accent. */
  protected readonly mix = computed(() => {
    const tier = Math.min(7, Math.max(1, this.tier() ?? 1));
    return `${Math.round(22 + ((tier - 1) * 78) / 6)}%`;
  });

  protected readonly title = computed(() =>
    this.hidden() ? tr('კალიბრაცია') : `${this.name()} · ${this.stars() ?? 0}/5`,
  );
}
