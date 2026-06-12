import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Validator that requires the control's value to be a non-empty array.
 * Returns `{ required: true }` when the value is not an array or is empty.
 */
export function arrayRequiredValidator(control: AbstractControl): ValidationErrors | null {
  return Array.isArray(control.value) && control.value.length > 0 ? null : { required: true };
}
