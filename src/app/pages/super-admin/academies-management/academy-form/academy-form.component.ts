import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { type TuiStringHandler } from '@taiga-ui/cdk';
import { TuiAlertService } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/experimental';
import { TuiInputColor } from '@taiga-ui/kit/components/input-color';
import { SHARED_TAIGA_IMPORTS } from '../../../../shared/shared.module';
import { AcademyService } from '../../../../services/http-services/academy.service';
import { UserManagementService } from '../../../../services/http-services/user-management.service';
import { Academy } from '../../../../shared/models/academy.model';
import { User, UserType } from '../../../../shared/models/user.model';

@Component({
  selector: 'app-academy-form',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, ReactiveFormsModule, CommonModule, TuiInputColor],
  templateUrl: './academy-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcademyFormComponent implements OnInit {
  academyForm!: FormGroup;

  protected readonly adminUsers = signal<User[]>([]);
  protected readonly isLoadingUsers = signal(true);

  readonly stringifyUser: TuiStringHandler<User> = (user) => {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return name ? `${name} (${user.email})` : user.email;
  };

  private readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<
    Academy | null,
    { academy?: Academy }
  >;
  private readonly fb = inject(FormBuilder);
  private readonly academyService = inject(AcademyService);
  private readonly userService = inject(UserManagementService);
  private readonly alerts = inject(TuiAlertService);

  protected get isEditMode(): boolean {
    return !!this.context.data?.academy;
  }

  ngOnInit(): void {
    const a = this.context.data?.academy;

    this.academyForm = this.fb.group({
      name: [a?.name || '', Validators.required],
      owner: [null, this.isEditMode ? [] : [Validators.required]],
      description: [a?.description || ''],
      designPalette: [a?.designPalette || ''],
      logo: this.fb.group({
        url: [a?.logo?.url || ''],
      }),
      contactInfo: this.fb.group({
        email: [a?.contactInfo?.email || ''],
        phone: [a?.contactInfo?.phone || ''],
        facebook: [a?.contactInfo?.facebook || ''],
        instagram: [a?.contactInfo?.instagram || ''],
      }),
    });

    this.userService
      .findAllUsers('admin')
      .pipe(take(1))
      .subscribe({
        next: (users) => {
          const filtered = users.filter((u) =>
            u.userType?.some((type) => type === UserType.ADMIN || type === UserType.SUPERADMIN),
          );
          this.adminUsers.set(filtered);
          this.isLoadingUsers.set(false);
        },
        error: () => {
          this.isLoadingUsers.set(false);
        },
      });
  }

  onSubmit(): void {
    if (this.academyForm.invalid) return;

    const v = this.academyForm.value;
    const a = this.context.data?.academy;

    const contactInfo = {
      email: v.contactInfo.email || undefined,
      phone: v.contactInfo.phone || undefined,
      facebook: v.contactInfo.facebook || undefined,
      instagram: v.contactInfo.instagram || undefined,
    };

    const logo = {
      url: v.logo.url || '',
      type: '',
      size: 0,
    };

    if (a?._id) {
      const updateDto = { name: v.name, description: v.description, designPalette: v.designPalette, logo, contactInfo };

      this.academyService
        .updateAcademy(a._id, updateDto)
        .pipe(take(1))
        .subscribe({
          next: (saved) => {
            this.alerts.open('აკადემია წარმატებით განახლდა!', { appearance: 'success' }).pipe(take(1)).subscribe();
            (this.context as any).completeWith(saved);
          },
          error: () => {
            this.alerts.open('შეცდომა აკადემიის განახლებისას.', { appearance: 'error' }).pipe(take(1)).subscribe();
          },
        });
    } else {
      const createDto = { name: v.name, owner: v.owner._id, description: v.description, designPalette: v.designPalette, logo, contactInfo };

      this.academyService
        .createAcademy(createDto as any)
        .pipe(take(1))
        .subscribe({
          next: (saved) => {
            this.alerts.open('აკადემია წარმატებით დაემატა!', { appearance: 'success' }).pipe(take(1)).subscribe();
            (this.context as any).completeWith(saved);
          },
          error: () => {
            this.alerts.open('შეცდომა აკადემიის დამატებისას.', { appearance: 'error' }).pipe(take(1)).subscribe();
          },
        });
    }
  }

  onCancel(): void {
    (this.context as any).completeWith(null);
  }
}
