import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  Injector,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { take } from 'rxjs';
import { type TuiStringHandler } from '@taiga-ui/cdk';
import { TuiAlertService } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/experimental';
import { SHARED_TAIGA_IMPORTS } from '../../../../shared/shared.module';
import { ConfigurationService } from '../../../../services/http-services/configuration.service';
import { Facility } from '../../../../shared/models/facility.model';
import { City } from '../../../../shared/enums/city.enum';
import { Country } from '../../../../shared/enums/country.enum';
import { Amenity, AMENITY_LABELS, AMENITY_ICONS } from '../../../../shared/enums/amenity.enum';

interface CountryItem {
  readonly id: number;
  readonly name: string;
}

interface CityItem {
  readonly id: number;
  readonly name: string;
}

@Component({
  selector: 'app-facility-form',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, ReactiveFormsModule, CommonModule],
  templateUrl: './facility-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacilityFormComponent implements OnInit {
  facilityForm!: FormGroup;
  academyId: string = ''; // Will be set from API response

  readonly countries: readonly CountryItem[] = [{ id: Country.Georgia, name: 'საქართველო' }];

  readonly cities: readonly CityItem[] = [{ id: City.Tbilisi, name: 'თბილისი' }];

  readonly amenities = Object.values(Amenity);
  readonly amenityLabels = AMENITY_LABELS;
  readonly amenityIcons = AMENITY_ICONS;

  readonly stringifyCountry: TuiStringHandler<number> = (id) =>
    this.countries.find((item) => item.id === id)?.name ?? '';

  readonly stringifyCity: TuiStringHandler<number> = (id) =>
    this.cities.find((item) => item.id === id)?.name ?? '';

  private readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<
    any,
    { facility?: Facility }
  >;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private configurationService: ConfigurationService,
    private alerts: TuiAlertService
  ) {}

  ngOnInit(): void {
    const editingFacility = this.context.data?.facility;
    console.log('Form initialized with facility:', editingFacility);
    console.log('Context data:', this.context.data);

    this.facilityForm = this.fb.group({
      country: [{ value: Country.Georgia, disabled: true }],
      city: [{ value: City.Tbilisi, disabled: true }],
      addressPin: this.fb.group({
        lat: [editingFacility?.addressPin?.lat || null],
        lng: [editingFacility?.addressPin?.lng || null],
      }),
      addressText: [editingFacility?.addressText || ''],
      photos: [editingFacility?.photos || []],
      description: [editingFacility?.description || ''],
      amenities: this.createAmenitiesFormArray(editingFacility?.amenities),
      workingHours: [editingFacility?.workingHours || []],
      courts: [editingFacility?.courts || []],
    });

    // If editing, trigger change detection to show photos
    if (editingFacility?.photos?.length) {
      this.cdr.markForCheck();
    }
  }

  createAmenitiesFormArray(selectedAmenities?: Amenity[]): FormArray {
    return this.fb.array(
      this.amenities.map((amenity) =>
        this.fb.control(selectedAmenities?.includes(amenity) || false)
      )
    );
  }

  get amenitiesFormArray(): FormArray {
    return this.facilityForm.get('amenities') as FormArray;
  }

  getSelectedAmenities(): Amenity[] {
    return this.amenitiesFormArray.value
      .map((selected: boolean, index: number) => (selected ? this.amenities[index] : null))
      .filter((amenity: Amenity | null) => amenity !== null) as Amenity[];
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
    // Filter only image files
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          const currentPhotos = this.facilityForm.get('photos')?.value || [];
          this.facilityForm.patchValue({
            photos: [...currentPhotos, result],
          });
          // Trigger change detection to update the view immediately
          this.cdr.markForCheck();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  removePhoto(index: number): void {
    const currentPhotos = this.facilityForm.get('photos')?.value || [];
    const updatedPhotos = currentPhotos.filter((_: string, i: number) => i !== index);
    this.facilityForm.patchValue({
      photos: updatedPhotos,
    });
    // Trigger change detection to update the view immediately
    this.cdr.markForCheck();
  }

  get photos(): string[] {
    return this.facilityForm.get('photos')?.value || [];
  }

  onSubmit(): void {
    if (this.facilityForm.valid) {
      const editingFacility = this.context.data?.facility;
      const formValue = {
        ...this.facilityForm.value,
        amenities: this.getSelectedAmenities(),
        academyId: this.academyId || 'default-academy', // Default value for now
        activeState: editingFacility?.activeState ?? false, // Preserve state if editing, otherwise start as draft
        rules: editingFacility?.rules || '', // Preserve rules if editing
      };

      const saveOperation = editingFacility
        ? this.configurationService.updateFacility(editingFacility.id, formValue)
        : this.configurationService.createFacility(formValue);

      saveOperation.pipe(take(1)).subscribe({
        next: (savedFacility) => {
          console.log('Facility saved:', savedFacility);
          const message = editingFacility
            ? 'ობიექტი წარმატებით განახლდა!'
            : 'ობიექტი წარმატებით დაემატა!';
          this.alerts.open(message, { appearance: 'success' }).pipe(take(1)).subscribe();
          // Close dialog and return the saved facility
          (this.context as any).completeWith(savedFacility);
        },
        error: (error) => {
          console.error('Error saving facility:', error);
          const message = editingFacility
            ? 'შეცდომა ობიექტის განახლებისას.'
            : 'შეცდომა ობიექტის დამატებისას.';
          this.alerts.open(message, { appearance: 'error' }).pipe(take(1)).subscribe();
        },
      });
    }
  }

  onCancel(): void {
    // Close dialog without saving
    (this.context as any).completeWith(null);
  }
}
