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
import { ConfigurationService } from '../../../../services/http-services/configuration.service';

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
  constructor(private configurationService: ConfigurationService) {}

  get primaryPhoto(): string {
    return this.facility.photos && this.facility.photos.length > 0
      ? this.facility.photos[0]
      : 'images/facility-placeholder.png';
  }

  get hasMultiplePhotos(): boolean {
    return this.facility.photos && this.facility.photos.length > 1;
  }

  get photoCount(): number {
    return this.facility.photos ? this.facility.photos.length : 0;
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
    return this.facility.activeState;
  }

  onToggleState(checked: boolean): void {
    console.log('Toggling facility state from:', this.facility.activeState, 'to:', checked);

    // Update the facility state
    this.facility.activeState = checked;

    this.configurationService
      .updateFacility(this.facility.id, { activeState: checked })
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          console.log('Facility updated successfully:', updated);
          this.facilityUpdated.emit(updated);
        },
        error: (error) => {
          console.error('Error updating facility state:', error);
          // Revert the change on error
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
    const pin = this.facility.addressPin;

    if (!pin || pin.lat == null || pin.lng == null) {
      // Show error alert when coordinates are missing
      this.alerts
        .open('ობიექტის მისამართი დამატებული არაა', { appearance: 'error' })
        .pipe(take(1))
        .subscribe();
      return;
    }

    const lat = Number(pin.lat);
    const lng = Number(pin.lng);

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
    console.log('Manage courts for facility:', this.facility);
  }
}
