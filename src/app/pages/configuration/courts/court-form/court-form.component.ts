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
import { CourtService } from '../../../../services/http-services/court.service';
import { Court, CreateCourtDto } from '../../../../shared/models/court.model';
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
    Court | null,
    { court?: Court; facilityId: string }
  >;

  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly courtService = inject(CourtService);
  private readonly alerts = inject(TuiAlertService);

  ngOnInit(): void {
    const editingCourt = this.context.data?.court;
    const location = editingCourt?.locationType ?? editingCourt?.type;
    const surface = editingCourt?.surface ?? editingCourt?.courtSurface;

    this.courtForm = this.fb.group({
      courtNumber: [editingCourt?.courtNumber || null, [Validators.required, Validators.min(1)]],
      sportType: [editingCourt?.sportType || SportType.Padel, Validators.required],
      locationType: [location || CourtLocationType.Outdoor, Validators.required],
      surface: this.fb.group({
        material: [surface?.material || SurfaceMaterial.Synthetic, Validators.required],
        color: [surface?.color || SurfaceColor.Blue, Validators.required],
      }),
    });
  }

  onSubmit(): void {
    if (!this.courtForm.valid) return;

    const editingCourt = this.context.data?.court;
    const facilityId =
      this.context.data?.facilityId ?? editingCourt?.facility ?? editingCourt?.facilityId;
    if (!facilityId) return;

    const v = this.courtForm.value;
    const dto: CreateCourtDto = {
      courtNumber: v.courtNumber,
      sportType: v.sportType,
      locationType: v.locationType,
      surface: { material: v.surface.material, color: v.surface.color },
      activeState: editingCourt?.activeState ?? false,
    };

    const editingId = editingCourt?._id ?? editingCourt?.id;
    const saveOperation = editingId
      ? this.courtService.updateCourt(facilityId, editingId, dto)
      : this.courtService.createCourt(facilityId, dto);

    saveOperation.pipe(take(1)).subscribe({
      next: (savedCourt) => {
        const message = editingCourt ? 'კორტი წარმატებით განახლდა!' : 'კორტი წარმატებით დაემატა!';
        this.alerts.open(message, { appearance: 'success' }).pipe(take(1)).subscribe();
        this.context.completeWith(savedCourt);
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

  onCancel(): void {
    this.context.completeWith(null);
  }
}
