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
import { type TuiStringHandler } from '@taiga-ui/cdk';
import { TuiDay } from '@taiga-ui/cdk/date-time';
import { TuiAlertService } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/experimental';
import { TuiInputDate } from '@taiga-ui/kit/components/input-date';
import { TuiMultiSelect } from '@taiga-ui/kit';
import { SHARED_TAIGA_IMPORTS } from '../../../../shared/shared.module';
import { UserManagementService } from '../../../../services/http-services/user-management.service';
import { CreateUserDto, User, UserType } from '../../../../shared/models/user.model';
import { arrayRequiredValidator } from '../../../../shared/validators/array-required.validator';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    ...SHARED_TAIGA_IMPORTS,
    ...TuiMultiSelect,
    ReactiveFormsModule,
    CommonModule,
    ...TuiInputDate,
    MaskitoDirective,
  ],
  templateUrl: './user-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormComponent implements OnInit {
  userForm!: FormGroup;

  readonly userTypes = Object.values(UserType);

  readonly userTypeLabels: Record<UserType, string> = {
    [UserType.ADMIN]: 'ადმინი',
    [UserType.USER]: 'მომხმარებელი',
    [UserType.SUPERADMIN]: 'სუპერადმინი',
  };

  readonly stringifyUserType: TuiStringHandler<UserType> = (type) =>
    this.userTypeLabels[type] || '';

  readonly phoneMask: MaskitoOptions = {
    mask: ['+', '9', '9', '5', /[5]/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/],
    postprocessors: [maskitoPrefixPostprocessorGenerator('+995')],
    plugins: [maskitoAddOnFocusPlugin('+995'), maskitoRemoveOnBlurPlugin('+995')],
  };

  readonly pidMask: MaskitoOptions = {
    mask: [/\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/],
  };

  private readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<
    User | null,
    { user?: User }
  >;
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserManagementService);
  private readonly alerts = inject(TuiAlertService);

  protected get isEditMode(): boolean {
    return !!this.context.data?.user;
  }

  ngOnInit(): void {
    const editingUser = this.context.data?.user;

    let dateOfBirth: TuiDay | null = null;
    if (editingUser?.dateOfBirth) {
      const d = new Date(editingUser.dateOfBirth);
      if (!isNaN(d.getTime())) {
        dateOfBirth = new TuiDay(d.getFullYear(), d.getMonth(), d.getDate());
      }
    }

    const phoneValue = this.formatPhoneForDisplay(editingUser?.phone || '');

    this.userForm = this.fb.group({
      email: [editingUser?.email || '', [Validators.required, Validators.email]],
      password: ['', editingUser ? [] : [Validators.required, Validators.minLength(6)]],
      firstName: [editingUser?.firstName || ''],
      lastName: [editingUser?.lastName || ''],
      phone: [phoneValue, [Validators.required, Validators.pattern(/^\+9955\d{8}$/)]],
      pid: [editingUser?.pid || '', [Validators.pattern(/^\d{11}$/)]],
      dateOfBirth: [dateOfBirth],
      userType: [editingUser?.userType?.length ? [...editingUser.userType] : [UserType.USER], [arrayRequiredValidator]],
    });
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
    const dateOfBirth =
      formValue.dateOfBirth instanceof TuiDay
        ? formValue.dateOfBirth.toLocalNativeDate().toISOString()
        : formValue.dateOfBirth || undefined;
    const phone = this.extractPhoneDigits(formValue.phone);

    if (editingUser?._id) {
      const updateDto = {
        email: formValue.email,
        firstName: formValue.firstName || undefined,
        lastName: formValue.lastName || undefined,
        phone,
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
              .open('მომხმარებელი წარმატებით განახლდა!', { appearance: 'success' })
              .pipe(take(1))
              .subscribe();
            this.context.completeWith(savedUser);
          },
          error: () => {
            this.alerts
              .open('შეცდომა მომხმარებლის განახლებისას.', { appearance: 'error' })
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
        phone,
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
              .open('მომხმარებელი წარმატებით დაემატა!', { appearance: 'success' })
              .pipe(take(1))
              .subscribe();
            this.context.completeWith(savedUser);
          },
          error: () => {
            this.alerts
              .open('შეცდომა მომხმარებლის დამატებისას.', { appearance: 'error' })
              .pipe(take(1))
              .subscribe();
          },
        });
    }
  }

  onCancel(): void {
    this.context.completeWith(null);
  }
}
