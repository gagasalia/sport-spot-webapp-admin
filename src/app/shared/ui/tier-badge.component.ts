import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { tr } from '../i18n/lang';
import { TPipe } from '../i18n/t.pipe';
import { tierLabel } from '../utils/ranking-display.util';

const STAR_SLOTS = [1, 2, 3, 4, 5];

/**
 * Star colour per tier, from the emblem set's palette (copper, steel, gold,
 * platinum, emerald, ruby, diamond) — the same values as the player app.
 */
const STAR_COLORS: readonly string[] = [
  '#c07a4f',
  '#7a8793',
  '#d4a13a',
  '#8e9aa7',
  '#2fb37a',
  '#e04a63',
  '#6f9ee8',
];

/**
 * The rank badge (docs/25 §2.8): the tier's emblem 1–7
 * (`public/assets/ranking/tier-<n>.svg`) with its five-star row directly
 * under it and the tier's name beside, or the set's greyed neutral crest
 * while the player calibrates.
 *
 * The component API `{ tier, stars, calibrating }` is the stable seam — a new
 * emblem set replaces the asset files and `STAR_COLORS` only.
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
      [attr.title]="title()"
      data-testid="tier-badge"
    >
      <span class="tb-rank">
        <img class="tb-emblem" [src]="emblem()" width="36" height="44" alt="" draggable="false" />
        @if (!hidden()) {
          <span
            class="tb-stars"
            aria-hidden="true"
            data-testid="tier-stars"
            [style.--tb-star]="starColor()"
          >
            @for (slot of starSlots; track slot) {
              <svg class="tb-star" [class.is-on]="slot <= (stars() ?? 0)" viewBox="0 0 24 24">
                <path
                  d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"
                />
              </svg>
            }
          </span>
        }
      </span>
      <span class="tb-name georgian-text" lang="ka" data-testid="tier-name">
        {{ hidden() ? ('კალიბრაცია' | t) : name() }}
      </span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .tb {
      display: inline-flex;
      align-items: center;
      gap: 12px;
    }
    .tb-rank {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      flex: 0 0 auto;
      line-height: 0;
    }
    .tb-emblem {
      display: block;
      width: 36px;
      height: 44px;
    }
    .is-calibrating .tb-emblem {
      opacity: 0.45;
    }
    .tb-name {
      font-weight: 600;
      font-size: 14px;
      line-height: 1.2;
    }
    .tb-stars {
      display: inline-flex;
      gap: 1px;
    }
    .tb-star {
      width: 7px;
      height: 7px;
      fill: var(--tb-star);
      opacity: 0.28;
    }
    .tb-star.is-on {
      opacity: 1;
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

  /** Calibrating, or no tier yet: the greyed neutral crest, no stars. */
  protected readonly hidden = computed(() => this.calibrating() || !tierLabel(this.tier()));
  protected readonly name = computed(() => tierLabel(this.tier()));

  protected readonly emblem = computed(() =>
    this.hidden() ? 'assets/ranking/calibrating.svg' : `assets/ranking/tier-${this.tier()}.svg`,
  );
  protected readonly starColor = computed(() => STAR_COLORS[(this.tier() ?? 1) - 1]);

  protected readonly title = computed(() =>
    this.hidden() ? tr('კალიბრაცია') : `${this.name()} · ${this.stars() ?? 0}/5`,
  );
}
