import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { take } from 'rxjs';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/experimental';
import { SHARED_TAIGA_IMPORTS } from '../../shared/shared.module';
import { TournamentService } from '../../services/http-services/tournament.service';
import {
  Tournament,
  TournamentRegistration,
} from '../../shared/models/tournament.model';

const PAYMENT_LABELS: Record<string, string> = {
  pay_at_venue: 'ადგილზე',
  paid: 'გადახდილი',
  refunded: 'დაბრუნებული',
};

/** Participant list for one tournament — snapshots, so no user joins. */
@Component({
  selector: 'app-registrations-dialog',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, CommonModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-h-[70vh] overflow-y-auto">
      @if (isLoading()) {
        <p class="py-8 text-center georgian-text" lang="ka">იტვირთება...</p>
      } @else if (registrations().length === 0) {
        <p class="py-8 text-center georgian-text" lang="ka" data-testid="regs-empty">
          რეგისტრაციები ჯერ არ არის
        </p>
      } @else {
        <ul class="m-0 p-0 list-none" data-testid="regs-list">
          @for (reg of registrations(); track reg._id) {
            <li
              class="py-3 flex items-center gap-3 border-b last:border-b-0"
              style="border-color: var(--tui-border-normal)"
              [class.opacity-50]="reg.status === 'cancelled'"
            >
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium">
                  {{ reg.playerName || reg.playerEmail || '—' }}
                  @if (reg.partnerName) {
                    <span class="georgian-text" lang="ka"> + {{ reg.partnerName }}</span>
                  }
                </div>
                <div class="text-xs truncate" style="color: var(--tui-text-secondary)">
                  {{ reg.playerEmail }} @if (reg.playerPhone) { · {{ reg.playerPhone }} }
                  · {{ reg.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                </div>
              </div>
              <span
                class="inline-block px-2 py-0.5 rounded-full text-xs font-medium georgian-text"
                lang="ka"
                [class]="
                  reg.status === 'cancelled'
                    ? 'bg-red-100 text-red-700'
                    : reg.paymentStatus === 'paid'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                "
              >
                {{ reg.status === 'cancelled' ? 'გაუქმებული' : paymentLabel(reg) }}
              </span>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class RegistrationsDialogComponent implements OnInit {
  private readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<
    void,
    { tournament: Tournament }
  >;
  private readonly tournamentService = inject(TournamentService);

  protected readonly registrations = signal<TournamentRegistration[]>([]);
  protected readonly isLoading = signal(true);

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

  protected paymentLabel(reg: TournamentRegistration): string {
    return PAYMENT_LABELS[reg.paymentStatus] ?? reg.paymentStatus;
  }
}
