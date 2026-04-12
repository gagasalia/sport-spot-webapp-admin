import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  HostListener,
  OnInit,
  DestroyRef,
  Injector,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Subject, filter, switchMap, take, debounceTime } from 'rxjs';
import { SKIP_LOADING } from '../../../shared/interceptors/loading.interceptor';
import { TuiAlertService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { TuiDialogService } from '@taiga-ui/experimental';
import { TUI_CONFIRM, type TuiConfirmData } from '@taiga-ui/kit/components/confirm';
import { SHARED_TAIGA_IMPORTS } from '../../../shared/shared.module';
import { UserManagementService } from '../../../services/http-services/user-management.service';
import { User, UserType, FilterUsersDto } from '../../../shared/models/user.model';
import { UserFormComponent } from './user-form/user-form.component';
import { FormsModule } from '@angular/forms';
import { WA_WINDOW } from '@ng-web-apis/common';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, DatePipe, FormsModule],
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
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  protected readonly users = signal<User[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isMobile = signal(this.window.innerWidth <= 768);

  protected readonly filterName = signal('');
  protected readonly filterEmail = signal('');
  protected readonly filterPhone = signal('');
  protected readonly filterPid = signal('');
  protected readonly filterRole = signal<UserType | null>(null);
  protected readonly roleOptions = Object.values(UserType);

  private readonly filterChanged$ = new Subject<void>();
  private initializing = true;

  constructor() {
    effect(() => {
      this.filterName();
      this.filterEmail();
      this.filterPhone();
      this.filterPid();
      this.filterRole();

      if (!this.initializing) {
        this.filterChanged$.next();
      }
    });
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.isMobile.set(this.window.innerWidth <= 768);
  }

  ngOnInit(): void {
    // 1. Read query params on init, populate signals, trigger initial search
    this.route.queryParams.pipe(take(1)).subscribe((params) => {
      if (params['name']) this.filterName.set(params['name']);
      if (params['email']) this.filterEmail.set(params['email']);
      if (params['phone']) this.filterPhone.set(params['phone']);
      if (params['pid']) this.filterPid.set(params['pid']);
      if (params['role']) this.filterRole.set(params['role'] as UserType);

      this.initializing = false;
      this.loadUsers(this.buildFilters());
    });

    // 2. Debounce filter signal changes → update URL silently + search
    this.filterChanged$
      .pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.syncUrlAndSearch();
      });
  }

  private loadUsers(filters: FilterUsersDto = {}, context?: HttpContext): void {
    if (!context) {
      this.isLoading.set(true);
    }
    this.userService
      .findAllUsers(filters, context)
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

  protected clearFilters(): void {
    this.filterName.set('');
    this.filterEmail.set('');
    this.filterPhone.set('');
    this.filterPid.set('');
    this.filterRole.set(null);

    this.replaceUrl({});
    this.loadUsers({}, new HttpContext().set(SKIP_LOADING, true));
  }

  private syncUrlAndSearch(): void {
    const filters = this.buildFilters();
    this.replaceUrl(filters);
    this.loadUsers(filters, new HttpContext().set(SKIP_LOADING, true));
  }

  private buildFilters(): FilterUsersDto {
    const filters: FilterUsersDto = {};
    const name = this.filterName().trim();
    const email = this.filterEmail().trim();
    const phone = this.filterPhone().trim();
    const pid = this.filterPid().trim();
    const role = this.filterRole();

    if (name) filters.name = name;
    if (email) filters.email = email;
    if (phone) filters.phone = phone;
    if (pid) filters.pid = pid;
    if (role) filters.userType = [role];
    return filters;
  }

  private replaceUrl(filters: FilterUsersDto): void {
    const params = new URLSearchParams();
    if (filters.name) params.set('name', filters.name);
    if (filters.email) params.set('email', filters.email);
    if (filters.phone) params.set('phone', filters.phone);
    if (filters.pid) params.set('pid', filters.pid);
    if (filters.userType?.length) params.set('role', filters.userType[0]);

    const query = params.toString();
    const path = this.route.snapshot.pathFromRoot
      .map((s) => s.url.map((u) => u.path).join('/'))
      .filter(Boolean)
      .join('/');
    this.location.replaceState('/' + path, query);
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
