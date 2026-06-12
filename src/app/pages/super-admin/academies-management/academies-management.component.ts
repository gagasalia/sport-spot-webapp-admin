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
import { Academy } from '../../../shared/models/academy.model';
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

  protected readonly academies = signal<Academy[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isMobile = signal(this.window.innerWidth <= 768);

  @HostListener('window:resize')
  protected onResize(): void {
    this.isMobile.set(this.window.innerWidth <= 768);
  }

  ngOnInit(): void {
    this.loadAcademies();
  }

  private loadAcademies(): void {
    this.isLoading.set(true);
    this.academyService
      .getAllAcademies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (academies) => {
          this.academies.set(academies);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  protected addAcademy(): void {
    this.dialogs
      .open<Academy | null>(new PolymorpheusComponent(AcademyFormComponent, this.injector), {
        label: 'აკადემიის დამატება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: {},
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result) {
          this.loadAcademies();
        }
      });
  }

  protected editAcademy(academy: Academy): void {
    this.dialogs
      .open<Academy | null>(new PolymorpheusComponent(AcademyFormComponent, this.injector), {
        label: 'აკადემიის რედაქტირება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: { academy },
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result) {
          this.loadAcademies();
        }
      });
  }

  protected formatAdmins(admins: Academy['admins']): string {
    return admins
      .map((a) => (typeof a === 'string' ? a : [a.firstName, a.lastName].filter(Boolean).join(' ')))
      .join(', ');
  }

  protected deleteAcademy(academy: Academy): void {
    if (!academy._id) return;

    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: 'აკადემიის წაშლა',
        size: 's',
        data: {
          content: `ნამდვილად გსურთ "${academy.name}" - ის წაშლა?`,
          yes: 'წაშლა',
          no: 'გაუქმება',
        } as TuiConfirmData,
      })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => this.academyService.deleteAcademy(academy._id!)),
      )
      .subscribe({
        next: () => {
          this.academies.update((list) => list.filter((a) => a._id !== academy._id));
          this.alerts
            .open('აკადემია წარმატებით წაიშალა!', { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }
}
