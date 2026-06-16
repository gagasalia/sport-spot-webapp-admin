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
import {
  MediaService,
  MediaUnconfiguredError,
} from '../../../services/http-services/media.service';
import { Academy, IMedia, UpdateAcademyDto } from '../../../shared/models/academy.model';
import { TenantService } from '../../../shared/services/tenant.service';

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
  private readonly tenant = inject(TenantService);
  private readonly mediaService = inject(MediaService);
  private readonly fb = inject(FormBuilder);
  private readonly academyService = inject(AcademyService);
  private readonly alerts = inject(TuiAlertService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  isUploadingLogo = signal<boolean>(false);

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

  private get academyId(): string | null {
    return this.tenant.academyId();
  }

  private loadAcademy(): void {
    this.isLoading.set(true);
    // Initialize through ensure() so a hard refresh / deep link onto /academy
    // resolves the tenant (one `/academy/my` call, replayed if already resolved)
    // before patching the form, instead of reading a still-null signal.
    this.tenant
      .ensure()
      .pipe(takeUntilDestroyed(this.destroyRef))
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
      const academyId = this.academyId;
      // Never dispatch an update with an empty id: without a resolved tenant the
      // request would target the wrong (or no) academy. Block and surface a
      // Georgian error instead.
      if (!academyId) {
        this.alerts
          .open('აკადემია ვერ მოიძებნა', { appearance: 'error' })
          .pipe(take(1))
          .subscribe();
        return;
      }

      this.isSaving.set(true);
      const payload = this.buildUpdatePayload();

      this.academyService
        .updateAcademy(academyId, payload)
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

  /**
   * Builds the `PUT /academy/:id` payload from the form, OMITTING empty optional
   * fields rather than sending empty strings/placeholders that fail backend
   * validation:
   *  - empty-string optional fields (email/phone/instagram/facebook/descriptions)
   *    are dropped — e.g. `email:''` would otherwise fail `@IsEmail`;
   *  - the logo group is dropped entirely unless a real logo exists (non-empty
   *    url) — the placeholder `{url:'',type:''}` would otherwise fail nested
   *    media validation.
   * `name` (required) and `color` are always sent.
   */
  private buildUpdatePayload(): UpdateAcademyDto {
    const v = this.academyForm.value;

    const payload: UpdateAcademyDto = { name: v.name };

    if (v.color) payload.color = v.color;

    const optionalText: (keyof UpdateAcademyDto)[] = [
      'descriptionGeorgian',
      'descriptionEnglish',
      'phone',
      'email',
      'instagram',
      'facebook',
    ];
    for (const key of optionalText) {
      const value = v[key];
      // Omit empty strings (and null/undefined); keep only real, non-blank values.
      if (typeof value === 'string' && value.trim() !== '') {
        (payload[key] as string) = value;
      }
    }

    // Only attach the logo when a real one was uploaded (non-empty url). The
    // initial/cleared placeholder `{url:'', type:''}` must never be sent.
    const logo = v.logo as IMedia | undefined;
    if (logo?.url) {
      payload.logo = logo;
    }

    return payload;
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

    this.isUploadingLogo.set(true);
    this.mediaService
      .upload(file, 'academy-logo')
      .pipe(take(1))
      .subscribe({
        next: (media) => {
          this.academyForm.patchValue({
            logo: { url: media.url, type: media.type, size: media.size, metadata: null },
          });
          this.academyForm.markAsDirty();
          this.isUploadingLogo.set(false);
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.isUploadingLogo.set(false);
          this.cdr.markForCheck();
          if (error instanceof MediaUnconfiguredError) {
            this.alerts
              .open('სურათების ატვირთვა ამ გარემოში არ არის კონფიგურირებული', {
                appearance: 'error',
              })
              .pipe(take(1))
              .subscribe();
            return;
          }
          console.error('Error uploading logo:', error);
          this.alerts
            .open('შეცდომა სურათის ატვირთვისას', { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
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
