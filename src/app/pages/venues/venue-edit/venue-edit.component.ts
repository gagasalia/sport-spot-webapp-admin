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
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map, startWith, take } from 'rxjs';
import { VenueService } from '../../../services/http-services/venue.service';
import { AcademyService } from '../../../services/http-services/academy.service';
import { FacilityService } from '../../../services/http-services/facility.service';
import {
  CreateVenueDto,
  UpdateVenueDto,
  VENUE_CITY_OPTIONS,
  VENUE_DAYS,
  VENUE_DAY_LABELS,
  VENUE_DESCRIPTION_MAX,
  VENUE_KINDS,
  VENUE_KIND_LABELS,
  VENUE_MAX_COURTS,
  VENUE_MAX_PRICE_GEL,
  VENUE_NAME_MAX,
  VENUE_SEO_MIN_WORDS,
  VENUE_SLUG_MAX,
  VENUE_SLUG_RE,
  VENUE_SOURCE_CLASSES,
  VENUE_SOURCE_LABELS,
  VENUE_STATUSES,
  VENUE_STATUS_LABELS,
  VENUE_TEXT_MAX,
  VENUE_TIME_RE,
  VENUE_URL_MAX,
  Venue,
  VenueDay,
  VenueDayHours,
  VenueKind,
  VenueOpeningHours,
  VenueStatus,
} from '../../../shared/models/venue.model';
import { DISTRICT_OPTIONS } from '../../../shared/enums/district.enum';
import { LANDMARK_OPTIONS } from '../../../shared/enums/landmark.enum';
import { gelToTetri, tetriToGel } from '../../../shared/utils/money.util';
import { countWords } from '../../../shared/utils/word-count.util';
import { gelAmountValidator } from '../../../shared/validators/gel-amount.validator';
import { tr } from '../../../shared/i18n/lang';
import { localizedName } from '../../../shared/i18n/localized';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { SsToastService } from '../../../shared/ui/toast.service';
import { PartnerFacilityOption, loadPartnerFacilities } from '../partner-facilities';

/** City-select sentinel for a town outside VENUE_CITY_OPTIONS (typed free-text). */
export const OTHER_CITY = '__other';

/** Hours a day starts with when the operator switches the editor on. */
const DEFAULT_OPEN = '09:00';
const DEFAULT_CLOSE = '23:00';

const URL_RE = /^https?:\/\/\S+$/i;

/** Whole number; an empty value passes (pair with `required`). */
export const integerValidator: ValidatorFn = (control) =>
  control.value == null || control.value === '' || Number.isInteger(Number(control.value))
    ? null
    : { integer: true };

/** City names share the API's district-length cap. */
const CITY_MAX = 80;

const COURT_COUNT_VALIDATORS: ValidatorFn[] = [
  Validators.required,
  Validators.min(0),
  Validators.max(VENUE_MAX_COURTS),
  integerValidator,
];

const GEL_VALIDATORS: ValidatorFn[] = [
  Validators.min(0),
  Validators.max(VENUE_MAX_PRICE_GEL),
  gelAmountValidator,
];

/** An open day needs both bounds as 'HH:mm'; a day off needs nothing. */
const dayHoursValidator: ValidatorFn = (group) => {
  const { closed, open, close } = group.value as { closed: boolean; open: string; close: string };
  if (closed) return null;
  return VENUE_TIME_RE.test(open ?? '') && VENUE_TIME_RE.test(close ?? '') ? null : { time: true };
};

/** Cross-field rules: indoor courts ⊆ all courts, and a non-inverted price band. */
const venueFormValidator: ValidatorFn = (form) => {
  const errors: ValidationErrors = {};
  const courts = form.get('courtsCount')?.value as number | null;
  const indoor = form.get('indoorCourtsCount')?.value as number | null;
  if (courts != null && indoor != null && indoor > courts) {
    errors['indoorExceedsTotal'] = true;
  }
  const min = form.get('priceMinGel')?.value as number | null;
  const max = form.get('priceMaxGel')?.value as number | null;
  if (min != null && max != null && max < min) {
    errors['priceBandInverted'] = true;
  }
  return Object.keys(errors).length ? errors : null;
};

type DayForm = FormGroup<{
  closed: FormControl<boolean>;
  open: FormControl<string>;
  close: FormControl<string>;
}>;

type VenueFormControls = VenueEditComponent['form']['controls'];

/**
 * Venue create/edit page (`/venues/new`, `/venues/:id`) — the full-page form
 * of the directory (docs/26 §WP-1b). Money is edited in GEL and sent as
 * integer tetri; opening hours are opt-in ("hours known") so a venue with
 * unknown hours never publishes invented ones, and a day off goes over as
 * `null`. On create empty optional fields are left out (the API also derives
 * the slug); on edit a cleared optional field is sent as `null` so the API
 * unsets it.
 */
@Component({
  selector: 'app-venue-edit',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, TPipe],
  templateUrl: './venue-edit.component.html',
  styleUrl: './venue-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VenueEditComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly venueService = inject(VenueService);
  private readonly academyService = inject(AcademyService);
  private readonly facilityService = inject(FacilityService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly otherCity = OTHER_CITY;
  protected readonly cityOptions = VENUE_CITY_OPTIONS;
  protected readonly districtOptions = DISTRICT_OPTIONS;
  protected readonly landmarkOptions = LANDMARK_OPTIONS;
  protected readonly statusOptions = VENUE_STATUSES;
  protected readonly kindOptions = VENUE_KINDS;
  protected readonly days = VENUE_DAYS;
  protected readonly descriptionMax = VENUE_DESCRIPTION_MAX;
  protected readonly seoMinWords = VENUE_SEO_MIN_WORDS;

  /** The edited venue's id; null on `/venues/new`. */
  protected readonly venueId = signal<string | null>(null);
  protected readonly venue = signal<Venue | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly hasError = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly partnerOptions = signal<PartnerFacilityOption[]>([]);

  /** Input `maxlength`s — the API's caps, so typing simply stops at the limit. */
  protected readonly limits = {
    name: VENUE_NAME_MAX,
    slug: VENUE_SLUG_MAX,
    text: VENUE_TEXT_MAX,
    url: VENUE_URL_MAX,
    city: CITY_MAX,
  };

  readonly form = this.fb.group(
    {
      // identity
      name: ['', [Validators.required, Validators.maxLength(VENUE_NAME_MAX)]],
      nameEn: ['', [Validators.maxLength(VENUE_NAME_MAX)]],
      slug: ['', [Validators.pattern(VENUE_SLUG_RE), Validators.maxLength(VENUE_SLUG_MAX)]],
      kind: this.fb.control<VenueKind>('club'),
      status: this.fb.control<VenueStatus>('draft'),
      // location
      city: ['Tbilisi', [Validators.required]],
      cityOther: [
        { value: '', disabled: true },
        [Validators.required, Validators.maxLength(CITY_MAX)],
      ],
      district: [''],
      landmark: [''],
      address: ['', [Validators.maxLength(VENUE_TEXT_MAX)]],
      lat: this.fb.control<number | null>(null, [Validators.min(-90), Validators.max(90)]),
      lng: this.fb.control<number | null>(null, [Validators.min(-180), Validators.max(180)]),
      mapsUrl: ['', [Validators.pattern(URL_RE), Validators.maxLength(VENUE_URL_MAX)]],
      // contacts
      phone: ['', [Validators.maxLength(VENUE_TEXT_MAX)]],
      website: ['', [Validators.pattern(URL_RE), Validators.maxLength(VENUE_URL_MAX)]],
      instagram: ['', [Validators.maxLength(VENUE_URL_MAX)]],
      facebook: ['', [Validators.maxLength(VENUE_URL_MAX)]],
      tiktok: ['', [Validators.maxLength(VENUE_URL_MAX)]],
      whatsapp: ['', [Validators.maxLength(VENUE_URL_MAX)]],
      // courts & prices
      courtsCount: this.fb.control<number | null>(0, COURT_COUNT_VALIDATORS),
      indoorCourtsCount: this.fb.control<number | null>(0, COURT_COUNT_VALIDATORS),
      hasRoof: [false],
      priceMinGel: this.fb.control<number | null>(null, GEL_VALIDATORS),
      priceMaxGel: this.fb.control<number | null>(null, GEL_VALIDATORS),
      racketRentalGel: this.fb.control<number | null>(null, GEL_VALIDATORS),
      // opening hours (the group is disabled — and skipped — while hours are unknown)
      hoursKnown: [false],
      openingHours: this.buildHoursGroup(),
      // texts
      description: ['', [Validators.maxLength(VENUE_DESCRIPTION_MAX)]],
      descriptionEn: ['', [Validators.maxLength(VENUE_DESCRIPTION_MAX)]],
      // partner link ('' = none)
      partnerFacility: [''],
    },
    { validators: venueFormValidator },
  );

  private readonly cityValue = toSignal(
    this.form.controls.city.valueChanges.pipe(startWith(this.form.controls.city.value)),
    { requireSync: true },
  );
  protected readonly isOtherCity = computed(() => this.cityValue() === OTHER_CITY);
  /** District + landmark are Tbilisi vocabularies — offered only there. */
  protected readonly isTbilisi = computed(() => this.cityValue() === 'Tbilisi');

  protected readonly hoursKnown = toSignal(
    this.form.controls.hoursKnown.valueChanges.pipe(
      startWith(this.form.controls.hoursKnown.value),
    ),
    { requireSync: true },
  );

  protected readonly descriptionWords = toSignal(
    this.form.controls.description.valueChanges.pipe(
      startWith(this.form.controls.description.value),
      map(countWords),
    ),
    { requireSync: true },
  );
  protected readonly descriptionEnWords = toSignal(
    this.form.controls.descriptionEn.valueChanges.pipe(
      startWith(this.form.controls.descriptionEn.value),
      map(countWords),
    ),
    { requireSync: true },
  );

  private readonly partnerValue = toSignal(
    this.form.controls.partnerFacility.valueChanges.pipe(
      startWith(this.form.controls.partnerFacility.value),
    ),
    { requireSync: true },
  );

  /** Partner picker options, grouped by academy for the <optgroup>s. */
  protected readonly partnerGroups = computed(() => {
    const groups = new Map<string, PartnerFacilityOption[]>();
    for (const option of this.partnerOptions()) {
      const list = groups.get(option.academyName) ?? [];
      list.push(option);
      groups.set(option.academyName, list);
    }
    return [...groups.entries()].map(([academyName, options]) => ({ academyName, options }));
  });

  /**
   * A linked facility missing from the picker (deleted, or its academy failed
   * to load) still needs an <option>, or the select would render blank while
   * silently keeping the id.
   */
  protected readonly unknownPartner = computed(() => {
    const id = this.partnerValue();
    return id && !this.partnerOptions().some((o) => o.id === id) ? id : null;
  });

  protected get isEditMode(): boolean {
    return this.venueId() !== null;
  }

  ngOnInit(): void {
    this.form.controls.city.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((city) => this.syncCityOther(city));
    this.form.controls.hoursKnown.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((known) => this.syncHours(known));
    this.syncCityOther(this.form.controls.city.value);
    this.syncHours(this.form.controls.hoursKnown.value);

    loadPartnerFacilities(this.academyService, this.facilityService)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((options) => this.partnerOptions.set(options));

    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        this.venueId.set(id);
        if (id) {
          // An existing venue always has a slug — it may change, not vanish.
          this.form.controls.slug.addValidators(Validators.required);
          this.form.controls.slug.updateValueAndValidity({ emitEvent: false });
          this.load(id);
        }
      });
  }

  protected retry(): void {
    const id = this.venueId();
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.venueService
      .getVenue(id)
      .pipe(take(1))
      .subscribe({
        next: (venue) => {
          this.venue.set(venue);
          this.patchForm(venue);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  // ── form plumbing ──────────────────────────────────────────────────────────

  private buildHoursGroup(): FormGroup<Record<VenueDay, DayForm>> {
    const days = {} as Record<VenueDay, DayForm>;
    for (const day of VENUE_DAYS) {
      days[day] = this.fb.group(
        {
          closed: [false],
          open: [DEFAULT_OPEN],
          close: [DEFAULT_CLOSE],
        },
        { validators: dayHoursValidator },
      );
    }
    return new FormGroup(days);
  }

  private syncCityOther(city: string): void {
    const other = this.form.controls.cityOther;
    if (city === OTHER_CITY) {
      other.enable({ emitEvent: false });
    } else {
      other.disable({ emitEvent: false });
    }
  }

  private syncHours(known: boolean): void {
    const hours = this.form.controls.openingHours;
    if (known) {
      hours.enable({ emitEvent: false });
    } else {
      hours.disable({ emitEvent: false });
    }
  }

  private patchForm(v: Venue): void {
    const named = VENUE_CITY_OPTIONS.some((c) => c.id === v.city);
    this.form.patchValue({
      name: v.name ?? '',
      nameEn: v.nameEn ?? '',
      slug: v.slug ?? '',
      kind: v.kind ?? 'club',
      status: v.status ?? 'draft',
      city: named ? v.city : OTHER_CITY,
      cityOther: named ? '' : (v.city ?? ''),
      district: v.district ?? '',
      landmark: v.landmark ?? '',
      address: v.address ?? '',
      lat: v.lat ?? null,
      lng: v.lng ?? null,
      mapsUrl: v.mapsUrl ?? '',
      phone: v.phone ?? '',
      website: v.website ?? '',
      instagram: v.instagram ?? '',
      facebook: v.facebook ?? '',
      tiktok: v.tiktok ?? '',
      whatsapp: v.whatsapp ?? '',
      courtsCount: v.courtsCount ?? 0,
      indoorCourtsCount: v.indoorCourtsCount ?? 0,
      hasRoof: !!v.hasRoof,
      priceMinGel: v.priceMinTetri != null ? tetriToGel(v.priceMinTetri) : null,
      priceMaxGel: v.priceMaxTetri != null ? tetriToGel(v.priceMaxTetri) : null,
      racketRentalGel: v.racketRentalTetri != null ? tetriToGel(v.racketRentalTetri) : null,
      hoursKnown: !!v.openingHours,
      description: v.description ?? '',
      descriptionEn: v.descriptionEn ?? '',
      partnerFacility: v.partnerFacility ?? '',
    });
    for (const day of VENUE_DAYS) {
      const hours = v.openingHours ? v.openingHours[day] : undefined;
      this.form.controls.openingHours.controls[day].setValue({
        // A day missing from a known week reads as closed, like an explicit null.
        closed: !!v.openingHours && !hours,
        open: hours?.open ?? DEFAULT_OPEN,
        close: hours?.close ?? DEFAULT_CLOSE,
      });
    }
  }

  // ── save ───────────────────────────────────────────────────────────────────

  protected onSubmit(): void {
    if (this.isSaving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alerts
        .open(tr('გთხოვთ შეავსოთ ყველა სავალდებულო ველი'), { appearance: 'error' })
        .pipe(take(1))
        .subscribe();
      return;
    }

    const id = this.venueId();
    this.isSaving.set(true);
    const request = id
      ? this.venueService.updateVenue(id, this.buildUpdateDto())
      : this.venueService.createVenue(this.buildCreateDto());

    request.pipe(take(1)).subscribe({
      next: () => {
        this.alerts
          .open(tr(id ? 'შეინახა' : 'შეიქმნა'), { appearance: 'success' })
          .pipe(take(1))
          .subscribe();
        this.router.navigate(['/venues']);
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving.set(false);
        if (err?.status === 409) {
          this.form.controls.slug.setErrors({ conflict: true });
          this.form.controls.slug.markAsTouched();
          this.toastError('ეს slug უკვე დაკავებულია');
          return;
        }
        this.toastError(
          err?.status === 400
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
   * The whole venue with every empty optional field as `null` — the EDIT body
   * as-is (null = unset server-side). District and landmark are Tbilisi
   * vocabularies, so any other town clears them.
   */
  private buildUpdateDto(): UpdateVenueDto {
    const v = this.form.getRawValue();
    const city = v.city === OTHER_CITY ? v.cityOther.trim() : v.city;
    const inTbilisi = city === 'Tbilisi';
    const text = (value: string): string | null => value.trim() || null;
    const tetri = (gel: number | null): number | null => (gel == null ? null : gelToTetri(gel));

    const dto: UpdateVenueDto = {
      name: v.name.trim(),
      nameEn: text(v.nameEn),
      slug: text(v.slug),
      kind: v.kind,
      status: v.status,
      city,
      district: inTbilisi ? text(v.district) : null,
      landmark: inTbilisi ? text(v.landmark) : null,
      address: text(v.address),
      lat: v.lat ?? null,
      lng: v.lng ?? null,
      mapsUrl: text(v.mapsUrl),
      phone: text(v.phone),
      website: text(v.website),
      instagram: text(v.instagram),
      facebook: text(v.facebook),
      tiktok: text(v.tiktok),
      whatsapp: text(v.whatsapp),
      courtsCount: v.courtsCount ?? 0,
      indoorCourtsCount: v.indoorCourtsCount ?? 0,
      hasRoof: v.hasRoof,
      priceMinTetri: tetri(v.priceMinGel),
      priceMaxTetri: tetri(v.priceMaxGel),
      racketRentalTetri: tetri(v.racketRentalGel),
      openingHours: v.hoursKnown ? this.hoursPayload(v.openingHours) : null,
      description: text(v.description),
      descriptionEn: text(v.descriptionEn),
      partnerFacility: v.partnerFacility || null,
    };
    // The slug is required while editing; never ask the API to unset it.
    if (dto.slug === null) delete dto.slug;
    return dto;
  }

  /** CREATE: the same body with the empty optional keys left out. */
  private buildCreateDto(): CreateVenueDto {
    const full = this.buildUpdateDto();
    return Object.fromEntries(
      Object.entries(full).filter(([, value]) => value !== null && value !== undefined),
    ) as unknown as CreateVenueDto;
  }

  private hoursPayload(
    raw: Record<VenueDay, { closed: boolean; open: string; close: string }>,
  ): VenueOpeningHours {
    const hours = {} as VenueOpeningHours;
    for (const day of VENUE_DAYS) {
      const row = raw[day];
      hours[day] = row.closed ? null : ({ open: row.open, close: row.close } as VenueDayHours);
    }
    return hours;
  }

  // ── template helpers ───────────────────────────────────────────────────────

  protected dayForm(day: VenueDay): DayForm {
    return this.form.controls.openingHours.controls[day];
  }

  protected dayLabel(day: VenueDay): string {
    return VENUE_DAY_LABELS[day];
  }

  protected statusLabel(status: VenueStatus): string {
    return VENUE_STATUS_LABELS[status] ?? status;
  }

  protected kindLabel(kind: VenueKind): string {
    return VENUE_KIND_LABELS[kind] ?? kind;
  }

  protected sourceLabel(venue: Venue): string {
    return VENUE_SOURCE_LABELS[venue.source] ?? venue.source ?? '';
  }

  protected sourceClass(venue: Venue): string {
    return VENUE_SOURCE_CLASSES[venue.source] ?? VENUE_SOURCE_CLASSES.manual;
  }

  protected facilityLabel(option: PartnerFacilityOption): string {
    return localizedName(option.facility) || option.id;
  }

  /** True once a control was touched and fails `error` (or any error when omitted). */
  protected showError(name: keyof VenueFormControls, error?: string): boolean {
    const control = this.form.controls[name];
    if (!control.touched) return false;
    return error ? control.hasError(error) : control.invalid;
  }
}
