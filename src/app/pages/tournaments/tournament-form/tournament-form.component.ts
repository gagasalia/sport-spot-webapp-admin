import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, take } from 'rxjs';
import { TournamentService } from '../../../services/http-services/tournament.service';
import { VenueService } from '../../../services/http-services/venue.service';
import { AuthService } from '../../../shared/services/auth.service';
import {
  CreateTournamentDto,
  EXTERNAL_ORGANIZER_MAX,
  EXTERNAL_REGISTRATION_URL_MAX,
  EXTERNAL_VENUE_NAME_MAX,
  Tournament,
  TournamentCategory,
  TournamentExternal,
  TournamentFormat,
  TournamentLevel,
  TournamentType,
  UpdateTournamentDto,
} from '../../../shared/models/tournament.model';
import {
  CATEGORY_LABEL_MAX,
  EVENT_CATEGORIES_MAX,
  TournamentCategoryDto,
  TournamentVenue,
} from '../../../shared/models/tournament-engine.model';
import { Venue, venueCityName } from '../../../shared/models/venue.model';
import { gelToTetri, tetriToGel } from '../../../shared/utils/money.util';
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  LEVEL_LABELS,
  TYPE_LABELS,
} from '../tournament-labels';

import { tr } from '../../../shared/i18n/lang';
import { localizedName } from '../../../shared/i18n/localized';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { SsToastService } from '../../../shared/ui/toast.service';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../../shared/ui/dialog.service';

// The vocabulary lives in tournament-labels.ts; re-exported for existing importers.
export { CATEGORY_LABELS, FORMAT_LABELS, LEVEL_LABELS, TYPE_LABELS };

/** The top-level controls a multi-category event moves into its category rows. */
const CATEGORY_CONTROLS = [
  'type',
  'format',
  'level',
  'category',
  'entryFeeGel',
  'maxParticipants',
] as const;

/** One «კატეგორიები» row as typed. */
interface CategoryRowValue {
  label: string;
  labelEn: string;
  type: TournamentType;
  format: TournamentFormat;
  category: TournamentCategory;
  level: TournamentLevel;
  entryFeeGel: number;
  maxParticipants: number;
}

/** A category row → the API's category (fee GEL → tetri, empty labels left out). */
export function categoryRowToDto(row: CategoryRowValue): TournamentCategoryDto {
  const label = (row.label ?? '').trim();
  const labelEn = (row.labelEn ?? '').trim();
  return {
    ...(label ? { label } : {}),
    ...(labelEn ? { labelEn } : {}),
    type: row.type,
    format: row.format,
    category: row.category,
    level: row.level,
    entryFeeTetri: gelToTetri(row.entryFeeGel),
    maxParticipants: Number(row.maxParticipants),
  };
}

/** Off-site registration link: http(s), no whitespace (the API's rule). */
const HTTP_URL_RE = /^https?:\/\/\S+$/i;

/**
 * The link as it will be sent (trimmed) must be http(s) — a pasted URL's
 * stray surrounding spaces are not an error. Empty passes (pair with required).
 */
const httpUrlValidator: ValidatorFn = (control) => {
  const value = ((control.value as string | null) ?? '').trim();
  return !value || HTTP_URL_RE.test(value) ? null : { pattern: true };
};

/** Non-empty after trimming (a link of spaces is no link). */
const requiredTrimmed: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

/** How many directory venues the external-venue picker offers. */
const VENUE_PICKER_LIMIT = 100;

/** The controls of the external block (enabled only while the switch is on). */
const EXTERNAL_CONTROLS = [
  'registrationUrl',
  'organizerName',
  'externalVenue',
  'externalVenueName',
] as const;

/**
 * An external tournament has no facility on the wire, so it must say where it
 * is played: a directory venue OR a free-text place name. Only while the
 * external block is live (enabled — a non-superadmin's never is).
 */
const externalPlaceValidator: ValidatorFn = (group) => {
  if (!group.get('external')?.value || group.get('registrationUrl')?.disabled) return null;
  const venue = group.get('externalVenue')?.value as string | null;
  const name = ((group.get('externalVenueName')?.value as string | null) ?? '').trim();
  return venue || name ? null : { externalPlace: true };
};

/** ISO instant → value for `<input type="datetime-local">` (local wall clock). */
function isoToLocalInput(iso: string | undefined): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface TournamentFormValue {
  name: string;
  nameEn: string;
  facility: string;
  type: TournamentType;
  format: TournamentFormat;
  level: TournamentLevel;
  category: TournamentCategory;
  startDate: string;
  startTime: string;
  endDate: string;
  registrationDeadline: string;
  entryFeeGel: number;
  maxParticipants: number;
  prizeDescription: string;
  prizeDescriptionEn: string;
  description: string;
  descriptionEn: string;
  external: boolean;
  registrationUrl: string;
  organizerName: string;
  externalVenue: string;
  externalVenueName: string;
  /** Edit of an event's category: its display name. */
  label: string;
  labelEn: string;
  categories: CategoryRowValue[];
}

/**
 * Create/edit tournament dialog (docs/13 §7). Fee is edited in GEL and
 * crosses the wire as integer tetri; the deadline is a local datetime input
 * converted to an ISO instant. The academy is derived server-side from the
 * chosen facility — nothing tenant-y is sent from the client.
 *
 * Superadmins also get the «გარე ტურნირი» switch (docs/26 §WP-1d): an
 * EXTERNAL tournament of a non-partner club, registered for on the
 * organizer's own site. It carries an `external` block (registration URL,
 * organizer, a directory venue or a free-text place) and no facility. The
 * kind is fixed at creation (the API rejects internal ↔ external switches, so
 * registrations and fees are never stranded): the switch is locked on edit.
 *
 * Host venues come from `GET /tournaments/venues` (docs/33 §6): an admin's
 * academy facilities, every live facility for an organizer / superadmin.
 *
 * CREATE can describe a multi-category EVENT (docs/33 §5): «+ კატეგორია»
 * turns the single tournament into two category rows (the current values +
 * a new one) and hides the top-level type / format / level / category / fee
 * / capacity; removing back to one row folds it into the single tournament
 * again. EDIT of an event's category shows its `label` / `labelEn`.
 */
@Component({
  selector: 'app-tournament-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TPipe],
  templateUrl: './tournament-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentFormComponent implements OnInit {
  form!: FormGroup;

  private readonly context = inject(SS_DIALOG_CONTEXT) as SsDialogContext<
    Tournament | null,
    { tournament?: Tournament }
  >;
  private readonly fb = inject(FormBuilder);
  private readonly tournamentService = inject(TournamentService);
  private readonly venueService = inject(VenueService);
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSuperAdmin = this.auth.isSuperAdmin;
  /** Where the caller may host (GET /tournaments/venues). */
  protected readonly facilities = signal<TournamentVenue[]>([]);
  /** Mirrors the «კატეგორიები» rows (OnPush-friendly); 0 = a single tournament. */
  protected readonly categoryCount = signal(0);
  protected readonly categoriesMax = EVENT_CATEGORIES_MAX;
  protected readonly labelMax = CATEGORY_LABEL_MAX;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly formatLabels = FORMAT_LABELS;
  protected readonly levelLabels = LEVEL_LABELS;
  protected readonly categoryLabels = CATEGORY_LABELS;
  /** Superadmin: directory venues for the external-venue picker. */
  protected readonly venues = signal<Venue[]>([]);
  /** Mirrors the `external` switch (OnPush-friendly). */
  protected readonly isExternal = signal(false);
  /** Mirrors `externalVenue`: a directory venue replaces the free-text place. */
  protected readonly hasDirectoryVenue = signal(false);

  protected readonly limits = {
    registrationUrl: EXTERNAL_REGISTRATION_URL_MAX,
    organizer: EXTERNAL_ORGANIZER_MAX,
    venueName: EXTERNAL_VENUE_NAME_MAX,
  };

  /** Option label — the operator's English facility name when one exists. */
  protected facilityLabel(facility: TournamentVenue): string {
    return localizedName(facility);
  }

  /** 'ვაკის პადელი · თბილისი' — the venue, then its town. */
  protected venueLabel(venue: Venue): string {
    const name = localizedName(venue) || venue._id;
    const city = venueCityName(venue.city);
    return city ? `${name} · ${city}` : name;
  }

  protected readonly isSaving = signal(false);
  /** Mirrors the `facility` control for the chip rail (OnPush-friendly). */
  protected readonly selectedFacilityId = signal<string>('');

  protected readonly typeOptions = Object.keys(TYPE_LABELS) as TournamentType[];
  protected readonly formatOptions = Object.keys(FORMAT_LABELS) as TournamentFormat[];
  protected readonly levelOptions = Object.keys(LEVEL_LABELS) as TournamentLevel[];
  protected readonly categoryOptions = Object.keys(CATEGORY_LABELS) as TournamentCategory[];

  protected readonly stringifyType = (v: TournamentType): string => TYPE_LABELS[v] ?? String(v);
  protected readonly stringifyFormat = (v: TournamentFormat): string =>
    FORMAT_LABELS[v] ?? String(v);
  protected readonly stringifyLevel = (v: TournamentLevel): string => LEVEL_LABELS[v] ?? String(v);
  protected readonly stringifyCategory = (v: TournamentCategory): string =>
    CATEGORY_LABELS[v] ?? String(v);

  protected get isEditMode(): boolean {
    return !!this.context.data?.tournament;
  }

  /** Editing one category of an event (label inputs + the shared-fields hint). */
  protected get isEventCategory(): boolean {
    return !!this.context.data?.tournament?.event;
  }

  /** The «კატეგორიები» rows. */
  protected get categoryRows(): FormArray<FormGroup> {
    return this.form.get('categories') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    const t = this.context.data?.tournament;
    const ext = t?.external ?? null;

    this.form = this.fb.group(
      {
        name: [t?.name ?? '', [Validators.required, Validators.minLength(3)]],
        nameEn: [t?.nameEn ?? ''],
        facility: [t?.facility ?? '', [Validators.required]],
        type: [t?.type ?? 'doubles', [Validators.required]],
        format: [t?.format ?? 'knockout', [Validators.required]],
        level: [t?.level ?? 'any', [Validators.required]],
        category: [t?.category ?? 'mixed', [Validators.required]],
        startDate: [t?.startDate ?? '', [Validators.required]],
        startTime: [t?.startTime ?? '10:00', [Validators.required]],
        endDate: [t?.endDate ?? ''],
        registrationDeadline: [isoToLocalInput(t?.registrationDeadline)],
        entryFeeGel: [
          t ? tetriToGel(t.entryFeeTetri) : 0,
          [Validators.required, Validators.min(0), Validators.max(10_000)],
        ],
        maxParticipants: [
          t?.maxParticipants ?? 16,
          [Validators.required, Validators.min(2), Validators.max(512)],
        ],
        prizeDescription: [t?.prizeDescription ?? ''],
        prizeDescriptionEn: [t?.prizeDescriptionEn ?? ''],
        description: [t?.description ?? ''],
        descriptionEn: [t?.descriptionEn ?? ''],
        // external tournament (superadmin only; disabled while the switch is off)
        external: [!!ext],
        registrationUrl: [
          ext?.registrationUrl ?? '',
          [
            requiredTrimmed,
            httpUrlValidator,
            Validators.maxLength(EXTERNAL_REGISTRATION_URL_MAX),
          ],
        ],
        organizerName: [ext?.organizerName ?? '', [Validators.maxLength(EXTERNAL_ORGANIZER_MAX)]],
        externalVenue: [ext?.venue ?? ''],
        externalVenueName: [
          ext?.venueName ?? '',
          [Validators.maxLength(EXTERNAL_VENUE_NAME_MAX)],
        ],
        // this category's display name inside its event (edit only)
        label: [t?.event?.label ?? '', [Validators.maxLength(CATEGORY_LABEL_MAX)]],
        labelEn: [t?.event?.labelEn ?? '', [Validators.maxLength(CATEGORY_LABEL_MAX)]],
        // a multi-category event (create only): 0 rows = a single tournament
        categories: this.fb.array<FormGroup>([]),
      },
      { validators: externalPlaceValidator },
    );

    this.selectedFacilityId.set(t?.facility ?? '');
    this.syncExternal();
    if (this.isEditMode) {
      // Fixed at creation: the API answers 400 to an internal ↔ external switch.
      this.form.get('external')!.disable({ emitEvent: false });
    }
    this.form
      .get('external')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncExternal());
    this.form
      .get('externalVenue')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncExternal());

    if (this.isSuperAdmin()) {
      this.venueService
        .getVenues({ page: 1, limit: VENUE_PICKER_LIMIT })
        .pipe(
          take(1),
          map(({ data }) => data),
          catchError(() => of([] as Venue[])),
        )
        .subscribe((venues) => this.venues.set(venues));
    }

    // Where the caller may host feeds the venue chip rail (GET
    // /tournaments/venues, docs/33 §6). An admin's first facility is
    // preselected on create so the required control starts valid; a
    // superadmin / organizer sees every live facility and picks (a guessed
    // host would land the tournament in some academy) — unless only one is
    // on offer. An edited tournament's own venue always stays on the rail.
    this.tournamentService
      .getVenues()
      .pipe(
        take(1),
        catchError(() => of([] as TournamentVenue[])),
      )
      .subscribe((venues) => {
        const list = [...venues];
        if (t?.facility && !list.some((v) => v._id === t.facility)) {
          list.push({ _id: t.facility, name: t.facilityName ?? t.facility });
        }
        this.facilities.set(list);
        const pickFirst =
          !this.isSuperAdmin() && !this.auth.isOrganizer() ? list.length > 0 : list.length === 1;
        if (!this.isEditMode && !this.selectedFacilityId() && pickFirst) {
          this.selectFacility(list[0]._id);
        }
      });
  }

  // ── «კატეგორიები» (create only) ────────────────────────────────────────────

  private categoryGroup(value: Partial<CategoryRowValue>): FormGroup {
    return this.fb.group({
      label: [value.label ?? '', [Validators.maxLength(CATEGORY_LABEL_MAX)]],
      labelEn: [value.labelEn ?? '', [Validators.maxLength(CATEGORY_LABEL_MAX)]],
      type: [value.type ?? 'doubles', [Validators.required]],
      format: [value.format ?? 'knockout', [Validators.required]],
      category: [value.category ?? 'mixed', [Validators.required]],
      level: [value.level ?? 'any', [Validators.required]],
      entryFeeGel: [
        value.entryFeeGel ?? 0,
        [Validators.required, Validators.min(0), Validators.max(10_000)],
      ],
      maxParticipants: [
        value.maxParticipants ?? 16,
        [Validators.required, Validators.min(2), Validators.max(512)],
      ],
    });
  }

  /** The top-level category fields, as a row. */
  private topLevelRow(): Partial<CategoryRowValue> {
    const v = this.form.getRawValue() as TournamentFormValue;
    return {
      type: v.type,
      format: v.format,
      category: v.category,
      level: v.level,
      entryFeeGel: v.entryFeeGel,
      maxParticipants: v.maxParticipants,
    };
  }

  /**
   * «+ კატეგორია». The first tap makes an event of two categories: the
   * values typed so far + a new one; later taps add one more (copying the
   * last row's type and format). The top-level category fields step aside.
   */
  protected addCategory(): void {
    const rows = this.categoryRows;
    if (rows.length >= EVENT_CATEGORIES_MAX) return;
    if (rows.length === 0) {
      const current = this.topLevelRow();
      rows.push(this.categoryGroup(current));
      rows.push(this.categoryGroup({ ...current, label: '', labelEn: '' }));
    } else {
      const last = rows.at(rows.length - 1).getRawValue() as CategoryRowValue;
      rows.push(this.categoryGroup({ ...last, label: '', labelEn: '' }));
    }
    this.syncCategories();
  }

  /** Removing down to one row folds it back into the single tournament. */
  protected removeCategory(index: number): void {
    const rows = this.categoryRows;
    rows.removeAt(index);
    if (rows.length === 1) {
      const only = rows.at(0).getRawValue() as CategoryRowValue;
      rows.clear();
      this.form.patchValue({
        type: only.type,
        format: only.format,
        category: only.category,
        level: only.level,
        entryFeeGel: only.entryFeeGel,
        maxParticipants: only.maxParticipants,
      });
    }
    this.syncCategories();
  }

  /** With category rows the top-level category fields are disabled (not validated, not sent). */
  private syncCategories(): void {
    const event = this.categoryRows.length >= 2;
    this.categoryCount.set(this.categoryRows.length);
    for (const name of CATEGORY_CONTROLS) {
      const control = this.form.get(name)!;
      if (event) control.disable({ emitEvent: false });
      else control.enable({ emitEvent: false });
    }
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  protected rowInvalid(index: number, name: string): boolean {
    const control = this.categoryRows.at(index)?.get(name);
    return !!control && control.touched && control.invalid;
  }

  /**
   * External on: the facility is neither required nor sent (disabled), the
   * external block is validated — and a picked directory venue replaces the
   * free-text place. External off: the reverse. A non-superadmin never gets
   * the switch, so their form is always the internal one.
   */
  private syncExternal(): void {
    const on = this.isSuperAdmin() && !!this.form.get('external')!.value;
    const hasVenue = !!this.form.get('externalVenue')!.value;
    this.isExternal.set(on);
    this.hasDirectoryVenue.set(hasVenue);
    // An external tournament is one listing — it has no categories.
    if (on && this.categoryRows.length) {
      while (this.categoryRows.length > 1) this.removeCategory(this.categoryRows.length - 1);
    }

    const facility = this.form.get('facility')!;
    if (on) {
      facility.disable({ emitEvent: false });
    } else {
      facility.enable({ emitEvent: false });
    }
    for (const name of EXTERNAL_CONTROLS) {
      const control = this.form.get(name)!;
      const enabled = on && !(name === 'externalVenueName' && hasVenue);
      if (enabled) {
        control.enable({ emitEvent: false });
      } else {
        control.disable({ emitEvent: false });
      }
    }
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  protected facilityId(facility: TournamentVenue): string {
    return facility._id;
  }

  protected selectFacility(id: string): void {
    this.selectedFacilityId.set(id);
    this.form.get('facility')?.setValue(id);
    this.form.get('facility')?.markAsDirty();
  }

  protected showError(name: string, error?: string): boolean {
    const control = this.form.get(name);
    if (!control || !control.touched || control.disabled) return false;
    return error ? control.hasError(error) : control.invalid;
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue() as TournamentFormValue;
    const external = this.isExternal();
    // A multi-category event (create, internal, ≥ 2 rows).
    const event = !external && !this.isEditMode && v.categories.length >= 2;

    const shared: Omit<CreateTournamentDto, 'facility' | 'external'> = {
      name: v.name.trim(),
      nameEn: v.nameEn.trim() || undefined,
      startDate: v.startDate,
      startTime: v.startTime,
      endDate: v.endDate || undefined,
      registrationDeadline: v.registrationDeadline
        ? new Date(v.registrationDeadline).toISOString()
        : undefined,
      prizeDescription: v.prizeDescription.trim() || undefined,
      prizeDescriptionEn: v.prizeDescriptionEn.trim() || undefined,
      description: v.description.trim() || undefined,
      descriptionEn: v.descriptionEn.trim() || undefined,
    };
    const base: Omit<CreateTournamentDto, 'facility' | 'external'> = event
      ? { ...shared, categories: v.categories.map(categoryRowToDto) }
      : {
          ...shared,
          type: v.type,
          format: v.format,
          level: v.level,
          category: v.category,
          entryFeeTetri: gelToTetri(v.entryFeeGel),
          maxParticipants: v.maxParticipants,
        };

    this.isSaving.set(true);
    const editing = this.context.data?.tournament;
    let request: Observable<Tournament>;
    if (editing) {
      const dto: UpdateTournamentDto = external
        ? { ...base, external: this.externalPayload(v, true) }
        : { facility: v.facility, ...base };
      if (editing.event) {
        // This category's name inside its event ('' clears it).
        dto.label = v.label.trim();
        dto.labelEn = v.labelEn.trim();
      }
      request = this.tournamentService.updateTournament(editing._id, dto);
    } else {
      const dto: CreateTournamentDto = external
        ? { ...base, external: this.externalPayload(v, false) }
        : { facility: v.facility, ...base };
      request = this.tournamentService.createTournament(dto);
    }

    request.pipe(take(1)).subscribe({
      next: (tournament) => this.context.completeWith(tournament),
      error: (err: HttpErrorResponse) => {
        this.isSaving.set(false);
        const message =
          err.status === 400
            ? tr('შეამოწმე ველები — მოთხოვნა ვერ დამუშავდა')
            : tr('შენახვა ვერ მოხერხდა, სცადეთ თავიდან');
        this.alerts.open(message, { appearance: 'negative' }).pipe(take(1)).subscribe();
      },
    });
  }

  /**
   * The `external` block: empty optionals left out, a directory venue OR the
   * free-text place. An edit replaces the whole block, and sends `venue: null`
   * when no directory venue is picked so a previous one is cleared.
   */
  private externalPayload(v: TournamentFormValue, editing: boolean): TournamentExternal {
    const venue = v.externalVenue || '';
    const organizerName = v.organizerName.trim();
    const venueName = v.externalVenueName.trim();
    return {
      registrationUrl: v.registrationUrl.trim(),
      ...(organizerName ? { organizerName } : {}),
      ...(venue ? { venue } : editing ? { venue: null } : {}),
      ...(!venue && venueName ? { venueName } : {}),
    };
  }

  protected cancel(): void {
    this.context.completeWith(null);
  }
}
