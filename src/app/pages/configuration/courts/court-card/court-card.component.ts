import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiAlertService } from '@taiga-ui/core';
import { TUI_CONFIRM } from '@taiga-ui/kit';
import { TuiDialogService } from '@taiga-ui/experimental';
import { take } from 'rxjs';
import { SHARED_TAIGA_IMPORTS } from '../../../../shared/shared.module';
import { Court } from '../../../../shared/models/court.model';
import { ConfigurationService } from '../../../../services/http-services/configuration.service';

@Component({
  selector: 'app-court-card',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, CommonModule, FormsModule, RouterLink],
  templateUrl: './court-card.component.html',
  styleUrls: ['./court-card.component.scss'],
})
export class CourtCardComponent {
  @Input({ required: true }) court!: Court;
  @Output() courtUpdated = new EventEmitter<Court>();
  @Output() editCourt = new EventEmitter<Court>();
  @Output() deleteCourt = new EventEmitter<Court>();

  private readonly dialogs = inject(TuiDialogService);
  private readonly alerts = inject(TuiAlertService);

  constructor(private configurationService: ConfigurationService) {}

  get primaryPhoto(): string {
    return this.court.photos && this.court.photos.length > 0
      ? this.court.photos[0]
      : 'images/facility-placeholder.png';
  }

  get hasMultiplePhotos(): boolean {
    return this.court.photos && this.court.photos.length > 1;
  }

  get photoCount(): number {
    return this.court.photos ? this.court.photos.length : 0;
  }

  get isPublished(): boolean {
    return this.court.activeState;
  }

  onToggleState(checked: boolean): void {
    this.court.activeState = checked;

    this.configurationService
      .updateCourt(this.court.locationId, this.court.id, { activeState: checked })
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.courtUpdated.emit(updated);
        },
        error: () => {
          this.court.activeState = !checked;
          this.alerts
            .open('სტატუსის განახლება ვერ მოხერხდა', { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
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
