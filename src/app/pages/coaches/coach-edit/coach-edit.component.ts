import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, map, of, startWith, switchMap, take } from 'rxjs';
import { CoachService } from '../../../services/http-services/coach.service';
import { AcademyService } from '../../../services/http-services/academy.service';
import { FacilityService } from '../../../services/http-services/facility.service';
import { VenueService } from '../../../services/http-services/venue.service';
import {
  MediaFileTooLargeError,
  MediaService,
  MediaUnconfiguredError,
} from '../../../services/http-services/media.service';
import { AuthService } from '../../../shared/services/auth.service';
import { TenantService } from '../../../shared/services/tenant.service';
import { Academy } from '../../../shared/models/academy.model';
import {
  COACH_BIO_MAX,
  COACH_CERTIFICATIONS_MAX,
  COACH_CERTIFICATION_MAX,
  COACH_CITY_MAX,
  COACH_DEFAULT_LANGUAGES,
  COACH_LANGUAGES,
  COACH_LANGUAGE_LABELS,
  COACH_LEVELS,
  COACH_LEVEL_LABELS,
  COACH_MAX_PRICE_GEL,
  COACH_NAME_MAX,
  COACH_PHONE_MAX,
  COACH_PLACES_MAX,
  COACH_SEO_MIN_WORDS,
  COACH_SLUG_MAX,
  COACH_SLUG_RE,
  COACH_STATUSES,
  COACH_STATUS_LABELS,
  COACH_URL_MAX,
  Coach,
  CoachLanguage,
  CoachLevel,
  CoachPhoto,
  CoachStatus,
  CreateCoachDto,
  UpdateCoachDto,
} from '../../../shared/models/coach.model';
import { VENUE_CITY_OPTIONS, Venue, venueCityName } from '../../../shared/models/venue.model';
import { Facility } from '../../../shared/models/facility.model';
import { DISTRICT_OPTIONS } from '../../../shared/enums/district.enum';
import { gelToTetri, tetriToGel } from '../../../shared/utils/money.util';
import { countWords } from '../../../shared/utils/word-count.util';
import { gelAmountValidator } from '../../../shared/validators/gel-amount.validator';
import { tr } from '../../../shared/i18n/lang';
import { localizedName } from '../../../shared/i18n/localized';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { SsToastService } from '../../../shared/ui/toast.service';
import { AcademySelectComponent } from '../../../shared/ui/academy-select.component';
import { PartnerFacilityOption, loadPartnerFacilities } from '../../venues/partner-facilities';

/** City-select sentinel for a town outside VENUE_CITY_OPTIONS (typed free-text). */
export const COACH_OTHER_CITY = '__other';

/** How many directory venues the picker offers (`GET /venues?limit=100`). */
const VENUE_PICKER_LIMIT = 100;

/** Non-empty after trimming (the API trims, so '   ' would be an empty name). */
const requiredTrimmed: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

const GEL_VALIDATORS: ValidatorFn[] = [
  Validators.min(0),
  Validators.max(COACH_MAX_PRICE_GEL),
  gelAmountValidator,
];

type CoachFormControls = CoachEditComponent['form']['controls'];

/**
 * Coach create/edit page (`/coaches/new`, `/coaches/:id`) — the full-page
 * form of the coaches directory (docs/26 §WP-1d), sectioned as identity,
 * photo, about, prices, contacts, location and "where they teach".
 *
 * Tenancy follows the API: a SUPERADMIN picks the academy (or none — an
 * independent coach), any partner facility and any directory venue; an ADMIN
 * sees their own academy read-only, picks only their academy's facilities and
 * never sends `academy` or `venues`. Lesson prices are edited in GEL and sent
 * as integer tetri. On create empty optionals are left out (the API also
 * derives the slug); on edit a cleared optional goes over as `null` — a
 * removed photo is `photo: null`.
 */
@Component({
  selector: 'app-coach-edit',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, TPipe, AcademySelectComponent],
  templateUrl: './coach-edit.component.html',
  styleUrl: './coach-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoachEditComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly coachService = inject(CoachService);
  private readonly academyService = inject(AcademyService);
  private readonly facilityService = inject(FacilityService);
  private readonly venueService = inject(VenueService);
  private readonly mediaService = inject(MediaService);
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSuperAdmin = this.auth.isSuperAdmin;
  protected readonly otherCity = COACH_OTHER_CITY;
  protected readonly cityOptions = VENUE_CITY_OPTIONS;
  protected readonly districtOptions = DISTRICT_OPTIONS;
  protected readonly statusOptions = COACH_STATUSES;
  protected readonly languageOptions = COACH_LANGUAGES;
  protected readonly levelOptions = COACH_LEVELS;
  protected readonly seoMinWords = COACH_SEO_MIN_WORDS;

  /** Input `maxlength`s and counters — the API's caps. */
  protected readonly limits = {
    name: COACH_NAME_MAX,
    slug: COACH_SLUG_MAX,
    bio: COACH_BIO_MAX,
    certification: COACH_CERTIFICATION_MAX,
    certifications: COACH_CERTIFICATIONS_MAX,
    phone: COACH_PHONE_MAX,
    url: COACH_URL_MAX,
    city: COACH_CITY_MAX,
    places: COACH_PLACES_MAX,
  };

  /** The edited coach's id; null on `/coaches/new`. */
  protected readonly coachId = signal<string | null>(null);
  protected readonly coach = signal<Coach | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly hasError = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly isUploadingPhoto = signal(false);
  /** Superadmin: every academy, for the owner select. */
  protected readonly academies = signal<Academy[]>([]);
  /** Operator: their own academy (shown read-only). */
  protected readonly ownAcademy = signal<Academy | null>(null);
  protected readonly facilityOptions = signal<PartnerFacilityOption[]>([]);
  /** Superadmin: the directory venues the picker offers. */
  protected readonly venueOptions = signal<Venue[]>([]);
  /** RAW Georgian message of the last rejected certification, if any. */
  protected readonly certError = signal<string | null>(null);

  readonly form = this.fb.group({
    // identity
    name: ['', [requiredTrimmed, Validators.maxLength(COACH_NAME_MAX)]],
    nameEn: ['', [Validators.maxLength(COACH_NAME_MAX)]],
    slug: ['', [Validators.pattern(COACH_SLUG_RE), Validators.maxLength(COACH_SLUG_MAX)]],
    status: this.fb.control<CoachStatus>('draft'),
    // photo
    photo: this.fb.control<CoachPhoto | null>(null),
    // about
    bio: ['', [requiredTrimmed, Validators.maxLength(COACH_BIO_MAX)]],
    bioEn: ['', [Validators.maxLength(COACH_BIO_MAX)]],
    certifications: this.fb.control<string[]>(
      [],
      [Validators.maxLength(COACH_CERTIFICATIONS_MAX)],
    ),
    languages: this.fb.control<CoachLanguage[]>([...COACH_DEFAULT_LANGUAGES]),
    levels: this.fb.control<CoachLevel[]>([]),
    // prices (GEL in the form, tetri on the wire)
    priceIndividualGel: this.fb.control<number | null>(null, GEL_VALIDATORS),
    priceGroupGel: this.fb.control<number | null>(null, GEL_VALIDATORS),
    // contacts
    phone: ['', [Validators.maxLength(COACH_PHONE_MAX)]],
    instagram: ['', [Validators.maxLength(COACH_URL_MAX)]],
    whatsapp: ['', [Validators.maxLength(COACH_URL_MAX)]],
    // location
    city: ['Tbilisi', [Validators.required]],
    cityOther: [
      { value: '', disabled: true },
      [requiredTrimmed, Validators.maxLength(COACH_CITY_MAX)],
    ],
    district: [''],
    // where they teach ('' = independent; superadmin only)
    academy: [''],
    facilities: this.fb.control<string[]>([], [Validators.maxLength(COACH_PLACES_MAX)]),
    venues: this.fb.control<string[]>([], [Validators.maxLength(COACH_PLACES_MAX)]),
  });

  /** The whole form as a signal — derived values below re-run only when their slice changes. */
  protected readonly v = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  private readonly cityValue = computed(() => this.v().city);
  protected readonly isOtherCity = computed(() => this.cityValue() === COACH_OTHER_CITY);
  /** Districts are a Tbilisi vocabulary — offered only there. */
  protected readonly isTbilisi = computed(() => this.cityValue() === 'Tbilisi');

  private readonly bioText = computed(() => this.v().bio);
  private readonly bioEnText = computed(() => this.v().bioEn);
  protected readonly bioWords = computed(() => countWords(this.bioText()));
  protected readonly bioEnWords = computed(() => countWords(this.bioEnText()));

  protected readonly photo = computed(() => this.v().photo);
  protected readonly certifications = computed(() => this.v().certifications);
  protected readonly languages = computed(() => this.v().languages);
  protected readonly levels = computed(() => this.v().levels);
  protected readonly facilityIds = computed(() => this.v().facilities);
  protected readonly venueIds = computed(() => this.v().venues);

  /** Chips of the picked facilities; an id the picker does not know still shows. */
  protected readonly selectedFacilities = computed(() => {
    const byId = new Map(this.facilityOptions().map((o) => [o.id, o]));
    return this.facilityIds().map((id) => {
      const option = byId.get(id);
      return { id, label: option ? this.facilityLabel(option) : null };
    });
  });

  /** Facility options not yet chosen, grouped by academy for the <optgroup>s. */
  protected readonly facilityGroups = computed(() => {
    const chosen = new Set(this.facilityIds());
    const groups = new Map<string, PartnerFacilityOption[]>();
    for (const option of this.facilityOptions()) {
      if (chosen.has(option.id)) continue;
      const list = groups.get(option.academyName) ?? [];
      list.push(option);
      groups.set(option.academyName, list);
    }
    return [...groups.entries()].map(([academyName, options]) => ({ academyName, options }));
  });

  /** Chips of the picked directory venues; an unknown id still shows. */
  protected readonly selectedVenues = computed(() => {
    const byId = new Map(this.venueOptions().map((venue) => [venue._id, venue]));
    return this.venueIds().map((id) => {
      const venue = byId.get(id);
      return { id, label: venue ? this.venueLabel(venue) : null };
    });
  });

  /** Directory venues not yet chosen. */
  protected readonly venueChoices = computed(() => {
    const chosen = new Set(this.venueIds());
    return this.venueOptions().filter((venue) => !chosen.has(venue._id));
  });

  protected get isEditMode(): boolean {
    return this.coachId() !== null;
  }

  ngOnInit(): void {
    this.form.controls.city.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((city) => this.syncCityOther(city));
    this.syncCityOther(this.form.controls.city.value);

    this.loadPickers();

    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        this.coachId.set(id);
        if (id) {
          // An existing coach always has a slug — it may change, not vanish.
          this.form.controls.slug.addValidators(Validators.required);
          this.form.controls.slug.updateValueAndValidity({ emitEvent: false });
          this.load(id);
        }
      });
  }

  protected retry(): void {
    const id = this.coachId();
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.coachService
      .getCoach(id)
      .pipe(take(1))
      .subscribe({
        next: (coach) => {
          this.coach.set(coach);
          this.patchForm(coach);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  /**
   * The pickers' options. A superadmin gets every academy, every facility
   * (fanned out per academy) and the venues directory; an operator gets their
   * own academy and its facilities. A failed read only empties its picker.
   */
  private loadPickers(): void {
    if (this.isSuperAdmin()) {
      this.academyService
        .getAllAcademies()
        .pipe(
          take(1),
          catchError(() => of([] as Academy[])),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((academies) => this.academies.set(academies ?? []));
      loadPartnerFacilities(this.academyService, this.facilityService)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((options) => this.facilityOptions.set(options));
      this.venueService
        .getVenues({ page: 1, limit: VENUE_PICKER_LIMIT })
        .pipe(
          take(1),
          map(({ data }) => data),
          catchError(() => of([] as Venue[])),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((venues) => this.venueOptions.set(venues));
      return;
    }

    this.tenant
      .ensure()
      .pipe(
        take(1),
        switchMap((academy) => {
          this.ownAcademy.set(academy);
          return academy?._id ? this.ownFacilities(academy) : of([]);
        }),
        catchError(() => of([] as PartnerFacilityOption[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((options) => this.facilityOptions.set(options));
  }

  private ownFacilities(academy: Academy): Observable<PartnerFacilityOption[]> {
    return this.facilityService.getFacilitiesByAcademy(academy._id as string).pipe(
      map((rows: Facility[]) =>
        (rows ?? []).flatMap((facility) => {
          const id = facility._id ?? facility.id;
          return id ? [{ id, facility, academyName: academy.name }] : [];
        }),
      ),
      catchError(() => of([] as PartnerFacilityOption[])),
    );
  }

  // ── form plumbing ──────────────────────────────────────────────────────────

  private syncCityOther(city: string): void {
    const other = this.form.controls.cityOther;
    if (city === COACH_OTHER_CITY) {
      other.enable({ emitEvent: false });
    } else {
      other.disable({ emitEvent: false });
    }
  }

  private patchForm(c: Coach): void {
    const named = VENUE_CITY_OPTIONS.some((option) => option.id === c.city);
    this.form.patchValue({
      name: c.name ?? '',
      nameEn: c.nameEn ?? '',
      slug: c.slug ?? '',
      status: c.status ?? 'draft',
      photo: c.photo ?? null,
      bio: c.bio ?? '',
      bioEn: c.bioEn ?? '',
      certifications: [...(c.certifications ?? [])],
      languages: [...(c.languages ?? [])],
      levels: [...(c.levels ?? [])],
      priceIndividualGel:
        c.priceIndividualTetri != null ? tetriToGel(c.priceIndividualTetri) : null,
      priceGroupGel: c.priceGroupTetri != null ? tetriToGel(c.priceGroupTetri) : null,
      phone: c.phone ?? '',
      instagram: c.instagram ?? '',
      whatsapp: c.whatsapp ?? '',
      city: named ? c.city : COACH_OTHER_CITY,
      cityOther: named ? '' : (c.city ?? ''),
      district: c.district ?? '',
      academy: c.academy ?? '',
      facilities: [...(c.facilities ?? [])],
      venues: [...(c.venues ?? [])],
    });
  }

  private setDirty<T>(control: FormControl<T>, value: T): void {
    control.markAsDirty();
    control.setValue(value);
  }

  // ── languages + levels (multi-select chips) ────────────────────────────────

  /** Toggles one language; the list keeps the canonical chip order. */
  protected toggleLanguage(lang: CoachLanguage): void {
    const current = this.form.controls.languages.value;
    const next = current.includes(lang)
      ? current.filter((l) => l !== lang)
      : COACH_LANGUAGES.filter((l) => l === lang || current.includes(l));
    this.setDirty(this.form.controls.languages, next);
  }

  protected toggleLevel(level: CoachLevel): void {
    const current = this.form.controls.levels.value;
    const next = current.includes(level)
      ? current.filter((l) => l !== level)
      : COACH_LEVELS.filter((l) => l === level || current.includes(l));
    this.setDirty(this.form.controls.levels, next);
  }

  protected languageLabel(lang: CoachLanguage): string {
    return COACH_LANGUAGE_LABELS[lang] ?? lang;
  }

  protected levelLabel(level: CoachLevel): string {
    return COACH_LEVEL_LABELS[level] ?? level;
  }

  // ── certifications (chip input) ────────────────────────────────────────────

  /** Enter commits the typed certification (commas are allowed inside one). */
  protected onCertKeydown(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addCertification(input.value);
      input.value = '';
    }
  }

  protected onCertBlur(input: HTMLInputElement): void {
    if (input.value.trim()) {
      this.addCertification(input.value);
      input.value = '';
    }
  }

  /** Trimmed, de-duplicated (case-insensitive) chips, ≤10 of ≤120 characters. */
  protected addCertification(raw: string): void {
    this.certError.set(null);
    const cert = raw.trim().replace(/\s+/g, ' ');
    if (!cert) return;
    const list = this.form.controls.certifications.value;
    if (list.some((c) => c.toLowerCase() === cert.toLowerCase())) return;
    if (cert.length > COACH_CERTIFICATION_MAX) {
      this.certError.set('სერტიფიკატი მაქსიმუმ 120 სიმბოლოა');
      return;
    }
    if (list.length >= COACH_CERTIFICATIONS_MAX) {
      this.certError.set('მაქსიმუმ 10 სერტიფიკატი');
      return;
    }
    this.setDirty(this.form.controls.certifications, [...list, cert]);
  }

  protected removeCertification(index: number): void {
    this.certError.set(null);
    this.setDirty(
      this.form.controls.certifications,
      this.form.controls.certifications.value.filter((_, i) => i !== index),
    );
  }

  // ── photo ──────────────────────────────────────────────────────────────────

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.uploadPhoto(file);
  }

  protected onPhotoDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected onPhotoDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadPhoto(file);
  }

  private uploadPhoto(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.toastError('გთხოვთ აირჩიოთ სურათის ფაილი');
      return;
    }
    this.isUploadingPhoto.set(true);
    this.mediaService
      .uploadImage(file, 'coach-photo')
      .pipe(
        take(1),
        finalize(() => this.isUploadingPhoto.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (media) =>
          this.setDirty(this.form.controls.photo, {
            url: media.url,
            type: media.type,
            ...(media.thumbUrl ? { thumbUrl: media.thumbUrl } : {}),
            ...(media.key ? { key: media.key } : {}),
            ...(media.thumbKey ? { thumbKey: media.thumbKey } : {}),
          }),
        error: (error: unknown) => {
          if (error instanceof MediaUnconfiguredError) {
            this.toastError('სურათების ატვირთვა ამ გარემოში არ არის კონფიგურირებული');
          } else if (error instanceof MediaFileTooLargeError) {
            this.toastError('ფაილი ძალიან დიდია. მაქსიმალური ზომაა 10 MB.');
          } else {
            this.toastError('შეცდომა სურათის ატვირთვისას');
          }
        },
      });
  }

  /** Removal is saved as `photo: null` (the API then releases the media). */
  protected removePhoto(): void {
    this.setDirty(this.form.controls.photo, null);
  }

  // ── facilities + venues (≤ 6 each) ─────────────────────────────────────────

  protected addFacility(select: HTMLSelectElement): void {
    const id = select.value;
    select.value = '';
    const ids = this.form.controls.facilities.value;
    if (!id || ids.includes(id) || ids.length >= COACH_PLACES_MAX) return;
    this.setDirty(this.form.controls.facilities, [...ids, id]);
  }

  protected removeFacility(id: string): void {
    this.setDirty(
      this.form.controls.facilities,
      this.form.controls.facilities.value.filter((x) => x !== id),
    );
  }

  protected addVenue(select: HTMLSelectElement): void {
    const id = select.value;
    select.value = '';
    const ids = this.form.controls.venues.value;
    if (!id || ids.includes(id) || ids.length >= COACH_PLACES_MAX) return;
    this.setDirty(this.form.controls.venues, [...ids, id]);
  }

  protected removeVenue(id: string): void {
    this.setDirty(
      this.form.controls.venues,
      this.form.controls.venues.value.filter((x) => x !== id),
    );
  }

  protected facilityLabel(option: PartnerFacilityOption): string {
    return localizedName(option.facility) || option.id;
  }

  /** 'ვაკის პადელი · თბილისი' — the venue, then its town. */
  protected venueLabel(venue: Venue): string {
    const name = localizedName(venue) || venue._id;
    const city = venueCityName(venue.city);
    return city ? `${name} · ${city}` : name;
  }

  // ── save ───────────────────────────────────────────────────────────────────

  protected onSubmit(): void {
    if (this.isSaving() || this.isUploadingPhoto()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastError('გთხოვთ შეავსოთ ყველა სავალდებულო ველი');
      return;
    }

    const id = this.coachId();
    this.isSaving.set(true);
    const request = id
      ? this.coachService.updateCoach(id, this.buildUpdateDto())
      : this.coachService.createCoach(this.buildCreateDto());

    request.pipe(take(1)).subscribe({
      next: () => {
        this.alerts
          .open(tr(id ? 'შეინახა' : 'შეიქმნა'), { appearance: 'success' })
          .pipe(take(1))
          .subscribe();
        this.router.navigate(['/coaches']);
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving.set(false);
        if (err?.status === 409) {
          this.form.controls.slug.setErrors({ conflict: true });
          this.form.controls.slug.markAsTouched();
          this.toastError('ეს slug უკვე დაკავებულია');
          return;
        }
        if (err?.status === 403) {
          this.toastError('ამ ტრენერის შეცვლის უფლება არ გაქვთ');
          return;
        }
        this.toastError(
          err?.status === 400 || err?.status === 404
            ? 'შეამოწმე ველები — მოთხოვნა ვერ დამუშავდა'
            : 'შენახვა ვერ მოხერხდა, სცადეთ თავიდან',
        );
      },
    });
  }

  private toastError(georgian: string): void {
    this.alerts.open(tr(georgian), { appearance: 'error' }).pipe(take(1)).subscribe();
  }

  /**
   * The whole coach with every empty optional as `null` — the EDIT body as-is
   * (null = unset server-side). A district is a Tbilisi vocabulary, so any
   * other town clears it. `academy` and `venues` are superadmin fields: an
   * operator's body never carries them (the API would 403 an academy move,
   * and leaves an omitted venue list untouched).
   */
  private buildUpdateDto(): UpdateCoachDto {
    const v = this.form.getRawValue();
    const city = v.city === COACH_OTHER_CITY ? v.cityOther.trim() : v.city;
    const text = (value: string): string | null => value.trim() || null;
    const tetri = (gel: number | null): number | null =>
      gel == null || (gel as unknown) === '' ? null : gelToTetri(gel);

    const dto: UpdateCoachDto = {
      name: v.name.trim(),
      nameEn: text(v.nameEn),
      slug: text(v.slug),
      status: v.status,
      photo: v.photo ? photoPayload(v.photo) : null,
      bio: v.bio.trim(),
      bioEn: text(v.bioEn),
      languages: [...v.languages],
      levels: [...v.levels],
      certifications: [...v.certifications],
      priceIndividualTetri: tetri(v.priceIndividualGel),
      priceGroupTetri: tetri(v.priceGroupGel),
      phone: text(v.phone),
      instagram: text(v.instagram),
      whatsapp: text(v.whatsapp),
      city,
      district: city === 'Tbilisi' ? text(v.district) : null,
      facilities: [...v.facilities],
    };
    // The slug is required while editing; never ask the API to unset it.
    if (dto.slug === null) delete dto.slug;
    if (this.isSuperAdmin()) {
      dto.academy = v.academy || null;
      dto.venues = [...v.venues];
    }
    return dto;
  }

  /** CREATE: the same body with the empty optional keys left out (no academy = independent). */
  private buildCreateDto(): CreateCoachDto {
    const full = this.buildUpdateDto();
    return Object.fromEntries(
      Object.entries(full).filter(([, value]) => value !== null && value !== undefined),
    ) as unknown as CreateCoachDto;
  }

  // ── template helpers ───────────────────────────────────────────────────────

  protected statusLabel(status: CoachStatus): string {
    return COACH_STATUS_LABELS[status] ?? status;
  }

  /** The operator's own academy, or the loaded coach's when theirs is unknown. */
  protected ownAcademyName(): string {
    return this.ownAcademy()?.name || (this.coach()?.academy ? tr('აკადემია') : '—');
  }

  /** True once a control was touched and fails `error` (or any error when omitted). */
  protected showError(name: keyof CoachFormControls, error?: string): boolean {
    const control = this.form.controls[name];
    if (!control.touched) return false;
    return error ? control.hasError(error) : control.invalid;
  }
}

/** Only the media fields the API stores — never a stray server-side key. */
function photoPayload(photo: CoachPhoto): CoachPhoto {
  return {
    url: photo.url,
    type: photo.type,
    ...(photo.thumbUrl ? { thumbUrl: photo.thumbUrl } : {}),
    ...(photo.key ? { key: photo.key } : {}),
    ...(photo.thumbKey ? { thumbKey: photo.thumbKey } : {}),
  };
}
