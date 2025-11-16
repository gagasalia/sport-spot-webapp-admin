import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { take } from 'rxjs';
import { TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { ConfigurationService } from '../../../services/http-services/configuration.service';
import { Facility } from '../../../shared/models/facility.model';
import { SHARED_TAIGA_IMPORTS } from '../../../shared/shared.module';
import { FacilityFormComponent } from './facility-form/facility-form.component';

@Component({
  selector: 'app-facilities',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS],
  templateUrl: './facilities.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacilitiesComponent implements OnInit {
  private readonly dialogs = inject(TuiDialogService);
  facilities = signal<Facility[]>([]);

  constructor(private configurationService: ConfigurationService) {}

  ngOnInit(): void {
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

  addFacility(): void {
    this.dialogs
      .open<void>(new PolymorpheusComponent(FacilityFormComponent), {
        label: 'ობიექტის დამატება',
        size: 'l',
      })
      .pipe(take(1))
      .subscribe();
  }
}
