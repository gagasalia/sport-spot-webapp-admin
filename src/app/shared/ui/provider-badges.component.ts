import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  EXTERNAL_PROVIDER_LABELS,
  IdentityFields,
  externalProviders,
} from '../utils/external-login.util';

/**
 * One neutral chip per external sign-in provider linked to the account
 * ("Google", "Facebook" — docs/29, docs/30). Brand names are shown as-is in
 * both languages. Each chip carries `automation-id="<provider>-badge"`
 * (`google-badge`, `facebook-badge`). Renders nothing — and collapses its host
 * so a surrounding flex gap does not leave a hole — when no provider is linked.
 */
@Component({
  // ss-* = the in-house UI kit prefix (ss-avatar, ss-academy-select, …).
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'ss-provider-badges',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-empty]': 'providers().length === 0' },
  template: `
    @for (p of providers(); track p) {
      <span class="ss-badge ss-badge--neutral" [attr.automation-id]="p + '-badge'">{{
        labels[p]
      }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 4px;
    }
    :host(.is-empty) {
      display: none;
    }
  `,
})
export class SsProviderBadgesComponent {
  /** Any row/profile/user carrying the identity flags. */
  readonly account = input<IdentityFields | null | undefined>(null);

  protected readonly providers = computed(() => externalProviders(this.account()));
  protected readonly labels = EXTERNAL_PROVIDER_LABELS;
}
