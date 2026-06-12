import {
  Component,
  OnInit,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { environment } from '../../../../environments/environment';

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
  isSaved = signal<boolean>(false);

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private academyService: AcademyService,
    private alerts: TuiAlertService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadAcademy();

    this.academyForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.academyForm.dirty) {
          this.isSaved.set(false);
        }
      });
  }

  private initializeForm(): void {
    this.academyForm = this.fb.group({
      name: ['', Validators.required],
      color: [''],
      descriptionGeorgian: [''],
      descriptionEnglish: [''],
      phone: [''],
      email: [''],
      instagram: [''],
      facebook: [''],
      logo: this.fb.group({
        url: [''],
        type: [''],
        size: [0],
        metadata: [null],
      }),
    });
  }

  private readonly academyId = environment.academyId;

  private loadAcademy(): void {
    this.isLoading.set(true);
    this.academyService
      .getAcademyById(this.academyId)
      .pipe(take(1))
      .subscribe({
        next: (academy) => {
          if (academy) {
            this.academy.set(academy);
            this.academyForm.patchValue(academy);
            this.isSaved.set(true);
          }
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading academy:', error);
          this.isLoading.set(false);
          this.cdr.markForCheck();
          this.alerts
            .open('შეცდომა აკადემიის ჩატვირთვისას', { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  onSave(): void {
    if (this.academyForm.valid) {
      this.isSaving.set(true);
      const formValue = this.academyForm.value;

      this.academyService
        .updateAcademy(this.academyId, formValue)
        .pipe(take(1))
        .subscribe({
          next: (savedAcademy) => {
            this.academy.set(savedAcademy);
            this.isSaving.set(false);
            this.isSaved.set(true);
            this.academyForm.markAsPristine();
            this.cdr.markForCheck();
            this.alerts
              .open('აკადემია წარმატებით შეინახა!', { appearance: 'success' })
              .pipe(take(1))
              .subscribe();
          },
          error: (error) => {
            console.error('Error saving academy:', error);
            this.isSaving.set(false);
            this.cdr.markForCheck();
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
        this.academyForm.patchValue({
          logo: {
            url: result,
            type: file.type,
            size: file.size,
          },
        });
        this.academyForm.markAsDirty();
        this.cdr.markForCheck();
      }
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.academyForm.patchValue({
      logo: { url: '', type: '', size: 0, metadata: null },
    });
    this.academyForm.markAsDirty();
    this.cdr.markForCheck();
  }

  get logoUrl(): string {
    return this.academyForm.get('logo.url')?.value || '';
  }

  get colorControl(): FormControl {
    return this.academyForm.get('color') as FormControl;
  }
}
