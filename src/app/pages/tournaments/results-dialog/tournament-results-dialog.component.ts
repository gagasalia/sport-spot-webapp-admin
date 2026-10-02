import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  debounceTime,
  filter,
  forkJoin,
  groupBy,
  map,
  mergeMap,
  of,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { RankingService, apiErrorMessage } from '../../../services/http-services/ranking.service';
import { TournamentService } from '../../../services/http-services/tournament.service';
import { tr } from '../../../shared/i18n/lang';
import { TPipe } from '../../../shared/i18n/t.pipe';
import {
  CustomerLookupView,
  ERR_INVALID_SET,
  ERR_NAME_REQUIRED,
  GameScore,
  GameScoreType,
  MAX_POINTS_PER_GAME,
  MAX_SETS_PER_GAME,
  MODE_KEYS,
  PARTICIPANT_NAME_MAX,
  PARTICIPANT_NAME_MIN,
  ParticipantKey,
  ScorecardGameView,
  ScorecardMode,
  ScorecardView,
  TournamentResultDto,
  VOID_REASON_MAX,
} from '../../../shared/models/ranking.model';
import {
  PARTNER_NAME_MAX,
  Tournament,
  TournamentRegistration,
  UpdateRegistrationDto,
} from '../../../shared/models/tournament.model';
import { SsAvatarComponent } from '../../../shared/ui/ss-avatar.component';
import { formatMemberId } from '../../../shared/utils/member-id.util';
import {
  SS_DIALOG_CONTEXT,
  SsDialogContext,
  SsDialogService,
} from '../../../shared/ui/dialog.service';
import { SsToastService } from '../../../shared/ui/toast.service';
import {
  SCORECARD_STATUS_CLASSES,
  SCORECARD_STATUS_LABELS,
  deltaClass,
  deltaOf,
  deltaTitle,
  formatDelta,
  scoreLabel,
  teamNames,
} from '../../../shared/utils/ranking-display.util';
import { ScoreRow, checkPoints, checkSets } from '../../../shared/utils/score-rules.util';
import {
  canonicalPhone,
  isAcceptablePhone,
} from '../../../shared/validators/phone-format.validator';
import { ReasonDialogComponent, ReasonDialogData } from '../../customers/reason-dialog.component';

/** The slot picker's value: '' (none), a walk-in, or `<registrationId>:c|p`. */
export const WALK_IN = 'walkin';

/** Typed phones settle this long before the account lookup fires. */
export const LOOKUP_DEBOUNCE_MS = 350;

/** The account lookup of a slot's typed phone (GET /ranking/customers/lookup). */
export interface SlotLookup {
  /** The E.164 number this answer belongs to — stale once the phone changes. */
  phone: string;
  state: 'loading' | 'found' | 'missing' | 'error';
  account?: CustomerLookupView;
}

/** One participant slot of the `+ თამაში` form. */
export interface SlotState {
  pick: string;
  phone: string;
  name: string;
  /** The phone came from the registration snapshot (shown read-only). */
  phoneLocked: boolean;
  /** The name came from the registration snapshot (shown read-only). */
  nameLocked: boolean;
  /** Account lookup of an editable phone; null for snapshot phones. */
  lookup: SlotLookup | null;
}

/** One person a slot can pick: a registration's captain (`c`) or partner (`p`). */
export interface PoolPerson {
  value: string;
  reg: TournamentRegistration;
  role: 'c' | 'p';
}

/** RAW-Georgian per-field problems of one slot. */
export interface SlotErrors {
  pick?: string;
  phone?: string;
  name?: string;
}

/** A server error to show inline: RAW-Georgian sentence + the API's own detail. */
export interface ServerError {
  message: string;
  detail: string;
}

/** A lookup answer routed back to its slot (`view` null = the request failed). */
interface LookupAnswer {
  side: number;
  index: number;
  canonical: string;
  view: CustomerLookupView | null;
}

const EMPTY_SLOT: SlotState = {
  pick: '',
  phone: '',
  name: '',
  phoneLocked: false,
  nameLocked: false,
  lookup: null,
};

const PER_SIDE: Record<ScorecardMode, number> = { doubles: 2, singles: 1 };

/** Pairs play doubles; americano / mexicano rotate partners — doubles too. */
export function defaultMode(t: Pick<Tournament, 'type' | 'format'>): ScorecardMode {
  return t.type === 'doubles' || t.format === 'americano' || t.format === 'mexicano'
    ? 'doubles'
    : 'singles';
}

/** Americano / mexicano rounds are scored in points; everything else in sets. */
export function defaultScoreType(t: Pick<Tournament, 'format'>): GameScoreType {
  return t.format === 'americano' || t.format === 'mexicano' ? 'points' : 'sets';
}

function emptySides(mode: ScorecardMode): SlotState[][] {
  return [0, 1].map(() => Array.from({ length: PER_SIDE[mode] }, () => ({ ...EMPTY_SLOT })));
}

function emptySetRows(): ScoreRow[] {
  return [
    [null, null],
    [null, null],
  ];
}

/** A finite number from a numeric input, else null (cleared / NaN). */
function toCell(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tournament results (docs/25 §4.1 "Tournament", §6.5): the list of the
 * tournament's rated results — teams as names, scores, per-player deltas,
 * status, void with a reason — and the `+ თამაში` form that enters one
 * pairing. Operator results skip the approval machine: the API creates them
 * `confirmed` and rates them at once, so the saved row comes back with its
 * deltas.
 *
 * Slots pick from the registrations (a doubles registration's captain fills
 * the side's first slot and pulls the partner into the second) or take a
 * walk-in phone. A typed phone is looked up (debounced): an account shows
 * its name + avatar and needs no name; an unknown number needs one. A
 * registration without `partnerPhone` shows an inline phone field whose
 * value is PATCHed onto the registration before the result is saved, and the
 * registrations list is refreshed afterwards.
 *
 * Scores are validated client-side with the API's own rules
 * (score-rules.util); the API's `invalid_set_score` message is surfaced if
 * the two ever disagree.
 */
@Component({
  selector: 'app-tournament-results-dialog',
  standalone: true,
  imports: [DatePipe, FormsModule, SsAvatarComponent, TPipe],
  templateUrl: './tournament-results-dialog.component.html',
  styleUrl: './tournament-results-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentResultsDialogComponent implements OnInit {
  private readonly context = inject(SS_DIALOG_CONTEXT) as SsDialogContext<
    void,
    { tournament: Tournament }
  >;
  private readonly ranking = inject(RankingService);
  private readonly tournamentService = inject(TournamentService);
  private readonly dialogs = inject(SsDialogService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tournament: Tournament = this.context.data.tournament;

  // ── results list ───────────────────────────────────────────────────────────
  protected readonly results = signal<ScorecardView[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly registrations = signal<TournamentRegistration[]>([]);

  // ── `+ თამაში` form ────────────────────────────────────────────────────────
  protected readonly formOpen = signal(false);
  protected readonly mode = signal<ScorecardMode>(defaultMode(this.tournament));
  protected readonly sides = signal<SlotState[][]>(emptySides(this.mode()));
  protected readonly scoreType = signal<GameScoreType>(defaultScoreType(this.tournament));
  protected readonly setRows = signal<ScoreRow[]>(emptySetRows());
  protected readonly pointsRow = signal<ScoreRow>([null, null]);
  /** 'YYYY-MM-DD'; the tournament's start date = "let the API default it". */
  protected readonly playedOn = signal<string>(this.tournament.startDate ?? '');
  /** Set on the first save attempt: from then on every error shows. */
  protected readonly submitted = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly serverError = signal<ServerError | null>(null);

  protected readonly walkIn = WALK_IN;
  protected readonly maxSets = MAX_SETS_PER_GAME;
  protected readonly maxPoints = MAX_POINTS_PER_GAME;
  protected readonly nameMax = PARTICIPANT_NAME_MAX;
  protected readonly statusLabels = SCORECARD_STATUS_LABELS;
  protected readonly statusClasses = SCORECARD_STATUS_CLASSES;
  protected readonly scoreLabel = scoreLabel;
  protected readonly formatDelta = formatDelta;
  protected readonly deltaClass = deltaClass;
  protected readonly deltaTitle = deltaTitle;
  protected readonly deltaOf = deltaOf;
  protected readonly formatMemberId = formatMemberId;

  /** Every typed (editable) phone, per slot — debounced into account lookups. */
  private readonly phoneTyped$ = new Subject<{ side: number; index: number; phone: string }>();

  /** Everyone a slot can pick, grouped per live registration. */
  protected readonly pool = computed(() => {
    const doubles = this.tournament.type === 'doubles';
    return this.registrations()
      .filter((reg) => reg.status === 'registered')
      .map((reg) => {
        const people: PoolPerson[] = [{ value: `${reg._id}:c`, reg, role: 'c' }];
        if (doubles || reg.partnerName || reg.partnerPhone) {
          people.push({ value: `${reg._id}:p`, reg, role: 'p' });
        }
        return { reg, people };
      });
  });

  private readonly people = computed(
    () => new Map(this.pool().flatMap((group) => group.people.map((p) => [p.value, p]))),
  );

  protected readonly setsCheck = computed(() => checkSets(this.setRows()));
  protected readonly pointsCheck = computed(() => checkPoints(this.pointsRow()));

  protected readonly slotErrors = computed<SlotErrors[][]>(() =>
    this.sides().map((side) => side.map((slot) => this.errorsOf(slot))),
  );

  /** Two slots carrying the same number (compared in E.164). */
  protected readonly duplicatePhone = computed(() => {
    const seen = new Set<string>();
    for (const slot of this.sides().flat()) {
      const phone = canonicalPhone(slot.phone);
      if (!phone) continue;
      if (seen.has(phone)) return true;
      seen.add(phone);
    }
    return false;
  });

  protected readonly scoreValid = computed(() =>
    this.scoreType() === 'sets' ? this.setsCheck().valid : this.pointsCheck().valid,
  );

  protected readonly formValid = computed(
    () =>
      this.scoreValid() &&
      !this.duplicatePhone() &&
      this.slotErrors().every((side) => side.every((e) => !e.pick && !e.phone && !e.name)),
  );

  constructor() {
    // One debounced lookup stream per slot: a later number in the same slot
    // cancels the earlier request (switchMap), other slots are independent.
    this.phoneTyped$
      .pipe(
        groupBy((e) => `${e.side}:${e.index}`),
        mergeMap((slot$) =>
          slot$.pipe(
            debounceTime(LOOKUP_DEBOUNCE_MS),
            switchMap((e) => this.lookupPhone(e)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((answer) => this.applyLookup(answer));
  }

  ngOnInit(): void {
    this.loadResults();
    this.loadRegistrations();
  }

  /**
   * The pickers' registrations. External tournaments register off-site: no
   * registrations (the API 400s the read), walk-ins only.
   */
  protected loadRegistrations(): void {
    if (this.tournament.external) return;
    this.tournamentService
      .getRegistrations(this.tournament._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (regs) => this.registrations.set(regs ?? []),
        error: () => this.registrations.set([]),
      });
  }

  protected loadResults(): void {
    this.isLoading.set(true);
    this.loadError.set(false);
    this.ranking
      .tournamentResults(this.tournament._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.results.set(list);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.loadError.set(true);
        },
      });
  }

  // ── form: slots ────────────────────────────────────────────────────────────

  protected toggleForm(): void {
    this.formOpen.update((open) => !open);
  }

  protected setMode(mode: ScorecardMode): void {
    if (mode === this.mode()) return;
    this.mode.set(mode);
    // Keep each side's first pick; add/drop the second slot.
    this.sides.update((sides) =>
      sides.map((side) =>
        Array.from({ length: PER_SIDE[mode] }, (_, i) => side[i] ?? { ...EMPTY_SLOT }),
      ),
    );
    this.serverError.set(null);
  }

  /**
   * A slot picks a person. In doubles, a captain picked into a side's first
   * slot pulls their partner into the (empty) second slot — one pick = the
   * registered pair.
   */
  protected pick(side: number, index: number, value: string): void {
    this.sides.update((sides) => {
      const next = sides.map((s) => s.map((slot) => ({ ...slot })));
      next[side][index] = this.slotFor(value);
      if (this.mode() === 'doubles' && index === 0 && value.endsWith(':c')) {
        const partner = `${value.slice(0, -2)}:p`;
        const taken = next.some((s) => s.some((slot) => slot.pick === partner));
        if (!next[side][1]?.pick && !taken && this.people().has(partner)) {
          next[side][1] = this.slotFor(partner);
        }
      }
      return next;
    });
    this.serverError.set(null);
  }

  /** An editable phone changed: mark the lookup pending and queue it. */
  protected setPhone(side: number, index: number, phone: string): void {
    const value = phone ?? '';
    const canonical = canonicalPhone(value);
    this.patchSlot(side, index, {
      phone: value,
      lookup: canonical ? { phone: canonical, state: 'loading' } : null,
    });
    if (canonical) this.phoneTyped$.next({ side, index, phone: value });
  }

  protected setName(side: number, index: number, name: string): void {
    this.patchSlot(side, index, { name: name ?? '' });
  }

  /** A person already sits in another slot (walk-ins are never "taken"). */
  protected isTaken(value: string, side: number, index: number): boolean {
    return this.sides().some((s, si) =>
      s.some((slot, i) => slot.pick === value && !(si === side && i === index)),
    );
  }

  protected personFor(slot: SlotState): PoolPerson | undefined {
    return this.people().get(slot.pick);
  }

  /** The lookup answer for the slot's CURRENT phone (null when stale / none). */
  protected lookupOf(slot: SlotState): SlotLookup | null {
    const lookup = slot.lookup;
    return lookup && lookup.phone === canonicalPhone(slot.phone) ? lookup : null;
  }

  /** The account behind the slot's typed phone, once the lookup found one. */
  protected accountOf(slot: SlotState): CustomerLookupView | null {
    const lookup = this.lookupOf(slot);
    return lookup?.state === 'found' && lookup.account ? lookup.account : null;
  }

  /** A registration partner whose phone the operator types (persisted on save). */
  protected isPartnerPhoneEntry(slot: SlotState): boolean {
    return !slot.phoneLocked && this.personFor(slot)?.role === 'p';
  }

  /** Registration group label: "ნინო + ლუკა" (live language for the fallback). */
  protected groupLabel(reg: TournamentRegistration): string {
    const captain = reg.playerName || reg.playerEmail || '—';
    return reg.partnerName || this.tournament.type === 'doubles'
      ? `${captain} + ${reg.partnerName || tr('პარტნიორი')}`
      : captain;
  }

  /** Option label: name · phone (or a "phone missing" hint). */
  protected personLabel(person: PoolPerson): string {
    const reg = person.reg;
    const name =
      person.role === 'c'
        ? reg.playerName || reg.playerEmail || '—'
        : reg.partnerName || tr('პარტნიორი');
    const phone = person.role === 'c' ? reg.playerPhone : reg.partnerPhone;
    const prefix = person.role === 'p' ? '↳ ' : '';
    return `${prefix}${name} · ${phone || tr('ტელეფონი აკლია')}`;
  }

  /** Errors show after the first save attempt; a typed bad phone shows at once. */
  protected showSlotError(errors: SlotErrors, field: keyof SlotErrors, slot: SlotState): boolean {
    if (!errors[field]) return false;
    if (this.submitted()) return true;
    return field === 'phone' && slot.phone.trim().length > 0;
  }

  // ── form: score ────────────────────────────────────────────────────────────

  protected setScoreType(type: GameScoreType): void {
    this.scoreType.set(type);
    this.serverError.set(null);
  }

  protected setCell(row: number, col: 0 | 1, value: unknown): void {
    this.setRows.update((rows) =>
      rows.map((r, i) =>
        i === row ? (col === 0 ? [toCell(value), r[1]] : [r[0], toCell(value)]) : r,
      ),
    );
    this.serverError.set(null);
  }

  protected setPoint(col: 0 | 1, value: unknown): void {
    this.pointsRow.update((r) => (col === 0 ? [toCell(value), r[1]] : [r[0], toCell(value)]));
    this.serverError.set(null);
  }

  protected addSet(): void {
    if (this.setRows().length >= MAX_SETS_PER_GAME) return;
    this.setRows.update((rows) => [...rows, [null, null]]);
  }

  protected removeSet(row: number): void {
    if (this.setRows().length <= 1) return;
    this.setRows.update((rows) => rows.filter((_, i) => i !== row));
  }

  /** A row's error shows once both numbers are in, or after a save attempt. */
  protected showRowError(row: number): boolean {
    const error = this.setsCheck().rowErrors[row];
    if (!error) return false;
    const [a, b] = this.setRows()[row] ?? [null, null];
    return this.submitted() || (a != null && b != null);
  }

  protected showPointsError(): boolean {
    const [a, b] = this.pointsRow();
    return !!this.pointsCheck().error && (this.submitted() || (a != null && b != null));
  }

  /** The side labels the score columns follow ("გუნდი 1" = the first number). */
  protected sideLabel(side: number): string {
    const names = (this.sides()[side] ?? [])
      .map((slot) => (this.accountOf(slot)?.name ?? slot.name).trim())
      .filter(Boolean);
    return names.length ? names.join(' + ') : tr(side === 0 ? 'გუნდი 1' : 'გუნდი 2');
  }

  // ── save ───────────────────────────────────────────────────────────────────

  protected save(): void {
    this.submitted.set(true);
    this.serverError.set(null);
    if (!this.formValid() || this.isSaving()) return;

    const dto = this.buildDto();
    const patches = this.partnerPatches();
    this.isSaving.set(true);
    // 1) typed partner phones go onto their registrations, 2) the result.
    const persisted$: Observable<TournamentRegistration[]> = patches.length
      ? forkJoin(
          patches.map((p) =>
            this.tournamentService.updateRegistration(this.tournament._id, p.registrationId, p.dto),
          ),
        )
      : of([]);
    persisted$
      .pipe(
        catchError((err: unknown) => this.failSave(this.describeRegistrationError(err))),
        tap((updated) => this.mergeRegistrations(updated)),
        switchMap(() =>
          this.ranking
            .createTournamentResult(this.tournament._id, dto)
            .pipe(catchError((err: unknown) => this.failSave(this.describeSaveError(err)))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((created) => {
        this.isSaving.set(false);
        this.results.update((list) =>
          [...list.filter((c) => c.id !== created.id), created].sort(
            (x, y) => x.playedAt.localeCompare(y.playedAt) || x.id.localeCompare(y.id),
          ),
        );
        this.resetForm();
        // The registrations now carry the partner phones — refresh the pickers.
        if (patches.length) this.loadRegistrations();
        this.toast(tr('შედეგი შენახულია — რეიტინგები განახლდა'), 'success');
      });
  }

  /**
   * PATCH bodies for partner phones typed into the form (registrations
   * missing `partnerPhone`); the partner name rides along only where the
   * registration has none. A phone the registration already holds is skipped.
   */
  partnerPatches(): Array<{ registrationId: string; dto: UpdateRegistrationDto }> {
    const out: Array<{ registrationId: string; dto: UpdateRegistrationDto }> = [];
    for (const slot of this.sides().flat()) {
      const person = this.personFor(slot);
      const phone = slot.phone.trim();
      if (!person || person.role !== 'p' || slot.phoneLocked || !phone) continue;
      if (canonicalPhone(person.reg.partnerPhone ?? '') === canonicalPhone(phone)) continue;
      const dto: UpdateRegistrationDto = { partnerPhone: phone };
      if (!person.reg.partnerName?.trim()) {
        const name = (this.accountOf(slot)?.name ?? slot.name).trim().slice(0, PARTNER_NAME_MAX);
        if (name) dto.partnerName = name;
      }
      out.push({ registrationId: person.reg._id, dto });
    }
    return out;
  }

  /** A registration PATCH failed: nothing was rated; say why inline. */
  describeRegistrationError(err: unknown): ServerError {
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    return {
      message: 'პარტნიორის ტელეფონი რეგისტრაციაში ვერ შეინახა',
      detail: status === 400 ? apiErrorMessage(err) : '',
    };
  }

  /** The POST body — slots in a, b, c, d order; names only where they can matter. */
  buildDto(): TournamentResultDto {
    const mode = this.mode();
    const keys = MODE_KEYS[mode];
    const slots = this.sides().flat();
    const participants = slots.map((slot, i) => {
      // An account's name is snapshotted by the API — only unknown numbers send one.
      const name = this.accountOf(slot) ? '' : slot.name.trim().slice(0, PARTICIPANT_NAME_MAX);
      return {
        key: keys[i],
        phone: slot.phone.trim(),
        ...(name.length >= PARTICIPANT_NAME_MIN ? { name } : {}),
      };
    });
    const teams: ParticipantKey[][] =
      mode === 'doubles'
        ? [
            ['a', 'b'],
            ['c', 'd'],
          ]
        : [['a'], ['b']];
    const score: GameScore =
      this.scoreType() === 'sets'
        ? { type: 'sets', sets: this.setsCheck().sets }
        : { type: 'points', points: this.pointsCheck().points ?? [] };
    const day = this.playedOn();
    return {
      mode,
      participants,
      games: [{ teams, score }],
      // The tournament's own start day = the API default (its exact start).
      ...(day && day !== this.tournament.startDate
        ? { playedAt: new Date(`${day}T12:00:00`).toISOString() }
        : {}),
    };
  }

  /** Maps the API's error to an inline sentence (RAW Georgian) + its detail. */
  describeSaveError(err: unknown): ServerError {
    const raw = apiErrorMessage(err);
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    if (raw.startsWith(ERR_INVALID_SET)) {
      return {
        message: 'სეტის ანგარიში არასწორია',
        detail: raw.slice(ERR_INVALID_SET.length).replace(/^[:\s]+/, ''),
      };
    }
    if (raw.includes(ERR_NAME_REQUIRED)) {
      return { message: 'ამ ნომერზე ანგარიში არ არის — მიუთითეთ მოთამაშის სახელი', detail: '' };
    }
    if (raw.includes('duplicate_participant')) {
      return { message: 'ერთი და იგივე მოთამაშე ორჯერაა მითითებული', detail: '' };
    }
    if (raw.includes('tournament_not_published')) {
      return {
        message: 'შედეგები მხოლოდ გამოქვეყნებულ ან დასრულებულ ტურნირს ემატება',
        detail: '',
      };
    }
    if (status === 400) {
      return { message: 'შეამოწმე ველები — მოთხოვნა ვერ დამუშავდა', detail: raw };
    }
    if (status === 403) {
      return { message: 'ამ ტურნირზე წვდომა არ გაქვთ', detail: '' };
    }
    return { message: 'შენახვა ვერ მოხერხდა, სცადეთ თავიდან', detail: '' };
  }

  // ── void ───────────────────────────────────────────────────────────────────

  protected voidResult(card: ScorecardView): void {
    this.dialogs
      .open<string | null>(ReasonDialogComponent, {
        // The outlet renders the header raw → translate here; the payload
        // stays RAW (ReasonDialogComponent applies `| t`).
        label: tr('შედეგის ანულირება'),
        size: 'm',
        dismissible: true,
        closable: true,
        data: {
          content:
            'შედეგი ანულირდება და რეიტინგში აღარ ჩაითვლება. მოთამაშეების რეიტინგები გასწორდება ranking:replay-ის გაშვების შემდეგ.',
          placeholder: 'მაგ: შეცდომით შეყვანილი ანგარიში',
          yes: 'ანულირება',
          destructive: true,
        } as ReasonDialogData,
      })
      .pipe(
        take(1),
        filter((reason): reason is string => !!reason),
        switchMap((reason) =>
          this.ranking.voidTournamentResult(
            this.tournament._id,
            card.id,
            reason.slice(0, VOID_REASON_MAX),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (voided) => {
          this.results.update((list) => list.map((c) => (c.id === voided.id ? voided : c)));
          this.toast(tr('შედეგი ანულირდა'), 'success');
        },
        error: (err: unknown) => {
          const conflict = err instanceof HttpErrorResponse && err.status === 409;
          this.toast(
            tr(conflict ? 'მხოლოდ დადასტურებული შედეგი ანულირდება' : 'ანულირება ვერ მოხერხდა'),
            'error',
          );
          if (conflict) this.loadResults();
        },
      });
  }

  // ── display helpers ────────────────────────────────────────────────────────

  protected teamNames(card: ScorecardView, game: ScorecardGameView, side: 0 | 1): string {
    return teamNames(card, game, side);
  }

  /** Every participant of a card in slot order, for the deltas line. */
  protected participantsOf(card: ScorecardView) {
    return [...card.participants].sort((x, y) => x.key.localeCompare(y.key));
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private slotFor(value: string): SlotState {
    if (!value) return { ...EMPTY_SLOT };
    if (value === WALK_IN) return { ...EMPTY_SLOT, pick: WALK_IN };
    const person = this.people().get(value);
    if (!person) return { ...EMPTY_SLOT };
    const reg = person.reg;
    const phone = ((person.role === 'c' ? reg.playerPhone : reg.partnerPhone) ?? '').trim();
    const name = ((person.role === 'c' ? reg.playerName : reg.partnerName) ?? '').trim();
    return {
      pick: value,
      phone,
      name,
      phoneLocked: phone.length > 0,
      nameLocked: name.length >= PARTICIPANT_NAME_MIN,
      lookup: null,
    };
  }

  /** One debounced lookup; an unparsable number never reaches the API. */
  private lookupPhone(e: { side: number; index: number; phone: string }): Observable<LookupAnswer> {
    const canonical = canonicalPhone(e.phone);
    if (!canonical) return EMPTY;
    return this.ranking.lookupCustomer(e.phone.trim()).pipe(
      map((view): LookupAnswer => ({ side: e.side, index: e.index, canonical, view })),
      catchError(() => of<LookupAnswer>({ side: e.side, index: e.index, canonical, view: null })),
    );
  }

  /** Stores an answer — only if the slot still holds the number it was asked about. */
  private applyLookup(answer: LookupAnswer): void {
    const slot = this.sides()[answer.side]?.[answer.index];
    if (!slot || canonicalPhone(slot.phone) !== answer.canonical) return;
    const lookup: SlotLookup = !answer.view
      ? { phone: answer.canonical, state: 'error' }
      : answer.view.found
        ? { phone: answer.canonical, state: 'found', account: answer.view }
        : { phone: answer.canonical, state: 'missing' };
    this.sides.update((sides) =>
      sides.map((s, si) =>
        si === answer.side ? s.map((x, i) => (i === answer.index ? { ...x, lookup } : x)) : s,
      ),
    );
  }

  /** Replaces registrations with their PATCHed versions. */
  private mergeRegistrations(updated: TournamentRegistration[]): void {
    if (!updated.length) return;
    const byId = new Map(updated.map((r) => [r._id, r]));
    this.registrations.update((list) => list.map((r) => byId.get(r._id) ?? r));
  }

  /** Ends a failed save: inline error, the form stays as typed. */
  private failSave(error: ServerError): Observable<never> {
    this.isSaving.set(false);
    this.serverError.set(error);
    return EMPTY;
  }

  private patchSlot(side: number, index: number, patch: Partial<SlotState>): void {
    this.sides.update((sides) =>
      sides.map((s, si) =>
        si === side ? s.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)) : s,
      ),
    );
    this.serverError.set(null);
  }

  private errorsOf(slot: SlotState): SlotErrors {
    if (!slot.pick) return { pick: 'აირჩიეთ მოთამაშე' };
    const errors: SlotErrors = {};
    const phone = slot.phone.trim();
    if (!phone) errors.phone = 'შეიყვანეთ ტელეფონი';
    else if (!isAcceptablePhone(phone)) errors.phone = 'ტელეფონის ფორმატი არასწორია';
    // A found account brings its own name; an unknown number needs one.
    if (!slot.nameLocked && !this.accountOf(slot)) {
      const name = slot.name.trim();
      if (name.length < PARTICIPANT_NAME_MIN) errors.name = 'სახელი — მინიმუმ 2 სიმბოლო';
      else if (name.length > PARTICIPANT_NAME_MAX) errors.name = 'სახელი — მაქსიმუმ 60 სიმბოლო';
    }
    return errors;
  }

  private resetForm(): void {
    this.sides.set(emptySides(this.mode()));
    this.setRows.set(emptySetRows());
    this.pointsRow.set([null, null]);
    this.submitted.set(false);
    this.serverError.set(null);
  }

  private toast(message: string, appearance: 'success' | 'error'): void {
    this.alerts.open(message, { appearance }).pipe(take(1)).subscribe();
  }
}
