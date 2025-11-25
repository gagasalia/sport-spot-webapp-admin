import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  inject,
  Injector,
} from '@angular/core';
import { take } from 'rxjs';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { ConfigurationService } from '../../../services/http-services/configuration.service';
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
  private readonly injector = inject(Injector);
  facilities = signal<Facility[]>([]);

  constructor(private configurationService: ConfigurationService) {}

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
        // Refresh the facilities list after dialog closes
        this.loadFacilities();
      });
  }

  onFacilityUpdated(updatedFacility: Facility): void {
    const currentFacilities = this.facilities();
    const index = currentFacilities.findIndex((f) => f.id === updatedFacility.id);
    if (index !== -1) {
      const updatedFacilities = [...currentFacilities];
      updatedFacilities[index] = updatedFacility;
      this.facilities.set(updatedFacilities);
    }
  }

  onEditFacility(facility: Facility): void {
    console.log('Editing facility:', facility);
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
    this.configurationService
      .getFacilities()
      .pipe(take(1))
      .subscribe({
        next: (facilities) => {
          this.facilities.set(facilities);
        },
        error: (error) => {
          console.error('Error loading facilities:', error);
        },
      });
  }
}
