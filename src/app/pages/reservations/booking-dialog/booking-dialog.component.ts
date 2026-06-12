import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { type MaskitoOptions } from '@maskito/core';
import { MaskitoDirective } from '@maskito/angular';
import {
  maskitoPrefixPostprocessorGenerator,
  maskitoAddOnFocusPlugin,
  maskitoRemoveOnBlurPlugin,
} from '@maskito/kit';
import { type TuiStringHandler } from '@taiga-ui/cdk';
import { TuiAlertService } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/experimental';
import { HttpErrorResponse } from '@angular/common/http';
import { SHARED_TAIGA_IMPORTS } from '../../../shared/shared.module';
import { BookingService } from '../../../services/http-services/booking.service';
import { CreateBlockDto, CreateBookingDto } from '../../../shared/models/booking.model';
import { ScheduleService } from '../../../services/http-services/schedule.service';

/** Slot option for the block end-slot selector (later slots than the start). */
export interface SlotOption {
  start: string;
  end: string;
}

/** Data passed into the create dialog from a clicked free cell. */
export interface BookingDialogData {
  facilityId: string;
  court: string; // court _id
  courtLabel: string;
  date: string; // "YYYY-MM-DD"
  start: string; // "HH:mm" — prefilled slot start
  end: string; // "HH:mm"
  priceTetri?: number;
  /** Later slots on the same court/day, for the optional multi-slot block end. */
  laterSlots: SlotOption[];
}

/**
 * Create dialog for the operator calendar (design §5). Toggles between a manual
 * **booking** (customer name required, Georgian phone mask, note) and a **block**
 * (note + optional multi-slot end). Court + slot are prefilled from the clicked
 * cell. On a 409 the caller refreshes the day and this dialog surfaces the
 * Georgian "slot already taken" message.
 */
@Component({
  selector: 'app-booking-dialog',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, ReactiveFormsModule, CommonModule, MaskitoDirective],
  templateUrl: './booking-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingDialogComponent implements OnInit {
  private readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<
    boolean,
    BookingDialogData
  >;
  private readonly fb = inject(FormBuilder);
  private readonly bookingService = inject(BookingService);
  private readonly alerts = inject(TuiAlertService);

  readonly mode = signal<'booking' | 'block'>('booking');
  readonly submitting = signal(false);

  form!: FormGroup;

  readonly phoneMask: MaskitoOptions = {
    mask: ['+', '9', '9', '5', /[5]/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/],
    postprocessors: [maskitoPrefixPostprocessorGenerator('+995')],
    plugins: [maskitoAddOnFocusPlugin('+995'), maskitoRemoveOnBlurPlugin('+995')],
  };

  get data(): BookingDialogData {
    return this.context.data;
  }

  readonly priceGel = (): number | null =>
    this.data.priceTetri != null ? ScheduleService.tetriToGel(this.data.priceTetri) : null;

  readonly stringifyEndSlot: TuiStringHandler<string> = (start) => {
    const slot = this.data.laterSlots.find((s) => s.start === start);
    return slot ? `${slot.start} – ${slot.end}` : start;
  };

  ngOnInit(): void {
    this.form = this.fb.group({
      customerName: ['', Validators.required],
      customerPhone: ['', Validators.pattern(/^\+9955\d{8}$/)],
      note: [''],
      blockEnd: [null as string | null],
    });
  }

  setMode(mode: 'booking' | 'block'): void {
    this.mode.set(mode);
    const name = this.form.get('customerName');
    if (mode === 'block') {
      name?.clearValidators();
    } else {
      name?.setValidators([Validators.required]);
    }
    name?.updateValueAndValidity();
  }

  private extractPhoneDigits(phone: string): string {
    return (phone || '').replace(/\D/g, '');
  }

  submit(): void {
    if (this.mode() === 'booking') {
      this.submitBooking();
    } else {
      this.submitBlock();
    }
  }

  private submitBooking(): void {
    if (this.form.get('customerName')?.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const dto: CreateBookingDto = {
      court: this.data.court,
      date: this.data.date,
      start: this.data.start,
      customerName: v.customerName,
      customerPhone: v.customerPhone ? this.extractPhoneDigits(v.customerPhone) : undefined,
      note: v.note || undefined,
    };
    this.submitting.set(true);
    this.bookingService
      .createBooking(this.data.facilityId, dto)
      .pipe(take(1))
      .subscribe({
        next: () => this.onSuccess('ჯავშანი წარმატებით დაემატა!'),
        error: (err) => this.onError(err),
      });
  }

  private submitBlock(): void {
    const v = this.form.value;
    // `blockEnd` holds the *start* of the chosen end slot (the data-list value);
    // the contract's `end` is the EXCLUSIVE end wall-clock time, so submit that
    // slot's END, not its start.
    const picked = v.blockEnd as string | null;
    const end = picked
      ? this.data.laterSlots.find((s) => s.start === picked)?.end
      : undefined;
    const dto: CreateBlockDto = {
      type: 'block',
      court: this.data.court,
      date: this.data.date,
      start: this.data.start,
      end: end || undefined,
      note: v.note || undefined,
    };
    this.submitting.set(true);
    this.bookingService
      .createBlock(this.data.facilityId, dto)
      .pipe(take(1))
      .subscribe({
        next: () => this.onSuccess('სლოტი დაბლოკილია'),
        error: (err) => this.onError(err),
      });
  }

  private onSuccess(message: string): void {
    this.submitting.set(false);
    this.alerts.open(message, { appearance: 'success' }).pipe(take(1)).subscribe();
    this.context.completeWith(true);
  }

  private onError(err: unknown): void {
    this.submitting.set(false);
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    if (status === 409) {
      // Slot was taken concurrently — tell the operator in Georgian and close so
      // the calendar refreshes the day (the freshly-taken slot reappears).
      this.alerts
        .open('სლოტი უკვე დაკავებულია', { appearance: 'error' })
        .pipe(take(1))
        .subscribe();
      this.context.completeWith(true);
      return;
    }
    this.alerts.open('შეცდომა ჯავშნის შენახვისას.', { appearance: 'error' }).pipe(take(1)).subscribe();
  }

  cancel(): void {
    this.context.completeWith(false);
  }
}
