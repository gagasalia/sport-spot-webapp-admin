import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  inject,
  Injector,
} from '@angular/core';
import { take } from 'rxjs';
import { TuiAlertService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { FacilityService } from '../../../services/http-services/facility.service';
import { TenantService } from '../../../shared/services/tenant.service';
import { Facility } from '../../../shared/models/facility.model';
import { SHARED_TAIGA_IMPORTS } from '../../../shared/shared.module';
import { FacilityFormComponent } from './facility-form/facility-form.component';
import { FacilityCardComponent } from './facility-card/facility-card.component';
import { TuiDialogService } from '@taiga-ui/experimental';

@Component({
  selector: 'app-facilities',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, FacilityCardComponent],
  templateUrl: './facilities.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacilitiesComponent implements OnInit {
  private readonly dialogs = inject(TuiDialogService);
  private readonly alerts = inject(TuiAlertService);
  private readonly injector = inject(Injector);
  private readonly facilityService = inject(FacilityService);
  private readonly tenant = inject(TenantService);

  facilities = signal<Facility[]>([]);
  isLoading = signal<boolean>(false);

  private facilityId(f: Facility): string | undefined {
    return f._id ?? f.id;
  }

  ngOnInit(): void {
    this.loadFacilities();
  }

  addFacility(): void {
    this.dialogs
      .open(new PolymorpheusComponent(FacilityFormComponent, this.injector), {
        label: 'ობიექტის დამატება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: {
          style: {
            height: '80vh',
            'max-height': '600px',
            overflow: 'hidden',
          },
        },
      })
      .pipe(take(1))
      .subscribe(() => {
        this.loadFacilities();
      });
  }

  onFacilityUpdated(updatedFacility: Facility): void {
    const updatedId = this.facilityId(updatedFacility);
    const currentFacilities = this.facilities();
    const index = currentFacilities.findIndex((f) => this.facilityId(f) === updatedId);
    if (index !== -1) {
      const updatedFacilities = [...currentFacilities];
      updatedFacilities[index] = updatedFacility;
      this.facilities.set(updatedFacilities);
    }
  }

  onEditFacility(facility: Facility): void {
    this.dialogs
      .open(new PolymorpheusComponent(FacilityFormComponent, this.injector), {
        label: 'რედაქტირება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: {
          facility,
          style: {
            height: '80vh',
            'max-height': '600px',
            overflow: 'hidden',
          },
        },
      })
      .pipe(take(1))
      .subscribe(() => {
        this.loadFacilities();
      });
  }

  private loadFacilities(): void {
    const academyId = this.tenant.academyId();
    if (!academyId) {
      this.facilities.set([]);
      return;
    }

    this.isLoading.set(true);
    this.facilityService
      .getFacilitiesByAcademy(academyId)
      .pipe(take(1))
      .subscribe({
        next: (facilities) => {
          this.facilities.set(facilities);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading facilities:', error);
          this.isLoading.set(false);
        },
      });
  }

  onDeleteFacility(facility: Facility): void {
    const facilityId = this.facilityId(facility);
    if (!facilityId) return;
    this.facilityService
      .deleteFacility(facilityId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.facilities.update((list) => list.filter((f) => this.facilityId(f) !== facilityId));
          this.alerts.open('ობიექტი წარმატებით წაიშალა', { appearance: 'success' }).subscribe();
        },
        error: (error) => {
          console.error('Error deleting facility:', error);
          this.alerts.open('წაშლის დროს მოხდა შეცდომა', { appearance: 'error' }).subscribe();
        },
      });
  }
}
