import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { take } from 'rxjs';
import { type MaskitoOptions } from '@maskito/core';
import { MaskitoDirective } from '@maskito/angular';
import {
  maskitoPrefixPostprocessorGenerator,
  maskitoAddOnFocusPlugin,
  maskitoRemoveOnBlurPlugin,
} from '@maskito/kit';
import { UserManagementService } from '../../../../services/http-services/user-management.service';
import { CreateUserDto, User, UserType } from '../../../../shared/models/user.model';
import { arrayRequiredValidator } from '../../../../shared/validators/array-required.validator';
import {
  externalProviderNames,
  isExternallyLinked,
  isExternalOnly,
  isFacebookLinked,
  isGoogleLinked as userIsGoogleLinked,
} from '../../../../shared/utils/external-login.util';
import { SsProviderBadgesComponent } from '../../../../shared/ui/provider-badges.component';
import { liveLabels, tr } from '../../../../shared/i18n/lang';
import { TPipe } from '../../../../shared/i18n/t.pipe';

import { SsToastService } from '../../../../shared/ui/toast.service';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../../../shared/ui/dialog.service';
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, MaskitoDirective, SsProviderBadgesComponent, TPipe],
  templateUrl: './user-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormComponent implements OnInit {
  userForm!: FormGroup;

  readonly userTypes = Object.values(UserType);

  /** RAW-Georgian role labels; `liveLabels` translates on every read (never baked). */
  readonly userTypeLabels: Record<UserType, string> = liveLabels({
    [UserType.ADMIN]: 'ადმინი',
    [UserType.USER]: 'მომხმარებელი',
    [UserType.SUPERADMIN]: 'სუპერადმინი',
    [UserType.ORGANIZER]: 'ორგანიზატორი',
  });

  readonly phoneMask: MaskitoOptions = {
    mask: ['+', '9', '9', '5', /[5]/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/],
    postprocessors: [maskitoPrefixPostprocessorGenerator('+995')],
    plugins: [maskitoAddOnFocusPlugin('+995'), maskitoRemoveOnBlurPlugin('+995')],
  };

  readonly pidMask: MaskitoOptions = {
    mask: [/\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/],
  };

  private readonly context = inject(SS_DIALOG_CONTEXT) as SsDialogContext<
    User | null,
    { user?: User }
  >;
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserManagementService);
  private readonly alerts = inject(SsToastService);

  protected get isEditMode(): boolean {
    return !!this.context.data?.user;
  }

  ngOnInit(): void {
    const editingUser = this.context.data?.user;

    // Native-date 'YYYY-MM-DD' string ('' = unset), local wall-clock.
    let dateOfBirth = '';
    if (editingUser?.dateOfBirth) {
      const d = new Date(editingUser.dateOfBirth);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        dateOfBirth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
    }

    const phoneValue = this.formatPhoneForDisplay(editingUser?.phone || '');

    this.userForm = this.fb.group({
      // A Google-linked player's email belongs to the Google account (docs/29):
      // disabled → shown but never submitted, so an edit cannot rewrite it.
      // Any externally linked player (Google/Facebook) may have no email —
      // Facebook does not always share one (docs/30) — so it is not required.
      email: [
        { value: editingUser?.email || '', disabled: this.isGoogleLinked },
        this.isEmailOptional ? [Validators.email] : [Validators.required, Validators.email],
      ],
      password: ['', editingUser ? [] : [Validators.required, Validators.minLength(6)]],
      firstName: [editingUser?.firstName || ''],
      lastName: [editingUser?.lastName || ''],
      phone: [phoneValue],
      username: [editingUser?.username || ''],
      pid: [editingUser?.pid || '', [Validators.pattern(/^\d{11}$/)]],
      dateOfBirth: [dateOfBirth],
      userType: [editingUser?.userType?.length ? [...editingUser.userType] : [UserType.USER], [arrayRequiredValidator]],
    });
    this.applyIdentityValidators();
  }

  /**
   * Player/operator identity split (mirrors the API rule): operator accounts
   * — admin, superadmin and the tournament maker (organizer, docs/33 §6) —
   * sign in by USERNAME and carry no phone; player accounts sign in by PHONE
   * and carry no username. Only the active identity field is validated (and
   * submitted).
   */
  protected get isAdminAccount(): boolean {
    const roles: UserType[] = this.userForm?.get('userType')?.value ?? [];
    return (
      roles.includes(UserType.ADMIN) ||
      roles.includes(UserType.SUPERADMIN) ||
      roles.includes(UserType.ORGANIZER)
    );
  }

  /** The edited account can sign in with Google (docs/29) — it owns the email. */
  protected get isGoogleLinked(): boolean {
    return userIsGoogleLinked(this.context.data?.user);
  }

  /** The edited account can sign in with Google and/or Facebook. */
  protected get isExternallyLinked(): boolean {
    return isExternallyLinked(this.context.data?.user);
  }

  /** The edited account (undefined in create mode) — feeds the provider chips. */
  protected get editedUser(): User | undefined {
    return this.context.data?.user;
  }

  /**
   * Facebook-linked, not Google-linked, and no email on file (docs/30 §0.3):
   * the email stays editable and optional.
   */
  protected get isFacebookWithoutEmail(): boolean {
    const user = this.context.data?.user;
    return isFacebookLinked(user) && !this.isGoogleLinked && !user?.email;
  }

  /**
   * Email is optional for any externally linked account: Google's is locked
   * anyway, and a Facebook account may share none (docs/30 §0.3). An empty
   * value is never sent.
   */
  protected get isEmailOptional(): boolean {
    return this.isExternallyLinked;
  }

  /**
   * An external-only player (signed up with Google — docs/29 — or Facebook —
   * docs/30 — and no phone yet) is a valid player: the API rule is "phone OR
   * googleId OR facebookId". The phone stays optional for them; a player that
   * already HAS a phone keeps it required (there is no path that removes a
   * phone).
   */
  protected get isPhoneOptional(): boolean {
    return !this.isAdminAccount && isExternalOnly(this.context.data?.user);
  }

  /**
   * "Signed up with Facebook and has no phone yet …" — rebuilt on every read so
   * a language switch re-translates it (never baked).
   */
  protected get phoneOptionalHint(): string {
    return tr(
      '%s-ით დარეგისტრირებულ მოთამაშეს ტელეფონი ჯერ არ აქვს — ველი შეიძლება ცარიელი დარჩეს',
    ).replace('%s', () => externalProviderNames(this.context.data?.user));
  }

  private applyIdentityValidators(): void {
    const phone = this.userForm.get('phone');
    const username = this.userForm.get('username');
    if (this.isAdminAccount) {
      phone?.clearValidators();
      username?.setValidators([
        Validators.required,
        Validators.pattern(/^[a-zA-Z0-9._-]{3,32}$/),
      ]);
    } else {
      username?.clearValidators();
      const format = Validators.pattern(/^\+9955\d{8}$/);
      phone?.setValidators(this.isPhoneOptional ? [format] : [Validators.required, format]);
    }
    phone?.updateValueAndValidity({ emitEvent: false });
    username?.updateValueAndValidity({ emitEvent: false });
  }

  private formatPhoneForDisplay(phone: string): string {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('995') && digits.length >= 4) {
      return '+995' + digits.slice(3);
    }
    if (digits.startsWith('5') && digits.length >= 1) {
      return '+995' + digits;
    }
    return '';
  }

  private extractPhoneDigits(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  onSubmit(): void {
    if (this.userForm.invalid) return;

    const formValue = this.userForm.value;
    const editingUser = this.context.data?.user;
    // 'YYYY-MM-DD' → local-midnight instant (same semantics as the old TuiDay
    // toLocalNativeDate path); '' stays undefined.
    let dateOfBirth: string | undefined;
    if (formValue.dateOfBirth) {
      const [y, m, d] = String(formValue.dateOfBirth).split('-').map(Number);
      dateOfBirth = new Date(y, m - 1, d).toISOString();
    }
    // Only the identity field the account kind uses is sent — the API rejects
    // a phone on admin accounts and a username on player accounts, and $unsets
    // the leftover field itself when a role changes. An EMPTY phone (only
    // reachable for an external-only player) is omitted, never sent as '' —
    // the account keeps its Google/Facebook identity untouched.
    const phoneDigits = this.extractPhoneDigits(String(formValue.phone ?? ''));
    const identity = this.isAdminAccount
      ? { username: String(formValue.username).trim().toLowerCase() }
      : phoneDigits
        ? { phone: phoneDigits }
        : {};
    // Disabled (Google-owned) email is absent from `value`; an empty one (only
    // valid on an externally linked account, e.g. Facebook without email) is
    // omitted too — never sent as ''.
    const email = String(formValue.email ?? '').trim();

    if (editingUser?._id) {
      const updateDto = {
        ...(email ? { email } : {}),
        firstName: formValue.firstName || undefined,
        lastName: formValue.lastName || undefined,
        ...identity,
        pid: formValue.pid || undefined,
        dateOfBirth,
        userType: formValue.userType,
        ...(formValue.password ? { password: formValue.password } : {}),
      };

      this.userService
        .updateUser(editingUser._id, updateDto)
        .pipe(take(1))
        .subscribe({
          next: (savedUser) => {
            this.alerts
              .open(tr('მომხმარებელი წარმატებით განახლდა!'), { appearance: 'success' })
              .pipe(take(1))
              .subscribe();
            this.context.completeWith(savedUser);
          },
          error: () => {
            this.alerts
              .open(tr('შეცდომა მომხმარებლის განახლებისას.'), { appearance: 'error' })
              .pipe(take(1))
              .subscribe();
          },
        });
    } else {
      const createDto: CreateUserDto = {
        email: formValue.email,
        password: formValue.password,
        firstName: formValue.firstName || undefined,
        lastName: formValue.lastName || undefined,
        ...identity,
        pid: formValue.pid || undefined,
        dateOfBirth,
        userType: formValue.userType,
      };

      this.userService
        .createUser(createDto)
        .pipe(take(1))
        .subscribe({
          next: (savedUser) => {
            this.alerts
              .open(tr('მომხმარებელი წარმატებით დაემატა!'), { appearance: 'success' })
              .pipe(take(1))
              .subscribe();
            this.context.completeWith(savedUser);
          },
          error: () => {
            this.alerts
              .open(tr('შეცდომა მომხმარებლის დამატებისას.'), { appearance: 'error' })
              .pipe(take(1))
              .subscribe();
          },
        });
    }
  }

  /** Role checkbox helpers (multi-role selection without a multiselect widget). */
  protected isRoleChecked(type: UserType): boolean {
    return (this.userForm.get('userType')?.value ?? []).includes(type);
  }

  protected toggleRole(type: UserType): void {
    const control = this.userForm.get('userType');
    const current: UserType[] = control?.value ?? [];
    let next: UserType[];
    if (current.includes(type)) {
      next = current.filter((t) => t !== type);
    } else if (type === UserType.USER) {
      // Player and admin roles are mutually exclusive (API identity split):
      // an admin's phone must never occupy a player registration slot and
      // vice versa, so picking one side drops the other.
      next = [UserType.USER];
    } else {
      next = [...current.filter((t) => t !== UserType.USER), type];
    }
    control?.setValue(next);
    control?.markAsTouched();
    // The required identity field follows the account kind.
    this.applyIdentityValidators();
  }

  onCancel(): void {
    this.context.completeWith(null);
  }
}
