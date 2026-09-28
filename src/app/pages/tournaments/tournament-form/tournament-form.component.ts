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
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, take } from 'rxjs';
import { TournamentService } from '../../../services/http-services/tournament.service';
import { FacilityService } from '../../../services/http-services/facility.service';
import { AcademyService } from '../../../services/http-services/academy.service';
import { VenueService } from '../../../services/http-services/venue.service';
import { AuthService } from '../../../shared/services/auth.service';
import { TenantService } from '../../../shared/services/tenant.service';
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
import { Facility } from '../../../shared/models/facility.model';
import { Venue, venueCityName } from '../../../shared/models/venue.model';
import { gelToTetri, tetriToGel } from '../../../shared/utils/money.util';
import { loadPartnerFacilities } from '../../venues/partner-facilities';

import { liveLabels, tr } from '../../../shared/i18n/lang';
import { localizedName } from '../../../shared/i18n/localized';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { SsToastService } from '../../../shared/ui/toast.service';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../../shared/ui/dialog.service';
export const TYPE_LABELS: Record<TournamentType, string> = liveLabels({
  singles: 'სინგლები',
  doubles: 'წყვილები',
});
export const FORMAT_LABELS: Record<TournamentFormat, string> = liveLabels({
  knockout: 'ნოკაუტი',
  round_robin: 'წრიული',
  groups_playoffs: 'ჯგუფები + პლეიოფი',
  championship: 'ჩემპიონატი',
  americano: 'ამერიკანო',
  mexicano: 'მექსიკანო',
});
export const LEVEL_LABELS: Record<TournamentLevel, string> = liveLabels({
  any: 'ნებისმიერი',
  beginner: 'დამწყები',
  intermediate: 'საშუალო',
  advanced: 'გამოცდილი',
});
export const CATEGORY_LABELS: Record<TournamentCategory, string> = liveLabels({
  men: 'კაცები',
  women: 'ქალები',
  mixed: 'შერეული',
});

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
  private readonly facilityService = inject(FacilityService);
  private readonly academyService = inject(AcademyService);
  private readonly venueService = inject(VenueService);
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSuperAdmin = this.auth.isSuperAdmin;
  protected readonly facilities = signal<Facility[]>([]);
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
  protected facilityLabel(facility: Facility): string {
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

    // The academy's facilities feed the host-venue chip rail; when creating,
    // the first facility is preselected so the required control starts valid.
    // A superadmin has no academy of their own — they get every facility (no
    // preselection: a guessed host would land the tournament in some academy).
    this.tenant
      .ensure()
      .pipe(take(1))
      .subscribe(() => {
        const academyId = this.tenant.academyId();
        if (!academyId) {
          if (this.isSuperAdmin()) {
            loadPartnerFacilities(this.academyService, this.facilityService)
              .pipe(take(1))
              .subscribe((options) => this.facilities.set(options.map((o) => o.facility)));
          }
          return;
        }
        this.facilityService
          .getFacilitiesByAcademy(academyId)
          .pipe(take(1))
          .subscribe((facilities) => {
            this.facilities.set(facilities);
            if (!this.selectedFacilityId() && facilities.length > 0) {
              this.selectFacility(this.facilityId(facilities[0]));
            }
          });
      });
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

  protected facilityId(facility: Facility): string {
    return facility._id ?? facility.id ?? '';
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

    const base: Omit<CreateTournamentDto, 'facility' | 'external'> = {
      name: v.name.trim(),
      nameEn: v.nameEn.trim() || undefined,
      type: v.type,
      format: v.format,
      level: v.level,
      category: v.category,
      startDate: v.startDate,
      startTime: v.startTime,
      endDate: v.endDate || undefined,
      registrationDeadline: v.registrationDeadline
        ? new Date(v.registrationDeadline).toISOString()
        : undefined,
      entryFeeTetri: gelToTetri(v.entryFeeGel),
      maxParticipants: v.maxParticipants,
      prizeDescription: v.prizeDescription.trim() || undefined,
      prizeDescriptionEn: v.prizeDescriptionEn.trim() || undefined,
      description: v.description.trim() || undefined,
      descriptionEn: v.descriptionEn.trim() || undefined,
    };

    this.isSaving.set(true);
    const editing = this.context.data?.tournament;
    let request: Observable<Tournament>;
    if (editing) {
      const dto: UpdateTournamentDto = external
        ? { ...base, external: this.externalPayload(v, true) }
        : { facility: v.facility, ...base };
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
