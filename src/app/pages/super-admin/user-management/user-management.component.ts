import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  HostListener,
  OnInit,
  DestroyRef,
  Injector,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, switchMap, take } from 'rxjs';
import { TuiAlertService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { TuiDialogService } from '@taiga-ui/experimental';
import { TUI_CONFIRM, type TuiConfirmData } from '@taiga-ui/kit/components/confirm';
import { SHARED_TAIGA_IMPORTS } from '../../../shared/shared.module';
import { UserManagementService } from '../../../services/http-services/user-management.service';
import { User, UserType } from '../../../shared/models/user.model';
import { UserFormComponent } from './user-form/user-form.component';
import { WA_WINDOW } from '@ng-web-apis/common';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, DatePipe],
  templateUrl: './user-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserManagementComponent implements OnInit {
  private readonly userService = inject(UserManagementService);
  private readonly dialogs = inject(TuiDialogService);
  private readonly alerts = inject(TuiAlertService);
  private readonly injector = inject(Injector);
  private readonly window = inject(WA_WINDOW);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly users = signal<User[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isMobile = signal(this.window.innerWidth <= 768);

  @HostListener('window:resize')
  protected onResize(): void {
    this.isMobile.set(this.window.innerWidth <= 768);
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  private loadUsers(): void {
    this.isLoading.set(true);
    this.userService
      .findAllUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  protected addUser(): void {
    this.dialogs
      .open<User | null>(new PolymorpheusComponent(UserFormComponent, this.injector), {
        label: 'მომხმარებლის დამატება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: {},
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result) {
          this.loadUsers();
        }
      });
  }

  protected editUser(user: User): void {
    this.dialogs
      .open<User | null>(new PolymorpheusComponent(UserFormComponent, this.injector), {
        label: 'მომხმარებლის რედაქტირება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: { user },
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result) {
          this.loadUsers();
        }
      });
  }

  protected deleteUser(user: User): void {
    if (!user._id) return;

    const name = this.getFullName(user);

    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: 'მომხმარებლის წაშლა',
        size: 's',
        data: {
          content: `ნამდვილად გსურთ ${name} - ის წაშლა?`,
          yes: 'წაშლა',
          no: 'გაუქმება',
        } as TuiConfirmData,
      })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => this.userService.deleteUser(user._id!)),
      )
      .subscribe({
        next: () => {
          this.users.update((users) => users.filter((u) => u._id !== user._id));
          this.alerts
            .open('მომხმარებელი წარმატებით წაიშალა!', { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  protected getUserTypeLabel(types: UserType[]): string {
    return types?.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ') ?? '—';
  }

  protected getFullName(user: User): string {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '—';
  }

  protected getInitials(user: User): string {
    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase() || user.email.charAt(0).toUpperCase();
  }
}
