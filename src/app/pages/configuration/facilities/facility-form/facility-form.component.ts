import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { take } from 'rxjs';
import { type TuiStringHandler } from '@taiga-ui/cdk';
import { TuiAlertService } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/experimental';
import { SHARED_TAIGA_IMPORTS } from '../../../../shared/shared.module';
import { FacilityService } from '../../../../services/http-services/facility.service';
import {
  MediaService,
  MediaUnconfiguredError,
  MediaFileTooLargeError,
} from '../../../../services/http-services/media.service';
import { Facility, IMedia, CreateFacilityDto } from '../../../../shared/models/facility.model';
import { Amenity, AMENITY_LABELS, AMENITY_ICONS } from '../../../../shared/enums/amenity.enum';
import { TenantService } from '../../../../shared/services/tenant.service';

interface CountryItem {
  readonly id: string;
  readonly name: string;
}

interface CityItem {
  readonly id: string;
  readonly name: string;
}

@Component({
  selector: 'app-facility-form',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, ReactiveFormsModule, CommonModule, GoogleMap, MapMarker],
  templateUrl: './facility-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacilityFormComponent implements OnInit, AfterViewInit {
  @ViewChild('autocompleteContainer') autocompleteContainer!: ElementRef<HTMLDivElement>;

  facilityForm!: FormGroup;

  protected readonly markerPosition = signal<google.maps.LatLngLiteral | null>(null);
  protected readonly mapCenter = signal<google.maps.LatLngLiteral>({ lat: 41.6938, lng: 44.8015 });
  protected readonly mediaItems = signal<IMedia[]>([]);

  readonly mapOptions: google.maps.MapOptions = {
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  };

  readonly countries: readonly CountryItem[] = [{ id: 'Georgia', name: 'საქართველო' }];
  readonly cities: readonly CityItem[] = [{ id: 'Tbilisi', name: 'თბილისი' }];

  readonly amenities = Object.values(Amenity);
  readonly amenityLabels = AMENITY_LABELS;
  readonly amenityIcons = AMENITY_ICONS;

  readonly stringifyCountry: TuiStringHandler<string> = (id) =>
    this.countries.find((item) => item.id === id)?.name ?? '';

  readonly stringifyCity: TuiStringHandler<string> = (id) =>
    this.cities.find((item) => item.id === id)?.name ?? '';

  private readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<
    Facility | null,
    { facility?: Facility }
  >;

  private readonly ngZone = inject(NgZone);
  private readonly tenant = inject(TenantService);
  private readonly mediaService = inject(MediaService);

  protected readonly isUploadingMedia = signal<boolean>(false);

  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly facilityService = inject(FacilityService);
  private readonly alerts = inject(TuiAlertService);

  ngOnInit(): void {
    const f = this.context.data?.facility;

    this.facilityForm = this.fb.group({
      name: [f?.name || '', Validators.required],
      description: [f?.description || ''],
      country: [{ value: 'Georgia', disabled: true }],
      city: [{ value: 'Tbilisi', disabled: true }],
      amenities: this.createAmenitiesFormArray(f?.amenities as Amenity[] | undefined),
      contactInfo: this.fb.group({
        email: [f?.contactInfo?.email || ''],
        phone: [f?.contactInfo?.phone || ''],
        address: this.fb.group({
          street: [f?.contactInfo?.address?.street || f?.addressText || ''],
          lat: [
            f?.contactInfo?.address?.lat ||
              (f?.addressPin?.lat != null ? String(f.addressPin.lat) : ''),
          ],
          lng: [
            f?.contactInfo?.address?.lng ||
              (f?.addressPin?.lng != null ? String(f.addressPin.lng) : ''),
          ],
          city: [f?.contactInfo?.address?.city || ''],
        }),
        website: [f?.contactInfo?.website || ''],
        facebook: [f?.contactInfo?.facebook || ''],
        twitter: [f?.contactInfo?.twitter || ''],
        instagram: [f?.contactInfo?.instagram || ''],
        linkedIn: [f?.contactInfo?.linkedIn || ''],
      }),
    });

    // Pre-populate media from the API `media` field (stored publicUrl shape).
    if (f?.media?.length) {
      this.mediaItems.set(f.media);
    }

    // Pre-set map marker
    const latStr =
      f?.contactInfo?.address?.lat ?? (f?.addressPin?.lat != null ? String(f.addressPin.lat) : '');
    const lngStr =
      f?.contactInfo?.address?.lng ?? (f?.addressPin?.lng != null ? String(f.addressPin.lng) : '');
    if (latStr && lngStr) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (!isNaN(lat) && !isNaN(lng)) {
        this.markerPosition.set({ lat, lng });
        this.mapCenter.set({ lat, lng });
      }
    }
  }

  ngAfterViewInit(): void {
    this.initAutocomplete();
  }

  private async initAutocomplete(): Promise<void> {
    try {
      // The new Places `PlaceAutocompleteElement` / `gmp-select` API is not yet
      // covered by the installed @types/google.maps, so this interop boundary is
      // necessarily untyped. `any` is confined to these two lines.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { PlaceAutocompleteElement } = (await google.maps.importLibrary('places')) as any;
      if (!PlaceAutocompleteElement) return;

      const autocomplete = new PlaceAutocompleteElement({});
      autocomplete.style.width = '100%';
      this.autocompleteContainer.nativeElement.appendChild(autocomplete);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      autocomplete.addEventListener('gmp-select', async (event: any) => {
        const place = event.placePrediction.toPlace();
        await place.fetchFields({ fields: ['formattedAddress', 'location'] });
        const location = place.location;
        if (location) {
          this.ngZone.run(() => {
            const lat = location.lat();
            const lng = location.lng();
            this.markerPosition.set({ lat, lng });
            this.mapCenter.set({ lat, lng });
            this.facilityForm.get('contactInfo.address')?.patchValue({
              street: place.formattedAddress ?? '',
              lat: String(lat),
              lng: String(lng),
            });
          });
        }
      });
    } catch (e) {
      console.warn('Places Autocomplete not available:', e);
    }
  }

  protected onMapClick(event: google.maps.MapMouseEvent): void {
    if (!event.latLng) return;
    this.ngZone.run(() => {
      const lat = event.latLng!.lat();
      const lng = event.latLng!.lng();
      this.markerPosition.set({ lat, lng });
      this.facilityForm.get('contactInfo.address')?.patchValue({
        lat: String(lat),
        lng: String(lng),
      });
    });
  }

  createAmenitiesFormArray(selectedAmenities?: Amenity[]): FormArray {
    return this.fb.array(
      this.amenities.map((amenity) =>
        this.fb.control(selectedAmenities?.includes(amenity) || false),
      ),
    );
  }

  get amenitiesFormArray(): FormArray {
    return this.facilityForm.get('amenities') as FormArray;
  }

  getSelectedAmenities(): string[] {
    return this.amenitiesFormArray.value
      .map((selected: boolean, index: number) => (selected ? this.amenities[index] : null))
      .filter((a: string | null) => a !== null);
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
    if (imageFiles.length === 0) return;

    this.isUploadingMedia.set(true);
    let pending = imageFiles.length;
    const settle = () => {
      pending -= 1;
      if (pending === 0) {
        this.isUploadingMedia.set(false);
        this.cdr.markForCheck();
      }
    };

    imageFiles.forEach((file) => {
      this.mediaService
        .upload(file, 'facility-media')
        .pipe(take(1))
        .subscribe({
          next: (media: IMedia) => {
            this.mediaItems.update((current) => [...current, media]);
            this.cdr.markForCheck();
            settle();
          },
          error: (error) => {
            if (error instanceof MediaUnconfiguredError) {
              this.alerts
                .open('სურათების ატვირთვა ამ გარემოში არ არის კონფიგურირებული', {
                  appearance: 'error',
                })
                .pipe(take(1))
                .subscribe();
            } else if (error instanceof MediaFileTooLargeError) {
              this.alerts
                .open('ფაილი ძალიან დიდია. მაქსიმალური ზომაა 10 MB.', { appearance: 'error' })
                .pipe(take(1))
                .subscribe();
            } else {
              console.error('Error uploading media:', error);
              this.alerts
                .open('შეცდომა სურათის ატვირთვისას', { appearance: 'error' })
                .pipe(take(1))
                .subscribe();
            }
            settle();
          },
        });
    });
  }

  removeMedia(index: number): void {
    this.mediaItems.update((current) => current.filter((_, i) => i !== index));
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    if (this.facilityForm.invalid) {
      this.facilityForm.markAllAsTouched();
      this.alerts
        .open('გთხოვთ შეავსოთ ყველა სავალდებულო ველი', { appearance: 'error' })
        .pipe(take(1))
        .subscribe();
      return;
    }

    const owner = this.tenant.academyId();
    // The owner (academy id) is mandatory: a facility with an empty owner would
    // be orphaned. Block the submit and surface a Georgian error instead.
    if (!owner) {
      this.alerts
        .open('აკადემია ვერ მოიძებნა', { appearance: 'error' })
        .pipe(take(1))
        .subscribe();
      return;
    }

    const editingFacility = this.context.data?.facility;
    const v = this.facilityForm.getRawValue();

    const dto: CreateFacilityDto = {
      owner,
      name: v.name,
      description: v.description || '',
      amenities: this.getSelectedAmenities(),
      country: v.country,
      city: v.city,
      media: this.mediaItems(),
      contactInfo: {
        email: v.contactInfo.email || undefined,
        phone: v.contactInfo.phone || undefined,
        address: {
          street: v.contactInfo.address.street || undefined,
          lat: v.contactInfo.address.lat || undefined,
          lng: v.contactInfo.address.lng || undefined,
          city: v.contactInfo.address.city || undefined,
        },
        website: v.contactInfo.website || undefined,
        facebook: v.contactInfo.facebook || undefined,
        twitter: v.contactInfo.twitter || undefined,
        instagram: v.contactInfo.instagram || undefined,
        linkedIn: v.contactInfo.linkedIn || undefined,
      },
    };

    const facilityId = editingFacility?._id || editingFacility?.id;
    const saveOperation = facilityId
      ? this.facilityService.updateFacility(facilityId, dto)
      : this.facilityService.createFacility(dto);

    saveOperation.pipe(take(1)).subscribe({
      next: (savedFacility) => {
        const message = facilityId ? 'ობიექტი წარმატებით განახლდა!' : 'ობიექტი წარმატებით დაემატა!';
        this.alerts.open(message, { appearance: 'success' }).pipe(take(1)).subscribe();
        this.context.completeWith(savedFacility);
      },
      error: () => {
        const message = facilityId
          ? 'შეცდომა ობიექტის განახლებისას.'
          : 'შეცდომა ობიექტის დამატებისას.';
        this.alerts.open(message, { appearance: 'error' }).pipe(take(1)).subscribe();
      },
    });
  }

  onCancel(): void {
    this.context.completeWith(null);
  }
}
