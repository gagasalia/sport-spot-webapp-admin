import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/experimental';
import { SHARED_TAIGA_IMPORTS } from '../../../../shared/shared.module';
import {
  Court,
  CourtSportType,
  CourtSurfaceMaterial,
  CourtType,
} from '../../../../shared/models/court.model';
import { ConfigurationService } from '../../../../services/http-services/configuration.service';
import { TuiAlertService } from '@taiga-ui/core';

@Component({
  selector: 'app-court-form',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, ReactiveFormsModule, CommonModule],
  templateUrl: './court-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourtFormComponent implements OnInit {
  readonly sportTypes: CourtSportType[] = ['Padel', 'Tennis', 'Football', 'Basketball', 'Volleyball'];
  readonly courtTypes: CourtType[] = ['Indoor', 'Outdoor', 'Covered'];
  readonly surfaceMaterials: CourtSurfaceMaterial[] = ['Clay', 'Grass', 'Concrete', 'Synthetic'];

  readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<
    any,
    { facilityId: string; court?: Court }
  >;

  form = this.fb.group({
    description: ['', Validators.required],
    sportType: [this.sportTypes[0], Validators.required],
    type: [this.courtTypes[0], Validators.required],
    courtSurface: this.fb.group({
      material: [this.surfaceMaterials[0], Validators.required],
      color: ['', Validators.required],
    }),
    photos: [[] as string[]],
    activeState: [false],
  });

  constructor(
    private fb: FormBuilder,
    private configurationService: ConfigurationService,
    private alerts: TuiAlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const editingCourt = this.context.data?.court;
    if (editingCourt) {
      this.form.patchValue({
        description: editingCourt.description,
        sportType: editingCourt.sportType,
        type: editingCourt.type,
        courtSurface: editingCourt.courtSurface,
        photos: editingCourt.photos,
        activeState: editingCourt.activeState,
      });
      this.cdr.markForCheck();
    }
  }

  get photos(): string[] {
    return this.form.get('photos')?.value || [];
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFiles(Array.from(input.files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.handleFiles(Array.from(event.dataTransfer.files));
    }
  }

  private handleFiles(files: File[]): void {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          const currentPhotos = this.form.get('photos')?.value || [];
          this.form.patchValue({
            photos: [...currentPhotos, result],
          });
          this.cdr.markForCheck();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  removePhoto(index: number): void {
    const currentPhotos = this.form.get('photos')?.value || [];
    const updatedPhotos = currentPhotos.filter((_: string, i: number) => i !== index);
    this.form.patchValue({ photos: updatedPhotos });
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const facilityId = this.context.data?.facilityId;
    if (!facilityId) {
      this.alerts.open('ობიექტი მონიშნული არაა', { appearance: 'error' }).pipe(take(1)).subscribe();
      return;
    }

    const editingCourt = this.context.data?.court;
    const payload = this.form.value as Omit<Court, 'id' | 'locationId'>;
    const saveOperation = editingCourt
      ? this.configurationService.updateCourt(facilityId, editingCourt.id, payload)
      : this.configurationService.createCourt(facilityId, payload);

    saveOperation.pipe(take(1)).subscribe({
      next: (saved) => {
        const message = editingCourt
          ? 'კორტი წარმატებით განახლდა'
          : 'კორტი წარმატებით დაემატა';
        this.alerts.open(message, { appearance: 'success' }).pipe(take(1)).subscribe();
        (this.context as any).completeWith(saved);
      },
      error: () => {
        this.alerts.open('მოხდა შეცდომა', { appearance: 'error' }).pipe(take(1)).subscribe();
      },
    });
  }
}
