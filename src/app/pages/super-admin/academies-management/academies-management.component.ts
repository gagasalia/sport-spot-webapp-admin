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
import { AcademyService } from '../../../services/http-services/academy.service';
import { Tenant } from '../../../shared/models/academy.model';
import { AcademyFormComponent } from './academy-form/academy-form.component';
import { WA_WINDOW } from '@ng-web-apis/common';

@Component({
  selector: 'app-academies-management',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS],
  templateUrl: './academies-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcademiesManagementComponent implements OnInit {
  private readonly academyService = inject(AcademyService);
  private readonly dialogs = inject(TuiDialogService);
  private readonly alerts = inject(TuiAlertService);
  private readonly injector = inject(Injector);
  private readonly window = inject(WA_WINDOW);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tenants = signal<Tenant[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isMobile = signal(this.window.innerWidth <= 768);

  @HostListener('window:resize')
  protected onResize(): void {
    this.isMobile.set(this.window.innerWidth <= 768);
  }

  ngOnInit(): void {
    this.loadTenants();
  }

  private loadTenants(): void {
    this.isLoading.set(true);
    this.academyService
      .getAllTenants()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tenants) => {
          this.tenants.set(tenants);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  protected addAcademy(): void {
    this.dialogs
      .open<Tenant | null>(new PolymorpheusComponent(AcademyFormComponent, this.injector), {
        label: 'აკადემიის დამატება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: {},
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result) {
          this.loadTenants();
        }
      });
  }

  protected editAcademy(tenant: Tenant): void {
    this.dialogs
      .open<Tenant | null>(new PolymorpheusComponent(AcademyFormComponent, this.injector), {
        label: 'აკადემიის რედაქტირება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: { tenant },
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result) {
          this.loadTenants();
        }
      });
  }

  protected deleteAcademy(tenant: Tenant): void {
    if (!tenant._id) return;

    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: 'აკადემიის წაშლა',
        size: 's',
        data: {
          content: `ნამდვილად გსურთ "${tenant.name}" - ის წაშლა?`,
          yes: 'წაშლა',
          no: 'გაუქმება',
        } as TuiConfirmData,
      })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => this.academyService.deleteTenant(tenant._id!)),
      )
      .subscribe({
        next: () => {
          this.tenants.update((list) => list.filter((t) => t._id !== tenant._id));
          this.alerts
            .open('აკადემია წარმატებით წაიშალა!', { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }
}
