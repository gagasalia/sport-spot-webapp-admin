import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, take } from 'rxjs';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/experimental';
import { TuiAlertService } from '@taiga-ui/core';
import { SHARED_TAIGA_IMPORTS } from '../../../../shared/shared.module';
import { WalletAdminService } from '../../../../services/http-services/wallet-admin.service';
import { User } from '../../../../shared/models/user.model';
import {
  WalletTransaction,
  WalletTransactionType,
} from '../../../../shared/models/wallet.model';
import { gelToTetri, tetriToGel } from '../../../../shared/utils/money.util';

/** Ledger row types → Georgian titles. */
const TX_TYPE_LABELS: Record<WalletTransactionType, string> = {
  topup: 'შევსება (ბარათით)',
  admin_credit: 'დარიცხვა (ადმინი)',
  admin_debit: 'ჩამოჭრა (ადმინი)',
  booking_payment: 'ჯავშნის გადახდა',
  refund: 'თანხის დაბრუნება',
};

const TX_PAGE_SIZE = 10;

/**
 * Superadmin balance dialog for one user: current balance, manual add/remove
 * with a mandatory reason (both land in the user's ledger), and the paged
 * transaction history. Opened from the user-management list, which is already
 * superadmin-gated (route guard + server-side @Roles).
 */
@Component({
  selector: 'app-user-balance',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, CommonModule, DatePipe, ReactiveFormsModule],
  templateUrl: './user-balance.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserBalanceComponent implements OnInit {
  private readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<
    void,
    { user: User }
  >;
  private readonly walletService = inject(WalletAdminService);
  private readonly alerts = inject(TuiAlertService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly balanceTetri = signal<number | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);

  protected readonly transactions = signal<WalletTransaction[]>([]);
  protected readonly txLoading = signal(false);
  protected readonly txTotal = signal(0);
  private txPage = 0;

  protected readonly balanceGel = computed(() => {
    const b = this.balanceTetri();
    return b == null ? '—' : String(tetriToGel(b));
  });
  protected readonly hasMoreTx = computed(
    () => this.transactions().length < this.txTotal(),
  );

  protected readonly form = this.fb.nonNullable.group({
    amountGel: [
      null as number | null,
      [Validators.required, Validators.min(0.01), Validators.max(10_000)],
    ],
    note: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(300)]],
  });

  protected get user(): User {
    return this.context.data.user;
  }

  protected get userLabel(): string {
    const parts = [this.user.firstName, this.user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : this.user.email;
  }

  ngOnInit(): void {
    this.loadBalance();
    this.loadTransactions(true);
  }

  private loadBalance(): void {
    if (!this.user._id) {
      return;
    }
    this.isLoading.set(true);
    this.walletService
      .getBalance(this.user._id)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (wallet) => this.balanceTetri.set(wallet.balanceTetri),
        error: () => this.balanceTetri.set(null),
      });
  }

  protected loadTransactions(reset = false): void {
    if (!this.user._id || this.txLoading()) {
      return;
    }
    if (reset) {
      this.txPage = 0;
    }
    const nextPage = this.txPage + 1;
    this.txLoading.set(true);

    this.walletService
      .getTransactions(this.user._id, nextPage, TX_PAGE_SIZE)
      .pipe(
        finalize(() => this.txLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ data, page }) => {
          this.txPage = nextPage;
          this.txTotal.set(page?.total ?? data.length);
          this.transactions.set(reset ? data : [...this.transactions(), ...data]);
        },
        error: () => undefined,
      });
  }

  /** Applies the form as a credit (`direction: 1`) or debit (`direction: -1`). */
  protected adjust(direction: 1 | -1): void {
    if (!this.user._id || this.isSaving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { amountGel, note } = this.form.getRawValue();
    const amountTetri = direction * gelToTetri(amountGel ?? 0);

    this.isSaving.set(true);
    this.walletService
      .adjust(this.user._id, { amountTetri, note: note.trim() })
      .pipe(
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.balanceTetri.set(result.balanceTetri);
          this.form.reset({ amountGel: null, note: '' });
          this.loadTransactions(true);
          this.alerts
            .open(direction > 0 ? 'ბალანსი დაირიცხა' : 'ბალანსი ჩამოიჭრა', {
              appearance: 'success',
            })
            .pipe(take(1))
            .subscribe();
        },
        error: (err: HttpErrorResponse) => {
          const message =
            err.status === 400
              ? direction > 0
                ? 'ლიმიტი გადაჭარბდა (მაქს. 10 000 ₾)'
                : 'არასაკმარისი ბალანსი'
              : 'ოპერაცია ვერ შესრულდა';
          this.alerts.open(message, { appearance: 'negative' }).pipe(take(1)).subscribe();
        },
      });
  }

  // ─── History display helpers ────────────────────────────────────────────────

  protected typeLabel(type: WalletTransactionType): string {
    return TX_TYPE_LABELS[type] ?? type;
  }

  protected isCredit(tx: WalletTransaction): boolean {
    return tx.amountTetri > 0;
  }

  protected amountGelLabel(tx: WalletTransaction): string {
    const sign = tx.amountTetri > 0 ? '+' : tx.amountTetri < 0 ? '−' : '';
    return `${sign}${tetriToGel(Math.abs(tx.amountTetri))} ₾`;
  }

  protected afterGelLabel(tx: WalletTransaction): string {
    return `${tetriToGel(tx.balanceAfterTetri)} ₾`;
  }

  /** App-support tip inside a booking_payment debit; '' when none. */
  protected tipGelLabel(tx: WalletTransaction): string {
    return tx.tipTetri ? `${tetriToGel(tx.tipTetri)} ₾` : '';
  }

  protected close(): void {
    this.context.completeWith();
  }
}
