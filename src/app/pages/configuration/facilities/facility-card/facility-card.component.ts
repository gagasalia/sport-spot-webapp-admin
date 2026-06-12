import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SHARED_TAIGA_IMPORTS } from '../../../../shared/shared.module';
import { TuiDialogService } from '@taiga-ui/experimental';
import { TuiAlertService } from '@taiga-ui/core';
import { TUI_CONFIRM } from '@taiga-ui/kit';
import { Facility } from '../../../../shared/models/facility.model';
import { AMENITY_LABELS, AMENITY_ICONS } from '../../../../shared/enums/amenity.enum';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { FacilityService } from '../../../../services/http-services/facility.service';

@Component({
  selector: 'app-facility-card',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, CommonModule, FormsModule, RouterLink],
  templateUrl: './facility-card.component.html',
  styleUrls: ['./facility-card.component.scss'],
})
export class FacilityCardComponent {
  @Input({ required: true }) facility!: Facility;
  @Output() facilityUpdated = new EventEmitter<Facility>();
  @Output() editFacility = new EventEmitter<Facility>();
  @Output() deleteFacility = new EventEmitter<Facility>();

  readonly amenityLabels = AMENITY_LABELS;
  readonly amenityIcons = AMENITY_ICONS;

  private readonly dialogs = inject(TuiDialogService);
  private readonly alerts = inject(TuiAlertService);
  private readonly facilityService = inject(FacilityService);

  get primaryPhoto(): string {
    if (this.facility.media?.length) return this.facility.media[0].url;
    if (this.facility.photos?.length) return this.facility.photos[0];
    return 'images/facility-placeholder.png';
  }

  get hasMultiplePhotos(): boolean {
    const count = this.facility.media?.length ?? this.facility.photos?.length ?? 0;
    return count > 1;
  }

  get photoCount(): number {
    return this.facility.media?.length ?? this.facility.photos?.length ?? 0;
  }

  get cityName(): string {
    // Since we only have Tbilisi for now
    return 'თბილისი';
  }

  get countryName(): string {
    // Since we only have Georgia for now
    return 'საქართველო';
  }

  get isPublished(): boolean {
    return this.facility.activeState ?? false;
  }

  onToggleState(checked: boolean): void {
    // Optimistic update; revert if the PATCH fails.
    this.facility.activeState = checked;

    const facilityId = this.facility._id ?? this.facility.id;
    if (!facilityId) {
      this.facility.activeState = !checked;
      return;
    }

    this.facilityService
      .setFacilityStatus(facilityId, checked)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.facilityUpdated.emit(updated);
        },
        error: (error) => {
          console.error('Error updating facility state:', error);
          this.facility.activeState = !checked;
        },
      });
  }

  onEdit(event: Event): void {
    event.stopPropagation();
    this.editFacility.emit(this.facility);
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: 'დადასტურება',
        data: {
          content: 'ნამდვილად გსურთ ობიექტის წაშლა?',
          yes: 'წაშლა',
          no: 'გაუქმება',
        },
      })
      .pipe(take(1))
      .subscribe((response) => {
        if (response) {
          this.deleteFacility.emit(this.facility);
        }
      });
  }

  openInGoogleMaps(event: Event): void {
    event.stopPropagation();

    // Prefer API address coordinates, fall back to legacy addressPin
    const addrLat = this.facility.contactInfo?.address?.lat;
    const addrLng = this.facility.contactInfo?.address?.lng;
    const pin = this.facility.addressPin;

    const lat = addrLat != null ? Number(addrLat) : pin?.lat != null ? Number(pin.lat) : NaN;
    const lng = addrLng != null ? Number(addrLng) : pin?.lng != null ? Number(pin.lng) : NaN;

    if (lat == null || lng == null) {
      this.alerts
        .open('ობიექტის მისამართი დამატებული არაა', { appearance: 'error' })
        .pipe(take(1))
        .subscribe();
      return;
    }

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      this.alerts
        .open('ობიექტის მისამართი დამატებული არაა', { appearance: 'error' })
        .pipe(take(1))
        .subscribe();
      return;
    }

    // Construct Google Maps URL using the @lat,lng,zoomz pattern
    const zoom = 17;
    const url = `https://www.google.com/maps/@${lat},${lng},${zoom}z`;

    window.open(url, '_blank');
  }

  onManageCourts(event: Event): void {
    event.stopPropagation();
    // TODO: Implement courts management functionality
  }
}
