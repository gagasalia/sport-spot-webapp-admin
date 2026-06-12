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
import { CourtService } from '../../../services/http-services/court.service';
import { FacilityService } from '../../../services/http-services/facility.service';
import { TenantService } from '../../../shared/services/tenant.service';
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
  private readonly courtService = inject(CourtService);
  private readonly facilityService = inject(FacilityService);
  private readonly tenant = inject(TenantService);

  courts = signal<Court[]>([]);
  facilities = signal<Facility[]>([]);
  selectedFacilityId = signal<string | null>(null);
  isLoadingCourts = signal<boolean>(false);
  isLoadingFacilities = signal<boolean>(false);

  facilityControl = new FormControl<string | null>(null);

  /** Resolve a facility's id from either API (`_id`) or legacy (`id`) shape. */
  private facilityId(f: Facility): string | null {
    return f._id ?? f.id ?? null;
  }

  readonly stringifyFacility: TuiStringHandler<string> = (id) => {
    const facility = this.facilities().find((f) => this.facilityId(f) === id);
    if (!facility) return '';
    return facility.name || facility.description || 'უსახელო ობიექტი';
  };

  constructor() {
    this.facilityControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((facilityId) => {
      this.onFacilityChange(facilityId);
    });
  }

  ngOnInit(): void {
    this.loadFacilities();
  }

  private loadFacilities(): void {
    const academyId = this.tenant.academyId();
    if (!academyId) {
      this.facilities.set([]);
      this.selectedFacilityId.set(null);
      return;
    }

    this.isLoadingFacilities.set(true);
    this.facilityService
      .getFacilitiesByAcademy(academyId)
      .pipe(take(1))
      .subscribe({
        next: (facilities) => {
          this.facilities.set(facilities);
          this.isLoadingFacilities.set(false);
          this.resolveSelection(facilities);
        },
        error: (error) => {
          console.error('Error loading facilities:', error);
          this.isLoadingFacilities.set(false);
        },
      });
  }

  private resolveSelection(facilities: Facility[]): void {
    this.route.queryParams.pipe(take(1)).subscribe((params) => {
      const facilityIdFromQuery = params['facilityId'];

      if (facilities.length === 0) {
        this.selectedFacilityId.set(null);
        this.facilityControl.setValue(null, { emitEvent: false });
      } else if (facilities.length === 1) {
        const fId = this.facilityId(facilities[0]);
        this.selectedFacilityId.set(fId);
        this.facilityControl.setValue(fId, { emitEvent: false });
        if (facilityIdFromQuery !== fId) {
          this.updateQueryParam(fId);
        }
        if (fId) this.loadCourts(fId);
      } else if (facilityIdFromQuery) {
        const facility = facilities.find((f) => this.facilityId(f) === facilityIdFromQuery);
        if (facility) {
          const fId = this.facilityId(facility);
          this.selectedFacilityId.set(fId);
          this.facilityControl.setValue(fId, { emitEvent: false });
          if (fId) this.loadCourts(fId);
        } else {
          this.selectedFacilityId.set(null);
          this.facilityControl.setValue(null, { emitEvent: false });
          this.updateQueryParam(null);
        }
      } else {
        this.selectedFacilityId.set(null);
        this.facilityControl.setValue(null, { emitEvent: false });
      }
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
    this.courtService
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
    const updatedId = updatedCourt._id ?? updatedCourt.id;
    const index = currentCourts.findIndex((c) => (c._id ?? c.id) === updatedId);
    if (index !== -1) {
      const updatedCourts = [...currentCourts];
      updatedCourts[index] = updatedCourt;
      this.courts.set(updatedCourts);
    }
  }

  onEditCourt(court: Court): void {
    const facilityId = court.facility ?? court.facilityId ?? this.selectedFacilityId();
    this.dialogs
      .open(new PolymorpheusComponent(CourtFormComponent, this.injector), {
        label: 'რედაქტირება',
        size: 'l',
        dismissible: true,
        closable: true,
        data: {
          court,
          facilityId,
          style: {
            height: '80vh',
            'max-height': '600px',
            overflow: 'hidden',
          },
        },
      })
      .pipe(take(1))
      .subscribe(() => {
        if (facilityId) this.loadCourts(facilityId);
      });
  }

  onDeleteCourt(court: Court): void {
    const facilityId = court.facility ?? court.facilityId ?? this.selectedFacilityId();
    const courtId = court._id ?? court.id;
    if (!facilityId || !courtId) return;

    this.courtService
      .deleteCourt(facilityId, courtId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.loadCourts(facilityId);
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
    return facilityId
      ? this.facilities().find((f) => this.facilityId(f) === facilityId)
      : undefined;
  }
}
