import { ValidatorFn } from '@angular/forms';

/**
 * A GEL amount with at most two decimals (it becomes integer tetri at the
 * edge, money.util). An empty value passes — pair with `required` if needed.
 */
export const gelAmountValidator: ValidatorFn = (control) => {
  if (control.value == null || control.value === '') return null;
  const cents = Number(control.value) * 100;
  return Number.isFinite(cents) && Math.abs(cents - Math.round(cents)) < 1e-6
    ? null
    : { decimals: true };
};
