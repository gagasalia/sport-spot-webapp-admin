/**
 * Common Taiga UI imports for standalone components
 * Import this array in your component's imports to use common Taiga UI components
 *
 * @example
 * ```typescript
 * import { SHARED_TAIGA_IMPORTS } from '@app/shared/shared.module';
 *
 * @Component({
 *   imports: [...SHARED_TAIGA_IMPORTS]
 * })
 * ```
 */

import { TuiAlertService, TuiButton, TuiIcon, TuiTextfield } from '@taiga-ui/core';
import { TuiHeader } from '@taiga-ui/layout';
import { TuiAvatar, TuiBadge, TuiBadgeNotification, TuiChevron, TuiFade } from '@taiga-ui/kit';

export const SHARED_TAIGA_IMPORTS = [
  // Core
  TuiButton,
  TuiIcon,
  TuiTextfield,
  // Layout
  TuiHeader,
  // Kit
  TuiAvatar,
  TuiBadge,
  TuiBadgeNotification,
  TuiChevron,
  TuiFade,
] as const;

// Services (inject these in your components)
export { TuiAlertService };
