import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { TuiDialogService } from '@taiga-ui/experimental';
import { TuiAlertService } from '@taiga-ui/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SHARED_TAIGA_IMPORTS } from '../../../shared/shared.module';
import { Facility } from '../../../shared/models/facility.model';
import { ConfigurationService } from '../../../services/http-services/configuration.service';
import { Court } from '../../../shared/models/court.model';
import { CourtCardComponent } from './court-card/court-card.component';
import { CourtFormComponent } from './court-form/court-form.component';

@Component({
  selector: 'app-courts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ...SHARED_TAIGA_IMPORTS, CourtCardComponent],
  templateUrl: './courts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourtsComponent implements OnInit {
  private readonly dialogs = inject(TuiDialogService);
  private readonly alerts = inject(TuiAlertService);
  private readonly injector = inject(Injector);

  facilities = signal<Facility[]>([]);
  courts = signal<Court[]>([]);
  selectedFacilityId = signal<string | null>(null);
  loadingCourts = signal<boolean>(false);

  readonly selectedFacility = computed(() =>
    this.facilities().find((facility) => facility.id === this.selectedFacilityId()) || null
  );

  constructor(
    private configurationService: ConfigurationService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFacilities();
  }

  addCourt(): void {
    if (!this.selectedFacilityId()) {
      this.alerts.open('ჯერ აირჩიე ობიექტი', { appearance: 'warning' }).pipe(take(1)).subscribe();
      return;
    }

    this.dialogs
      .open(new PolymorpheusComponent(CourtFormComponent, this.injector), {
        label: 'კორტის დამატება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: { facilityId: this.selectedFacilityId() },
      })
      .pipe(take(1))
      .subscribe(() => {
        this.loadCourts(this.selectedFacilityId()!);
      });
  }

  onEditCourt(court: Court): void {
    this.dialogs
      .open(new PolymorpheusComponent(CourtFormComponent, this.injector), {
        label: 'კორტის რედაქტირება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: { facilityId: court.locationId, court },
      })
      .pipe(take(1))
      .subscribe((updatedCourt) => {
        if (updatedCourt) {
          this.replaceCourt(updatedCourt as Court);
        }
      });
  }

  onDeleteCourt(court: Court): void {
    this.configurationService
      .deleteCourt(court.locationId, court.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.loadCourts(court.locationId);
          this.alerts.open('კორტი წარმატებით წაიშალა', { appearance: 'success' }).subscribe();
        },
        error: () => {
          this.alerts.open('წაშლა ვერ მოხერხდა', { appearance: 'error' }).subscribe();
        },
      });
  }

  onFacilityChange(facilityId: string | null): void {
    this.selectedFacilityId.set(facilityId);
    this.updateQueryParams(facilityId);

    if (facilityId) {
      this.loadCourts(facilityId);
    } else {
      this.courts.set([]);
    }
  }

  private loadFacilities(): void {
    this.configurationService
      .getFacilities()
      .pipe(take(1))
      .subscribe({
        next: (facilities) => {
          this.facilities.set(facilities);
          this.applyInitialFacilitySelection(facilities);
        },
        error: () => {
          this.alerts.open('ობიექტების ჩამოტვირთვა ვერ მოხერხდა', { appearance: 'error' }).subscribe();
        },
      });
  }

  private applyInitialFacilitySelection(facilities: Facility[]): void {
    if (!facilities.length) {
      this.onFacilityChange(null);
      return;
    }

    const queryFacilityId = this.route.snapshot.queryParamMap.get('facilityId');
    const found = facilities.find((f) => f.id === queryFacilityId);

    if (facilities.length === 1) {
      this.onFacilityChange(facilities[0].id);
      return;
    }

    if (found) {
      this.onFacilityChange(found.id);
    } else {
      this.onFacilityChange(null);
    }
  }

  private updateQueryParams(facilityId: string | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { facilityId: facilityId || null },
      queryParamsHandling: 'merge',
    });
  }

  private loadCourts(facilityId: string): void {
    this.loadingCourts.set(true);
    this.configurationService
      .getCourtsByFacility(facilityId)
      .pipe(take(1))
      .subscribe({
        next: (courts) => {
          this.courts.set(courts);
          this.loadingCourts.set(false);
        },
        error: () => {
          this.loadingCourts.set(false);
          this.alerts.open('კორტების ჩამოტვირთვა ვერ მოხერხდა', { appearance: 'error' }).subscribe();
        },
      });
  }

  private replaceCourt(updatedCourt: Court): void {
    const current = this.courts();
    const index = current.findIndex((c) => c.id === updatedCourt.id);
    if (index !== -1) {
      const clone = [...current];
      clone[index] = updatedCourt;
      this.courts.set(clone);
    }
  }
}
