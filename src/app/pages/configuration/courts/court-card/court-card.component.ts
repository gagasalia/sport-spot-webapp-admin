import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { SHARED_TAIGA_IMPORTS } from '../../../../shared/shared.module';
import { TuiDialogService } from '@taiga-ui/experimental';
import { TuiAlertService } from '@taiga-ui/core';
import { TUI_CONFIRM } from '@taiga-ui/kit';
import { Court } from '../../../../shared/models/court.model';
import {
  SportType,
  CourtLocationType,
  SPORT_TYPE_LABELS,
  SPORT_TYPE_ICONS,
  COURT_LOCATION_TYPE_LABELS,
  SURFACE_MATERIAL_LABELS,
  SURFACE_COLOR_LABELS,
} from '../../../../shared/enums/court-type.enum';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { ConfigurationService } from '../../../../services/http-services/configuration.service';

@Component({
  selector: 'app-court-card',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, CommonModule, FormsModule],
  templateUrl: './court-card.component.html',
  styleUrls: ['./court-card.component.scss'],
})
export class CourtCardComponent {
  @Input({ required: true }) court!: Court;
  @Output() courtUpdated = new EventEmitter<Court>();
  @Output() editCourt = new EventEmitter<Court>();
  @Output() deleteCourt = new EventEmitter<Court>();

  readonly sportTypeLabels = SPORT_TYPE_LABELS;
  readonly sportTypeIcons = SPORT_TYPE_ICONS;
  readonly locationTypeLabels = COURT_LOCATION_TYPE_LABELS;
  readonly surfaceMaterialLabels = SURFACE_MATERIAL_LABELS;
  readonly surfaceColorLabels = SURFACE_COLOR_LABELS;

  private readonly dialogs = inject(TuiDialogService);
  private readonly alerts = inject(TuiAlertService);
  constructor(private configurationService: ConfigurationService) {}

  get sportTypeName(): string {
    return this.sportTypeLabels[this.court.sportType as SportType] || '';
  }

  get sportTypeIcon(): string {
    return this.sportTypeIcons[this.court.sportType as SportType] || '@lucide.square';
  }

  get locationTypeName(): string {
    return this.locationTypeLabels[this.court.type as CourtLocationType] || '';
  }

  get locationTypeIcon(): string {
    const iconMap: Record<CourtLocationType, string> = {
      [CourtLocationType.Indoor]: '@lucide.home',
      [CourtLocationType.Outdoor]: '@lucide.sun',
      [CourtLocationType.Covered]: '@lucide.umbrella',
    };
    return iconMap[this.court.type as CourtLocationType] || '@lucide.building';
  }

  get surfaceMaterialName(): string {
    return this.surfaceMaterialLabels[this.court.courtSurface.material] || '';
  }

  get surfaceColorName(): string {
    return this.surfaceColorLabels[this.court.courtSurface.color] || '';
  }

  get isPublished(): boolean {
    return this.court.activeState;
  }

  onToggleState(checked: boolean): void {
    console.log('Toggling court state from:', this.court.activeState, 'to:', checked);

    this.court.activeState = checked;

    this.configurationService
      .updateCourt(this.court.id, { activeState: checked })
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          console.log('Court updated successfully:', updated);
          this.courtUpdated.emit(updated);
        },
        error: (error) => {
          console.error('Error updating court state:', error);
          this.court.activeState = !checked;
        },
      });
  }

  onEdit(event: Event): void {
    event.stopPropagation();
    this.editCourt.emit(this.court);
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: 'დადასტურება',
        data: {
          content: 'ნამდვილად გსურთ კორტის წაშლა?',
          yes: 'წაშლა',
          no: 'გაუქმება',
        },
      })
      .pipe(take(1))
      .subscribe((response) => {
        if (response) {
          this.deleteCourt.emit(this.court);
        }
      });
  }
}
