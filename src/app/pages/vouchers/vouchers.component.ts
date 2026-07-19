import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, take } from 'rxjs';
import { TuiAlertService } from '@taiga-ui/core';
import { type TuiStringHandler, TuiDay } from '@taiga-ui/cdk';
import { TuiInputDate } from '@taiga-ui/kit/components/input-date';
import { SHARED_TAIGA_IMPORTS } from '../../shared/shared.module';
import { VoucherService } from '../../services/http-services/voucher.service';
import { FacilityService } from '../../services/http-services/facility.service';
import { TenantService } from '../../shared/services/tenant.service';
import { gelToTetri, tetriToGel } from '../../shared/utils/money.util';
import { tuiDayToIso } from '../reservations/calendar-date.util';
import { Facility } from '../../shared/models/facility.model';
import {
  GrantVoucherDto,
  ImportEntry,
  PendingGrant,
  Voucher,
  VoucherDerivedStatus,
  VoucherSource,
  isVoucher,
} from '../../shared/models/voucher.model';

/** Result of parsing the bulk-import textarea: valid entries + per-line errors. */
interface ParsedImport {
  entries: ImportEntry[];
  errors: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Admin voucher page (design section 21.6). Facility selector (same pattern as
 * the reservations page) gates three blocks: a single grant form, a bulk-import
 * textarea, and two tables (facility vouchers + pending grants). Amounts are
 * entered/shown in GEL and converted to integer tetri at the wire edge.
 */
@Component({
  selector: 'app-vouchers',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, CommonModule, ReactiveFormsModule, ...TuiInputDate],
  templateUrl: './vouchers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VouchersComponent implements OnInit {
  private readonly voucherService = inject(VoucherService);
  private readonly facilityService = inject(FacilityService);
  private readonly tenant = inject(TenantService);
  private readonly alerts = inject(TuiAlertService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // facility selection
  readonly facilities = signal<Facility[]>([]);
  readonly selectedFacilityId = signal<string | null>(null);
  readonly facilityControl = new FormControl<string | null>(null);

  // lists
  readonly vouchers = signal<Voucher[]>([]);
  readonly grants = signal<PendingGrant[]>([]);

  // ui state
  readonly isLoading = signal(false);
  readonly hasError = signal(false);
  readonly grantSubmitting = signal(false);
  readonly importSubmitting = signal(false);
  readonly importErrors = signal<string[]>([]);

  // grant form
  readonly grantForm = new FormGroup({
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    amountGel: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0.01)],
    }),
    expiresAt: new FormControl<TuiDay | null>(null),
    note: new FormControl<string>('', { nonNullable: true }),
  });

  // import form
  readonly importControl = new FormControl<string>('', { nonNullable: true });
  readonly importExpiry = new FormControl<TuiDay | null>(null);

  readonly statusLabels: Record<VoucherDerivedStatus, string> = {
    active: 'აქტიური',
    depleted: 'ამოწურული',
    expired: 'ვადაგასული',
    pending_activation: 'ელოდება აქტივაციას',
  };

  readonly sourceLabels: Record<VoucherSource, string> = {
    migration: 'მიგრაცია',
    admin_grant: 'გრანტი',
    purchase: 'ყიდვა',
    gift: 'საჩუქარი',
  };

  private facilityIdOf(f: Facility): string | null {
    return f._id ?? f.id ?? null;
  }

  readonly stringifyFacility: TuiStringHandler<string> = (id) => {
    const facility = this.facilities().find((f) => this.facilityIdOf(f) === id);
    if (!facility) return '';
    return facility.name || facility.description || 'უსახელო ობიექტი';
  };

  constructor() {
    this.facilityControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.onFacilityChange(id);
    });
  }

  ngOnInit(): void {
    this.tenant
      .ensure()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadFacilities());
  }

  // facility resolution (mirrors the reservations page)
  private loadFacilities(): void {
    const academyId = this.tenant.academyId();
    if (!academyId) {
      this.facilities.set([]);
      this.selectedFacilityId.set(null);
      return;
    }
    this.facilityService
      .getFacilitiesByAcademy(academyId)
      .pipe(take(1))
      .subscribe({
        next: (facilities) => {
          this.facilities.set(facilities);
          this.resolveSelection(facilities);
        },
        error: () => this.hasError.set(true),
      });
  }

  private resolveSelection(facilities: Facility[]): void {
    this.route.queryParams.pipe(take(1)).subscribe((params) => {
      const fromQuery = params['facilityId'];
      if (facilities.length === 0) {
        this.selectFacility(null);
      } else if (facilities.length === 1) {
        const fId = this.facilityIdOf(facilities[0]);
        this.facilityControl.setValue(fId, { emitEvent: false });
        if (fromQuery !== fId) this.updateQueryParam(fId);
        this.selectFacility(fId);
      } else if (fromQuery) {
        const facility = facilities.find((f) => this.facilityIdOf(f) === fromQuery);
        const fId = facility ? this.facilityIdOf(facility) : null;
        this.facilityControl.setValue(fId, { emitEvent: false });
        if (!facility) this.updateQueryParam(null);
        this.selectFacility(fId);
      } else {
        this.facilityControl.setValue(null, { emitEvent: false });
        this.selectFacility(null);
      }
    });
  }

  onFacilityChange(facilityId: string | null): void {
    this.updateQueryParam(facilityId);
    this.selectFacility(facilityId);
  }

  private selectFacility(facilityId: string | null): void {
    this.selectedFacilityId.set(facilityId);
    this.vouchers.set([]);
    this.grants.set([]);
    this.importErrors.set([]);
    if (facilityId) {
      this.loadLists(facilityId);
    }
  }

  private updateQueryParam(facilityId: string | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { facilityId: facilityId || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private loadLists(facilityId: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    // A hard failure of either list surfaces the error banner (the reservations
    // pattern); a successful pair replaces both signals atomically.
    forkJoin({
      vouchers: this.voucherService.getVouchers(facilityId),
      grants: this.voucherService.getGrants(facilityId),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ vouchers, grants }) => {
          this.vouchers.set(vouchers);
          this.grants.set(grants);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  private refreshLists(): void {
    const facilityId = this.selectedFacilityId();
    if (facilityId) this.loadLists(facilityId);
  }

  // grant
  submitGrant(): void {
    const facilityId = this.selectedFacilityId();
    if (!facilityId || this.grantForm.invalid) {
      this.grantForm.markAllAsTouched();
      return;
    }
    const { email, amountGel, expiresAt, note } = this.grantForm.getRawValue();
    const dto: GrantVoucherDto = {
      email: email.trim().toLowerCase(),
      facilityId,
      amountTetri: gelToTetri(amountGel ?? 0),
    };
    if (expiresAt) dto.expiresAt = tuiDayToIso(expiresAt);
    if (note.trim()) dto.note = note.trim();

    this.grantSubmitting.set(true);
    this.voucherService
      .grant(dto)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.grantSubmitting.set(false);
          if (isVoucher(result)) {
            this.alerts.open('მიენიჭა', { appearance: 'success' }).pipe(take(1)).subscribe();
          } else {
            this.alerts
              .open('მოლოდინში დაემატა', { appearance: 'info' })
              .pipe(take(1))
              .subscribe();
          }
          this.resetGrantForm();
          this.refreshLists();
        },
        error: () => {
          this.grantSubmitting.set(false);
          this.alerts
            .open('შეცდომა მინიჭებისას.', { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  private resetGrantForm(): void {
    this.grantForm.reset({ email: '', amountGel: null, expiresAt: null, note: '' });
  }

  // bulk import
  /**
   * Parse the `email,amountGel` textarea. Blank lines are ignored; every other
   * line must be exactly two comma-separated fields with a valid email and a
   * positive amount. Returns valid entries (amount already in tetri) alongside a
   * Georgian error per malformed line (1-based line numbers).
   */
  parseImport(text: string): ParsedImport {
    const entries: ImportEntry[] = [];
    const errors: string[] = [];
    const lines = text.split(/\r?\n/);
    lines.forEach((raw, index) => {
      const line = raw.trim();
      if (!line) return;
      const n = index + 1;
      const parts = line.split(',');
      if (parts.length !== 2) {
        errors.push(`ხაზი ${n}: არასწორი ფორმატი`);
        return;
      }
      const email = parts[0].trim().toLowerCase();
      const amount = Number(parts[1].trim());
      if (!EMAIL_RE.test(email)) {
        errors.push(`ხაზი ${n}: არასწორი ელფოსტა`);
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push(`ხაზი ${n}: არასწორი თანხა`);
        return;
      }
      entries.push({ email, amountTetri: gelToTetri(amount) });
    });
    return { entries, errors };
  }

  submitImport(): void {
    const facilityId = this.selectedFacilityId();
    if (!facilityId) return;
    const { entries, errors } = this.parseImport(this.importControl.value ?? '');
    if (errors.length > 0) {
      this.importErrors.set(errors);
      return;
    }
    if (entries.length === 0) {
      this.importErrors.set(['სია ცარიელია']);
      return;
    }
    this.importErrors.set([]);
    const expiresAt = this.importExpiry.value ? tuiDayToIso(this.importExpiry.value) : undefined;

    this.importSubmitting.set(true);
    this.voucherService
      .import(facilityId, entries, expiresAt)
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          this.importSubmitting.set(false);
          this.alerts
            .open(`მიენიჭა ${res.granted} · მოლოდინში ${res.pending}`, { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
          this.importControl.reset('');
          this.importExpiry.reset(null);
          this.refreshLists();
        },
        error: () => {
          this.importSubmitting.set(false);
          this.alerts
            .open('შეცდომა იმპორტისას.', { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  // table display helpers
  /** Derive the display status: pending -> depleted -> expired -> active. */
  derivedStatus(v: Voucher): VoucherDerivedStatus {
    if (v.status === 'pending_activation') return 'pending_activation';
    if (v.balanceTetri <= 0) return 'depleted';
    if (v.expiresAt && new Date(v.expiresAt).getTime() <= Date.now()) return 'expired';
    return 'active';
  }

  statusChipAppearance(
    status: VoucherDerivedStatus,
  ): 'positive' | 'neutral' | 'destructive' | 'warning' {
    switch (status) {
      case 'active':
        return 'positive';
      case 'depleted':
        return 'neutral';
      case 'expired':
        return 'destructive';
      case 'pending_activation':
        return 'warning';
    }
  }

  balanceGel(v: Voucher): number {
    return tetriToGel(v.balanceTetri);
  }

  initialGel(v: Voucher): number {
    return tetriToGel(v.initialTetri);
  }

  grantAmountGel(g: PendingGrant): number {
    return tetriToGel(g.amountTetri);
  }

  /** `expiresAt` as a plain YYYY-MM-DD, or a dash when the voucher never expires. */
  expiryLabel(expiresAt?: string | null): string {
    return expiresAt ? expiresAt.slice(0, 10) : '—';
  }

  ownerLabel(v: Voucher): string {
    return v.ownerEmail || v.owner || '—';
  }

  navigateToFacilities(): void {
    this.router.navigate(['/configuration/facilities']);
  }
}
