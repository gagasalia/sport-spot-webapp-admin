import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Client mirror of the API's phone acceptance rules (sport-spot-api
 * src/common/phone/phone.util.ts). Georgian numbers may be typed as
 * `+995XXXXXXXXX`, `995XXXXXXXXX` or the bare 9-digit national number, with
 * any spaces/dashes; any other country needs an explicit `+<country code>`
 * (or `00`) prefix. The server re-validates and stores canonical E.164.
 */

/** Collapses formatting to `+<digits>`/`<digits>`; rewrites a leading `00` to `+`. */
function stripFormatting(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (hasPlus) {
    return digits.length > 0 ? `+${digits}` : '';
  }
  if (digits.startsWith('00') && digits.length > 11) {
    return `+${digits.slice(2)}`;
  }
  return digits;
}

export function isAcceptablePhone(raw: string): boolean {
  const stripped = stripFormatting(raw);
  if (!stripped) {
    return false;
  }
  // Georgian shapes: +995 + 9 digits, 995 + 9 digits, bare 9-digit national.
  if (/^\+?995\d{9}$/.test(stripped) || /^\d{9}$/.test(stripped)) {
    return true;
  }
  // Foreign: explicit country code required; E.164 allows 8–15 digits total.
  return /^\+[1-9]\d{7,14}$/.test(stripped);
}

/** Reactive-forms validator — `{ phoneFormat: true }` when not acceptable. */
export function phoneFormatValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const value = control.value as string | null;
  // Emptiness is `required`'s job — don't double-report it here.
  if (!value || value.trim().length === 0) {
    return null;
  }
  return isAcceptablePhone(value) ? null : { phoneFormat: true };
}
