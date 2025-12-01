import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { type TuiStringHandler } from '@taiga-ui/cdk';
import { TuiAlertService } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/experimental';
import { SHARED_TAIGA_IMPORTS } from '../../../../shared/shared.module';
import { ConfigurationService } from '../../../../services/http-services/configuration.service';
import { Court } from '../../../../shared/models/court.model';
import {
  SportType,
  CourtLocationType,
  SurfaceMaterial,
  SurfaceColor,
  SPORT_TYPE_LABELS,
  COURT_LOCATION_TYPE_LABELS,
  SURFACE_MATERIAL_LABELS,
  SURFACE_COLOR_LABELS,
} from '../../../../shared/enums/court-type.enum';

@Component({
  selector: 'app-court-form',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, ReactiveFormsModule, CommonModule],
  templateUrl: './court-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourtFormComponent implements OnInit {
  courtForm!: FormGroup;

  readonly sportTypes = Object.values(SportType);
  readonly locationTypes = Object.values(CourtLocationType);
  readonly surfaceMaterials = Object.values(SurfaceMaterial);
  readonly surfaceColors = Object.values(SurfaceColor);

  readonly sportTypeLabels = SPORT_TYPE_LABELS;
  readonly locationTypeLabels = COURT_LOCATION_TYPE_LABELS;
  readonly surfaceMaterialLabels = SURFACE_MATERIAL_LABELS;
  readonly surfaceColorLabels = SURFACE_COLOR_LABELS;

  readonly stringifySportType: TuiStringHandler<SportType> = (id) => this.sportTypeLabels[id] || '';

  readonly stringifyLocationType: TuiStringHandler<CourtLocationType> = (id) =>
    this.locationTypeLabels[id] || '';

  readonly stringifySurfaceMaterial: TuiStringHandler<SurfaceMaterial> = (id) =>
    this.surfaceMaterialLabels[id] || '';

  readonly stringifySurfaceColor: TuiStringHandler<SurfaceColor> = (id) =>
    this.surfaceColorLabels[id] || '';

  private readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<
    any,
    { court?: Court; facilityId: string }
  >;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private configurationService: ConfigurationService,
    private alerts: TuiAlertService
  ) {}

  ngOnInit(): void {
    const editingCourt = this.context.data?.court;
    console.log('Form initialized with court:', editingCourt);

    this.courtForm = this.fb.group({
      courtNumber: [editingCourt?.courtNumber || null, [Validators.required, Validators.min(1)]],
      sportType: [editingCourt?.sportType || SportType.Padel, Validators.required],
      type: [editingCourt?.type || CourtLocationType.Outdoor, Validators.required],
      courtSurface: this.fb.group({
        material: [
          editingCourt?.courtSurface?.material || SurfaceMaterial.Synthetic,
          Validators.required,
        ],
        color: [editingCourt?.courtSurface?.color || SurfaceColor.Blue, Validators.required],
      }),
    });
  }

  onSubmit(): void {
    if (this.courtForm.valid) {
      const editingCourt = this.context.data?.court;
      const facilityId = this.context.data?.facilityId;

      const formValue = {
        ...this.courtForm.value,
        facilityId,
        activeState: editingCourt?.activeState ?? false,
      };

      const saveOperation = editingCourt
        ? this.configurationService.updateCourt(editingCourt.id, formValue)
        : this.configurationService.createCourt(formValue);

      saveOperation.pipe(take(1)).subscribe({
        next: (savedCourt) => {
          console.log('Court saved:', savedCourt);
          const message = editingCourt ? 'კორტი წარმატებით განახლდა!' : 'კორტი წარმატებით დაემატა!';
          this.alerts.open(message, { appearance: 'success' }).pipe(take(1)).subscribe();
          (this.context as any).completeWith(savedCourt);
        },
        error: (error) => {
          console.error('Error saving court:', error);
          const message = editingCourt
            ? 'შეცდომა კორტის განახლებისას.'
            : 'შეცდომა კორტის დამატებისას.';
          this.alerts.open(message, { appearance: 'error' }).pipe(take(1)).subscribe();
        },
      });
    }
  }

  onCancel(): void {
    (this.context as any).completeWith(null);
  }
}
