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

import {
  TuiAlertService,
  TuiButton,
  TuiDataList,
  TuiDropdown,
  TuiIcon,
  TuiLabel,
  TuiOption,
  TuiTextfield,
  TuiTextfieldComponent,
} from '@taiga-ui/core';
import { TuiHeader } from '@taiga-ui/layout';
import {
  TuiAvatar,
  TuiBadge,
  TuiBadgeNotification,
  TuiCheckbox,
  TuiChevron,
  TuiChip,
  TuiDataListWrapper,
  TuiFade,
  TuiSelect,
  TuiSelectOption,
  TuiSwitch,
  TuiTextarea,
  TuiTooltip,
} from '@taiga-ui/kit';
import { TuiDialog } from '@taiga-ui/experimental';

export const SHARED_TAIGA_IMPORTS = [
  // Core
  TuiButton,
  TuiDataList,
  TuiIcon,
  TuiLabel,
  TuiOption,
  TuiTextfieldComponent,
  ...TuiTextfield, // Spread the textfield array
  ...TuiDropdown,
  // Layout
  TuiHeader,
  // Kit
  TuiAvatar,
  TuiBadge,
  TuiBadgeNotification,
  TuiCheckbox,
  TuiChevron,
  TuiDataListWrapper,
  TuiFade,
  TuiSelect,
  TuiSelectOption,
  TuiSwitch,
  TuiTextarea,
  TuiTooltip,
  TuiDialog,
  TuiChip,
] as const;

// Services (inject these in your components)
export { TuiAlertService };
