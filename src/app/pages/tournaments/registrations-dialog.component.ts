import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { apiErrorMessage } from '../../services/http-services/ranking.service';
import { TournamentService } from '../../services/http-services/tournament.service';
import {
  PARTNER_NAME_MAX,
  Tournament,
  TournamentRegistration,
  UpdateRegistrationDto,
} from '../../shared/models/tournament.model';

import { liveLabels, tr } from '../../shared/i18n/lang';
import { TPipe } from '../../shared/i18n/t.pipe';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../shared/ui/dialog.service';
import { SsAvatarComponent } from '../../shared/ui/ss-avatar.component';
import { SsToastService } from '../../shared/ui/toast.service';
import { formatMemberId } from '../../shared/utils/member-id.util';
import { canonicalPhone, isAcceptablePhone } from '../../shared/validators/phone-format.validator';
const PAYMENT_LABELS: Record<string, string> = liveLabels({
  pay_at_venue: 'ადგილზე',
  paid: 'გადახდილი',
  refunded: 'დაბრუნებული',
});

/**
 * Participant list for one tournament — snapshots, so no user joins. Doubles
 * rows edit the partner's name/phone inline (docs/25 §6.5).
 */
@Component({
  selector: 'app-registrations-dialog',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, SsAvatarComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-h-[70vh] overflow-y-auto">
      @if (isLoading()) {
        <p class="py-8 text-center georgian-text" lang="ka">{{ 'იტვირთება...' | t }}</p>
      } @else if (registrations().length === 0) {
        <p class="py-8 text-center georgian-text" lang="ka" data-testid="regs-empty">
          {{ 'რეგისტრაციები ჯერ არ არის' | t }}
        </p>
      } @else {
        <ul class="m-0 p-0 list-none" data-testid="regs-list">
          @for (reg of registrations(); track reg._id) {
            <li
              class="py-3 flex items-center gap-3 border-b last:border-b-0"
              style="border-color: var(--tui-border-normal)"
              [class.opacity-50]="reg.status === 'cancelled'"
            >
              <ss-avatar [name]="reg.playerName" [url]="reg.playerAvatar" [size]="36" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium">
                  {{ reg.playerName || reg.playerEmail || '—' }}
                  @if (reg.partnerName) {
                    <span class="georgian-text" lang="ka"> + {{ reg.partnerName }}</span>
                  }
                </div>
                <div class="text-xs truncate" style="color: var(--tui-text-secondary)">
                  @if (memberIdOf(reg)) { ID {{ memberIdOf(reg) }} · }
                  {{ reg.playerEmail }} @if (reg.playerPhone) { · {{ reg.playerPhone }} }
                  · {{ reg.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                </div>
                <!-- Doubles partner (docs/25 §3): name + phone, edited inline
                     (PATCH …/registrations/:id) so both members get rated. -->
                @if (isDoubles && reg.status === 'registered') {
                  @if (editingId() === reg._id) {
                    <div class="mt-2 flex flex-col gap-2" data-testid="reg-partner-form">
                      <div class="grid grid-cols-2 gap-2">
                        <input
                          class="ss-input georgian-text"
                          lang="ka"
                          type="text"
                          autocomplete="off"
                          [maxlength]="partnerNameMax"
                          [placeholder]="'პარტნიორის სახელი' | t"
                          [attr.aria-label]="'პარტნიორის სახელი' | t"
                          [ngModel]="draftName()"
                          (ngModelChange)="draftName.set($event ?? '')"
                          data-testid="reg-partner-name"
                        />
                        <input
                          class="ss-input"
                          type="tel"
                          inputmode="tel"
                          autocomplete="off"
                          placeholder="+995 5XX XX XX XX"
                          [attr.aria-label]="'პარტნიორის ტელეფონი' | t"
                          [class.ss-input--invalid]="draftPhoneInvalid()"
                          [ngModel]="draftPhone()"
                          (ngModelChange)="draftPhone.set($event ?? '')"
                          data-testid="reg-partner-phone"
                        />
                      </div>
                      @if (draftPhoneInvalid()) {
                        <span class="ss-error georgian-text" lang="ka">
                          {{ 'ტელეფონის ფორმატი არასწორია' | t }}
                        </span>
                      }
                      @if (editError(); as e) {
                        <span
                          class="ss-error georgian-text"
                          lang="ka"
                          data-testid="reg-partner-error"
                        >
                          {{ e.message | t }}
                          @if (e.detail) {
                            · {{ e.detail }}
                          }
                        </span>
                      }
                      <div class="flex gap-2 justify-end">
                        <button
                          class="ss-btn ss-btn--flat ss-btn--s"
                          type="button"
                          (click)="cancelEdit()"
                        >
                          <span class="georgian-text" lang="ka">{{ 'გაუქმება' | t }}</span>
                        </button>
                        <button
                          class="ss-btn ss-btn--primary ss-btn--s"
                          type="button"
                          [disabled]="!editDto(reg) || isSavingEdit()"
                          (click)="saveEdit(reg)"
                          data-testid="reg-partner-save"
                        >
                          <span class="georgian-text" lang="ka">
                            {{ (isSavingEdit() ? 'ინახება...' : 'შენახვა') | t }}
                          </span>
                        </button>
                      </div>
                    </div>
                  } @else {
                    <div
                      class="flex items-center gap-1 text-xs georgian-text"
                      lang="ka"
                      data-testid="reg-partner"
                    >
                      <span class="truncate">
                        <span style="color: var(--tui-text-secondary)">{{ 'პარტნიორი' | t }}:</span>
                        {{ reg.partnerName || '—' }} ·
                        @if (reg.partnerPhone) {
                          <span>{{ reg.partnerPhone }}</span>
                        } @else {
                          <span style="color: var(--warning)">{{ 'ტელეფონი აკლია' | t }}</span>
                        }
                      </span>
                      <button
                        class="ss-icon-btn ss-icon-btn--s shrink-0"
                        type="button"
                        [attr.aria-label]="'პარტნიორის რედაქტირება' | t"
                        [title]="'პარტნიორის რედაქტირება' | t"
                        (click)="startEdit(reg)"
                        data-testid="reg-partner-edit"
                      >
                        <i
                          class="ss-ic"
                          style="--ss-ic: url('assets/taiga-ui/icons/pencil.svg')"
                        ></i>
                      </button>
                    </div>
                  }
                }
              </div>
              <span
                class="georgian-text"
                lang="ka"
                [class]="
                  reg.status === 'cancelled'
                    ? 'ss-badge ss-badge--negative'
                    : reg.paymentStatus === 'paid'
                      ? 'ss-badge ss-badge--positive'
                      : 'ss-badge ss-badge--info'
                "
              >
                {{ reg.status === 'cancelled' ? ('გაუქმებული' | t) : paymentLabel(reg) }}
              </span>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class RegistrationsDialogComponent implements OnInit {
  private readonly context = inject(SS_DIALOG_CONTEXT) as SsDialogContext<
    void,
    { tournament: Tournament }
  >;
  private readonly tournamentService = inject(TournamentService);
  private readonly alerts = inject(SsToastService);

  protected readonly registrations = signal<TournamentRegistration[]>([]);
  protected readonly isLoading = signal(true);
  /** Doubles: each registration is a pair — the partner line shows its phone. */
  protected readonly isDoubles = this.context.data.tournament.type === 'doubles';

  // ── inline partner edit (one row at a time) ────────────────────────────────
  protected readonly editingId = signal<string | null>(null);
  protected readonly draftName = signal('');
  protected readonly draftPhone = signal('');
  protected readonly isSavingEdit = signal(false);
  /** RAW-Georgian message + the API's own detail. */
  protected readonly editError = signal<{ message: string; detail: string } | null>(null);
  protected readonly partnerNameMax = PARTNER_NAME_MAX;
  protected readonly draftPhoneInvalid = computed(() => {
    const phone = this.draftPhone().trim();
    return phone.length > 0 && !isAcceptablePhone(phone);
  });

  ngOnInit(): void {
    this.tournamentService
      .getRegistrations(this.context.data.tournament._id)
      .pipe(take(1))
      .subscribe({
        next: (regs) => {
          this.registrations.set(regs);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  protected startEdit(reg: TournamentRegistration): void {
    this.editingId.set(reg._id);
    this.draftName.set(reg.partnerName ?? '');
    this.draftPhone.set(reg.partnerPhone ?? '');
    this.editError.set(null);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editError.set(null);
  }

  /**
   * The PATCH body: only fields that changed and are non-empty (the API
   * ignores empty ones — a partner phone can be replaced, not cleared);
   * null when there is nothing valid to send.
   */
  editDto(reg: TournamentRegistration): UpdateRegistrationDto | null {
    if (this.draftPhoneInvalid()) return null;
    const dto: UpdateRegistrationDto = {};
    const phone = this.draftPhone().trim();
    const name = this.draftName().trim().slice(0, PARTNER_NAME_MAX);
    if (phone && canonicalPhone(phone) !== canonicalPhone(reg.partnerPhone ?? '')) {
      dto.partnerPhone = phone;
    }
    if (name && name !== (reg.partnerName ?? '').trim()) {
      dto.partnerName = name;
    }
    return Object.keys(dto).length ? dto : null;
  }

  protected saveEdit(reg: TournamentRegistration): void {
    const dto = this.editDto(reg);
    if (!dto || this.isSavingEdit()) return;
    this.isSavingEdit.set(true);
    this.editError.set(null);
    this.tournamentService
      .updateRegistration(this.context.data.tournament._id, reg._id, dto)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.registrations.update((list) =>
            list.map((r) => (r._id === updated._id ? updated : r)),
          );
          this.isSavingEdit.set(false);
          this.editingId.set(null);
          this.alerts
            .open(tr('პარტნიორი განახლდა'), { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        },
        error: (err: unknown) => {
          this.isSavingEdit.set(false);
          const status = err instanceof HttpErrorResponse ? err.status : 0;
          this.editError.set({
            message: 'შენახვა ვერ მოხერხდა, სცადეთ თავიდან',
            detail: status === 400 ? apiErrorMessage(err) : '',
          });
        },
      });
  }

  protected paymentLabel(reg: TournamentRegistration): string {
    return PAYMENT_LABELS[reg.paymentStatus] ?? reg.paymentStatus;
  }

  /** Snapshotted public member ID ("000042"); '' on legacy registrations. */
  protected memberIdOf(reg: TournamentRegistration): string {
    return formatMemberId(reg.playerMemberId);
  }
}
