import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  inject,
  Injector,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { TuiAlertService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { type TuiStringHandler } from '@taiga-ui/cdk';
import { ConfigurationService } from '../../../services/http-services/configuration.service';
import { Court } from '../../../shared/models/court.model';
import { Facility } from '../../../shared/models/facility.model';
import { SHARED_TAIGA_IMPORTS } from '../../../shared/shared.module';
import { CourtFormComponent } from './court-form/court-form.component';
import { CourtCardComponent } from './court-card/court-card.component';
import { TuiDialogService } from '@taiga-ui/experimental';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-courts',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, CourtCardComponent, CommonModule, ReactiveFormsModule],
  templateUrl: './courts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourtsComponent implements OnInit {
  private readonly dialogs = inject(TuiDialogService);
  private readonly alerts = inject(TuiAlertService);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  courts = signal<Court[]>([]);
  facilities = signal<Facility[]>([]);
  selectedFacilityId = signal<string | null>(null);
  isLoadingCourts = signal<boolean>(false);
  isLoadingFacilities = signal<boolean>(false);

  facilityControl = new FormControl<string | null>(null);

  readonly stringifyFacility: TuiStringHandler<string> = (id) => {
    const facility = this.facilities().find((f) => f.id === id);
    if (!facility) return '';
    return facility.description || facility.addressText || 'უსახელო ობიექტი';
  };

  constructor(private configurationService: ConfigurationService) {
    // Subscribe to form control changes
    this.facilityControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((facilityId) => {
      this.onFacilityChange(facilityId);
    });
  }

  ngOnInit(): void {
    this.loadFacilities();
  }

  private loadFacilities(): void {
    this.isLoadingFacilities.set(true);
    this.configurationService
      .getFacilities()
      .pipe(take(1))
      .subscribe({
        next: (facilities) => {
          this.facilities.set(facilities);
          this.isLoadingFacilities.set(false);
          // Handle facility selection based on the query param or number of facilities
          this.route.queryParams.pipe(take(1)).subscribe((params) => {
            const facilityIdFromQuery = params['facilityId'];

            if (facilities.length === 0) {
              // No facilities, do nothing
              this.selectedFacilityId.set(null);
              this.facilityControl.setValue(null, { emitEvent: false });
            } else if (facilities.length === 1) {
              // Exactly 1 facility, auto-select it
              const facility = facilities[0];
              const fId = facility.id ?? null;
              this.selectedFacilityId.set(fId);
              this.facilityControl.setValue(fId, { emitEvent: false });
              // Update query param if not already set
              if (facilityIdFromQuery !== fId) {
                this.updateQueryParam(fId);
              }
              if (fId) this.loadCourts(fId);
            } else {
              // More than 1 facility
              if (facilityIdFromQuery) {
                // If there's a query param, use it
                const facility = facilities.find((f) => f.id === facilityIdFromQuery);
                if (facility) {
                  const fId = facility.id ?? null;
                  this.selectedFacilityId.set(fId);
                  this.facilityControl.setValue(fId, { emitEvent: false });
                  if (fId) this.loadCourts(fId);
                } else {
                  // Invalid facilityId in query param, clear it
                  this.selectedFacilityId.set(null);
                  this.facilityControl.setValue(null, { emitEvent: false });
                  this.updateQueryParam(null);
                }
              } else {
                // No query param, user needs to select
                this.selectedFacilityId.set(null);
                this.facilityControl.setValue(null, { emitEvent: false });
              }
            }
          });
        },
        error: (error) => {
          console.error('Error loading facilities:', error);
          this.isLoadingFacilities.set(false);
        },
      });
  }

  onFacilityChange(facilityId: string | null): void {
    this.selectedFacilityId.set(facilityId);
    this.updateQueryParam(facilityId);
    if (facilityId) {
      this.loadCourts(facilityId);
    } else {
      this.courts.set([]);
    }
  }

  private updateQueryParam(facilityId: string | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { facilityId: facilityId || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private loadCourts(facilityId: string): void {
    this.isLoadingCourts.set(true);
    this.configurationService
      .getCourts(facilityId)
      .pipe(take(1))
      .subscribe({
        next: (courts) => {
          this.courts.set(courts);
          this.isLoadingCourts.set(false);
        },
        error: (error) => {
          console.error('Error loading courts:', error);
          this.isLoadingCourts.set(false);
        },
      });
  }

  addCourt(): void {
    const facilityId = this.selectedFacilityId();
    if (!facilityId) return;

    this.dialogs
      .open(new PolymorpheusComponent(CourtFormComponent, this.injector), {
        label: 'კორტის დამატება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: {
          facilityId,
          style: {
            height: '80vh',
            'max-height': '800px',
            overflow: 'hidden',
          },
        },
      })
      .pipe(take(1))
      .subscribe(() => {
        this.loadCourts(facilityId);
      });
  }

  onCourtUpdated(updatedCourt: Court): void {
    const currentCourts = this.courts();
    const index = currentCourts.findIndex((c) => c.id === updatedCourt.id);
    if (index !== -1) {
      const updatedCourts = [...currentCourts];
      updatedCourts[index] = updatedCourt;
      this.courts.set(updatedCourts);
    }
  }

  onEditCourt(court: Court): void {
    this.dialogs
      .open(new PolymorpheusComponent(CourtFormComponent, this.injector), {
        label: 'რედაქტირება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: {
          court,
          facilityId: court.facilityId,
          style: {
            height: '80vh',
            'max-height': '600px',
            overflow: 'hidden',
          },
        },
      })
      .pipe(take(1))
      .subscribe(() => {
        this.loadCourts(court.facilityId);
      });
  }

  onDeleteCourt(court: Court): void {
    this.configurationService
      .deleteCourt(court.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.loadCourts(court.facilityId);
          this.alerts.open('კორტი წარმატებით წაიშალა', { appearance: 'success' }).subscribe();
        },
        error: (error) => {
          console.error('Error deleting court:', error);
          this.alerts.open('წაშლის დროს მოხდა შეცდომა', { appearance: 'error' }).subscribe();
        },
      });
  }

  navigateToFacilities(): void {
    this.router.navigate(['/configuration/facilities']);
  }

  get selectedFacility(): Facility | undefined {
    const facilityId = this.selectedFacilityId();
    return facilityId ? this.facilities().find((f) => f.id === facilityId) : undefined;
  }
}
