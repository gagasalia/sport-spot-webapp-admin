import {
  Component,
  OnInit,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormControl,
} from '@angular/forms';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { TuiAlertService } from '@taiga-ui/core';
import { TuiInputColor } from '@taiga-ui/kit';
import { SHARED_TAIGA_IMPORTS } from '../../../shared/shared.module';
import { AcademyService } from '../../../services/http-services/academy.service';
import { Academy } from '../../../shared/models/academy.model';

@Component({
  selector: 'app-academy',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, ReactiveFormsModule, CommonModule, TuiInputColor],
  templateUrl: './academy.component.html',
  styleUrls: ['./academy.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcademyComponent implements OnInit {
  academyForm!: FormGroup;
  academy = signal<Academy | null>(null);
  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);

  constructor(
    private fb: FormBuilder,
    private academyService: AcademyService,
    private alerts: TuiAlertService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadAcademy();
  }

  private initializeForm(): void {
    this.academyForm = this.fb.group({
      id: [''],
      name: ['', Validators.required],
      logo: [''],
      color: ['#000000', Validators.required],
      description: [''],
      contactInfo: this.fb.group({
        phone: [''],
        email: ['', Validators.email],
        socials: this.fb.group({
          facebook: [''],
          instagram: [''],
        }),
      }),
    });
  }

  private loadAcademy(): void {
    this.isLoading.set(true);
    this.academyService
      .getAcademy()
      .pipe(take(1))
      .subscribe({
        next: (academy) => {
          if (academy) {
            this.academy.set(academy);
            this.academyForm.patchValue(academy);
          } else {
            // Generate new ID for first time
            this.academyForm.patchValue({ id: this.generateId() });
          }
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading academy:', error);
          this.isLoading.set(false);
          this.alerts
            .open('შეცდომა აკადემიის ჩატვირთვისას', { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  private generateId(): string {
    return 'academy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  onSave(): void {
    if (this.academyForm.valid) {
      this.isSaving.set(true);
      const academyData = this.academyForm.value as Academy;

      const saveOperation = this.academy()
        ? this.academyService.updateAcademy(academyData)
        : this.academyService.saveAcademy(academyData);

      saveOperation.pipe(take(1)).subscribe({
        next: (savedAcademy) => {
          this.academy.set(savedAcademy);
          this.isSaving.set(false);
          this.alerts
            .open('აკადემია წარმატებით შეინახა!', { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        },
        error: (error) => {
          console.error('Error saving academy:', error);
          this.isSaving.set(false);
          this.alerts
            .open('შეცდომა აკადემიის შენახვისას', { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
    } else {
      this.academyForm.markAllAsTouched();
      this.alerts
        .open('გთხოვთ შეავსოთ ყველა სავალდებულო ველი', { appearance: 'error' })
        .pipe(take(1))
        .subscribe();
    }
  }

  navigateToFacilities(): void {
    this.router.navigate(['/configuration/facilities']);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
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
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  private handleFile(file: File): void {
    // Only accept image files
    if (!file.type.startsWith('image/')) {
      this.alerts
        .open('გთხოვთ აირჩიოთ სურათის ფაილი', { appearance: 'error' })
        .pipe(take(1))
        .subscribe();
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        this.academyForm.patchValue({ logo: result });
        this.cdr.markForCheck();
      }
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.academyForm.patchValue({ logo: '' });
    this.cdr.markForCheck();
  }

  get logo(): string {
    return this.academyForm.get('logo')?.value || '';
  }

  get colorControl(): FormControl {
    return this.academyForm.get('color') as FormControl;
  }
}
