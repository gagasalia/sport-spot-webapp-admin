import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { EMPTY, Observable, catchError, filter, switchMap, take, tap } from 'rxjs';
import { TournamentEngineService } from '../../../../services/http-services/tournament-engine.service';
import { liveLabels, tr } from '../../../../shared/i18n/lang';
import { TPipe } from '../../../../shared/i18n/t.pipe';
import {
  TournamentRegistration,
  UpdateRegistrationDto,
} from '../../../../shared/models/tournament.model';
import {
  AddEntrantDto,
  EntrantView,
  PLAYER_NAME_MAX,
  SeedsDto,
} from '../../../../shared/models/tournament-engine.model';
import { SsConfirmComponent, SsConfirmData } from '../../../../shared/ui/confirm.component';
import { SsDialogService } from '../../../../shared/ui/dialog.service';
import { SsToastService } from '../../../../shared/ui/toast.service';
import { canonicalPhone, isAcceptablePhone } from '../../../../shared/validators/phone-format.validator';
import { TournamentConsoleStore } from '../console.store';
import { EngineError, describeEngineError } from '../engine-errors.util';
import { renderMsg } from '../msg.util';

const PAYMENT_LABELS: Record<string, string> = liveLabels({
  pay_at_venue: 'ადგილზე',
  paid: 'გადახდილი',
  refunded: 'დაბრუნებული',
});

const PAYMENT_CLASSES: Record<string, string> = {
  pay_at_venue: 'ss-badge ss-badge--info',
  paid: 'ss-badge ss-badge--positive',
  refunded: 'ss-badge ss-badge--neutral',
};

/** One entrant row: the draw view's entrant + its registration row (source, payment). */
export interface EntrantRow {
  entrant: EntrantView;
  registration?: TournamentRegistration;
  /** Added by the organizer (name / phone editable). */
  byHand: boolean;
}

/** An inline name + phone draft (add row / edit row). */
export interface EntrantDraft {
  playerName: string;
  playerPhone: string;
  partnerName: string;
  partnerPhone: string;
}

export const EMPTY_DRAFT: EntrantDraft = {
  playerName: '',
  playerPhone: '',
  partnerName: '',
  partnerPhone: '',
};

/** RAW-Georgian problem of a draft, or null. `nameRequired` for a new entrant. */
export function draftError(draft: EntrantDraft, nameRequired: boolean): string | null {
  const name = draft.playerName.trim();
  if (nameRequired && name.length < 2) return 'სახელი — მინიმუმ 2 სიმბოლო';
  if (name.length > PLAYER_NAME_MAX || draft.partnerName.trim().length > PLAYER_NAME_MAX) {
    return 'სახელი — მაქსიმუმ 120 სიმბოლო';
  }
  for (const phone of [draft.playerPhone, draft.partnerPhone]) {
    if (phone.trim() && !isAcceptablePhone(phone)) return 'ტელეფონის ფორმატი არასწორია';
  }
  return null;
}

/** POST /registrations body: empty optionals left out. */
export function addEntrantBody(draft: EntrantDraft, doubles: boolean): AddEntrantDto {
  const body: AddEntrantDto = { playerName: draft.playerName.trim() };
  if (draft.playerPhone.trim()) body.playerPhone = draft.playerPhone.trim();
  if (doubles && draft.partnerName.trim()) body.partnerName = draft.partnerName.trim();
  if (doubles && draft.partnerPhone.trim()) body.partnerPhone = draft.partnerPhone.trim();
  return body;
}

/**
 * PATCH body of an edit: only changed, non-empty fields (the API ignores
 * empty ones); the player's own name / phone only on a hand-added row.
 */
export function editEntrantBody(
  draft: EntrantDraft,
  registration: TournamentRegistration | undefined,
  options: { byHand: boolean; doubles: boolean },
): UpdateRegistrationDto | null {
  const body: UpdateRegistrationDto = {};
  const changedPhone = (typed: string, stored: string | undefined) =>
    !!typed.trim() && canonicalPhone(typed) !== canonicalPhone(stored ?? '');
  const changedName = (typed: string, stored: string | undefined) =>
    !!typed.trim() && typed.trim() !== (stored ?? '').trim();
  if (options.byHand) {
    if (changedName(draft.playerName, registration?.playerName)) body.playerName = draft.playerName.trim();
    if (changedPhone(draft.playerPhone, registration?.playerPhone)) body.playerPhone = draft.playerPhone.trim();
  }
  if (options.doubles) {
    if (changedName(draft.partnerName, registration?.partnerName)) body.partnerName = draft.partnerName.trim();
    if (changedPhone(draft.partnerPhone, registration?.partnerPhone)) body.partnerPhone = draft.partnerPhone.trim();
  }
  return Object.keys(body).length ? body : null;
}

/**
 * Step 1 «მონაწილეები» (docs/33 §2.4, D7): seed, players, phones, how they
 * entered (registration / by hand) and payment. Before the draw the organizer
 * adds walk-ins, edits names and phones, removes entrants and SEEDS them —
 * drag-and-drop (saved at once as the full order) or by rating / at random /
 * cleared. After the draw the list is read-only.
 */
@Component({
  selector: 'app-entrants-step',
  standalone: true,
  imports: [FormsModule, TPipe, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './entrants-step.component.html',
  styleUrl: './entrants-step.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntrantsStepComponent {
  protected readonly store = inject(TournamentConsoleStore);
  private readonly engine = inject(TournamentEngineService);
  private readonly dialogs = inject(SsDialogService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly nameMax = PLAYER_NAME_MAX;

  protected paymentLabel(status: string): string {
    return PAYMENT_LABELS[status] || status;
  }

  protected paymentClass(status: string): string {
    return PAYMENT_CLASSES[status] || 'ss-badge ss-badge--neutral';
  }

  protected readonly doubles = computed(() => this.store.type() === 'doubles');
  /** Before the draw, while the tournament can change. */
  protected readonly canEdit = computed(() => this.store.editable() && !this.store.hasDraw());
  protected readonly busy = signal(false);
  protected readonly error = signal<EngineError | null>(null);

  /** The list order (ids) — follows the view, moved locally while a drop saves. */
  protected readonly order = linkedSignal(() => this.store.entrants().map((e) => e.id));

  protected readonly rows = computed<EntrantRow[]>(() => {
    const entrants = this.store.entrantById();
    const registrations = this.store.registrationById();
    return this.order()
      .map((id) => entrants.get(id))
      .filter((e): e is EntrantView => !!e)
      .map((entrant) => {
        const registration = registrations.get(entrant.id);
        return { entrant, registration, byHand: registration?.source === 'operator' };
      });
  });

  // ── add ────────────────────────────────────────────────────────────────────
  protected readonly adding = signal<EntrantDraft>({ ...EMPTY_DRAFT });
  protected readonly addSubmitted = signal(false);
  protected readonly addError = computed(() => draftError(this.adding(), true));

  // ── edit (one row at a time) ───────────────────────────────────────────────
  protected readonly editingId = signal<string | null>(null);
  protected readonly editing = signal<EntrantDraft>({ ...EMPTY_DRAFT });
  protected readonly editError = computed(() => draftError(this.editing(), false));

  protected patchAdding(field: keyof EntrantDraft, value: string): void {
    this.adding.update((d) => ({ ...d, [field]: value ?? '' }));
  }

  protected patchEditing(field: keyof EntrantDraft, value: string): void {
    this.editing.update((d) => ({ ...d, [field]: value ?? '' }));
  }

  protected add(): void {
    this.addSubmitted.set(true);
    if (this.addError() || this.busy()) return;
    const body = addEntrantBody(this.adding(), this.doubles());
    this.write(
      this.engine.addEntrant(this.store.id(), body).pipe(switchMap(() => this.store.refreshEntrants())),
      // No toast: the new row and the counter are the feedback, and a stack
      // of toasts while a list of pairs is typed in only gets in the way.
      '',
      () => {
        this.adding.set({ ...EMPTY_DRAFT });
        this.addSubmitted.set(false);
      },
    );
  }

  protected startEdit(row: EntrantRow): void {
    const r = row.registration;
    this.editingId.set(row.entrant.id);
    this.editing.set({
      playerName: r?.playerName ?? row.entrant.players[0]?.name ?? '',
      playerPhone: r?.playerPhone ?? row.entrant.players[0]?.phone ?? '',
      partnerName: r?.partnerName ?? '',
      partnerPhone: r?.partnerPhone ?? '',
    });
    this.error.set(null);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected editBody(row: EntrantRow): UpdateRegistrationDto | null {
    if (this.editError()) return null;
    return editEntrantBody(this.editing(), row.registration, {
      byHand: row.byHand,
      doubles: this.doubles(),
    });
  }

  protected saveEdit(row: EntrantRow): void {
    const body = this.editBody(row);
    if (!body || this.busy()) return;
    this.write(
      this.engine
        .updateEntrant(this.store.id(), row.entrant.id, body)
        .pipe(switchMap(() => this.store.refreshEntrants())),
      'მონაწილე განახლდა',
      () => this.editingId.set(null),
    );
  }

  protected remove(row: EntrantRow): void {
    const data: SsConfirmData = {
      content: `${tr('წავშალოთ მონაწილე')} „${row.entrant.name}“? ${tr('ბალანსით გადახდილი საფასური ავტომატურად დაბრუნდება.')}`,
      yes: tr('წაშლა'),
      no: tr('გაუქმება'),
      appearance: 'destructive',
    };
    this.dialogs
      .open<boolean>(SsConfirmComponent, { label: tr('მონაწილის წაშლა'), size: 's', data })
      .pipe(take(1), filter(Boolean))
      .subscribe(() =>
        this.write(
          this.engine
            .removeEntrant(this.store.id(), row.entrant.id)
            .pipe(switchMap(() => this.store.refreshEntrants())),
          'მონაწილე წაიშალა',
        ),
      );
  }

  /** A drop saves the whole list as the seeding (best first). */
  protected drop(event: CdkDragDrop<string[]>): void {
    if (!this.canEdit() || event.previousIndex === event.currentIndex) return;
    const order = [...this.order()];
    moveItemInArray(order, event.previousIndex, event.currentIndex);
    this.order.set(order);
    this.seed({ order }, 'განთესვა შენახულია');
  }

  protected seedBy(method: 'rating' | 'random' | 'clear'): void {
    const messages = {
      rating: 'განთესილია რეიტინგით',
      random: 'განთესილია შემთხვევით',
      clear: 'განთესვა გასუფთავდა',
    };
    this.seed({ method }, messages[method]);
  }

  private seed(body: SeedsDto, success: string): void {
    this.write(
      this.engine.setSeeds(this.store.id(), body).pipe(tap((view) => this.store.applyDraw(view))),
      success,
      undefined,
      // A failed save puts the list back in the view's order.
      () => this.order.set(this.store.entrants().map((e) => e.id)),
    );
  }

  /** "16 წყვილი" — the capacity in units, live language. */
  protected capacityLine(): string {
    return renderMsg({
      key: this.doubles() ? '%s წყვილი' : '%s მოთამაშე',
      args: [this.store.tournament()?.maxParticipants ?? 0],
    });
  }

  protected playerLine(row: EntrantRow): string {
    return row.entrant.players.map((p) => p.name).join(' / ');
  }

  protected phonesOf(row: EntrantRow): string {
    return row.entrant.players.map((p) => p.phone || '—').join(' · ');
  }

  /** One write: busy flag, inline error, a success toast (none when empty). */
  private write(
    request: Observable<unknown>,
    success: string,
    done?: () => void,
    failed?: () => void,
  ): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    request
      .pipe(
        catchError((err: unknown) => {
          this.busy.set(false);
          this.error.set(describeEngineError(err));
          failed?.();
          return EMPTY;
        }),
        switchMap(() => {
          this.busy.set(false);
          done?.();
          return success
            ? this.alerts.open(tr(success), { appearance: 'success' }).pipe(take(1))
            : EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
