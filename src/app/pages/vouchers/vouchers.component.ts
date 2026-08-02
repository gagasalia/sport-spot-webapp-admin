import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, take } from 'rxjs';
import { VoucherService } from '../../services/http-services/voucher.service';
import { FacilityService } from '../../services/http-services/facility.service';
import { TenantService } from '../../shared/services/tenant.service';
import { gelToTetri, tetriToGel } from '../../shared/utils/money.util';
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

import { SsToastService } from '../../shared/ui/toast.service';
/** Result of parsing the bulk-import textarea: valid entries + per-line errors. */
interface ParsedImport {
  entries: ImportEntry[];
  errors: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Admin voucher page (design section 21.6). Taiga-free (ss-* kit): a facility
 * chip rail (first selected by default, ?facilityId= override) gates three
 * blocks — a single grant form, a bulk-import textarea, and two tables
 * (facility vouchers + pending grants). Expiry dates use native date inputs
 * ('YYYY-MM-DD' strings). Amounts are entered/shown in GEL and converted to
 * integer tetri at the wire edge. SsToastService remains for toasts until the
 * kit grows its own (machinery is the last migration phase).
 */
@Component({
  selector: 'app-vouchers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vouchers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VouchersComponent implements OnInit {
  private readonly voucherService = inject(VoucherService);
  private readonly facilityService = inject(FacilityService);
  private readonly tenant = inject(TenantService);
  private readonly alerts = inject(SsToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // facility selection
  readonly facilities = signal<Facility[]>([]);
  readonly selectedFacilityId = signal<string | null>(null);

  // lists (each paginated independently — imports can make both grow)
  readonly vouchers = signal<Voucher[]>([]);
  readonly grants = signal<PendingGrant[]>([]);
  readonly vouchersPage = signal(1);
  readonly vouchersTotal = signal(0);
  readonly grantsPage = signal(1);
  readonly grantsTotal = signal(0);
  readonly listLimit = 20;
  readonly vouchersPages = computed(() =>
    Math.max(1, Math.ceil(this.vouchersTotal() / this.listLimit)),
  );
  readonly grantsPages = computed(() =>
    Math.max(1, Math.ceil(this.grantsTotal() / this.listLimit)),
  );

  // ui state
  readonly isLoading = signal(false);
  readonly hasError = signal(false);
  readonly grantSubmitting = signal(false);
  readonly importSubmitting = signal(false);
  readonly importErrors = signal<string[]>([]);

  // grant form — expiresAt is a native-date 'YYYY-MM-DD' string ('' = none)
  readonly grantForm = new FormGroup({
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    amountGel: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0.01)],
    }),
    expiresAt: new FormControl<string>('', { nonNullable: true }),
    note: new FormControl<string>('', { nonNullable: true }),
  });

  // import form
  readonly importControl = new FormControl<string>('', { nonNullable: true });
  readonly importExpiry = new FormControl<string>('', { nonNullable: true });

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

  facilityLabel(f: Facility): string {
    return f.name || f.description || 'უსახელო ობიექტი';
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

  /** The first chip is selected by default; a valid ?facilityId= overrides it. */
  private resolveSelection(facilities: Facility[]): void {
    this.route.queryParams.pipe(take(1)).subscribe((params) => {
      if (facilities.length === 0) {
        this.selectFacility(null);
        return;
      }
      const fromQuery = params['facilityId'];
      const match = facilities.find((f) => this.facilityIdOf(f) === fromQuery);
      const fId = match ? this.facilityIdOf(match) : this.facilityIdOf(facilities[0]);
      if (fromQuery !== fId) this.updateQueryParam(fId);
      this.selectFacility(fId);
    });
  }

  onFacilityChipClick(facility: Facility): void {
    const fId = this.facilityIdOf(facility);
    if (fId === this.selectedFacilityId()) return;
    this.updateQueryParam(fId);
    this.selectFacility(fId);
  }

  private selectFacility(facilityId: string | null): void {
    this.selectedFacilityId.set(facilityId);
    this.vouchers.set([]);
    this.grants.set([]);
    this.vouchersPage.set(1);
    this.vouchersTotal.set(0);
    this.grantsPage.set(1);
    this.grantsTotal.set(0);
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
      vouchers: this.voucherService.getVouchers(
        facilityId,
        this.vouchersPage(),
        this.listLimit,
      ),
      grants: this.voucherService.getGrants(
        facilityId,
        this.grantsPage(),
        this.listLimit,
      ),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ vouchers, grants }) => {
          this.vouchers.set(vouchers.data);
          this.vouchersTotal.set(vouchers.page?.total ?? vouchers.data.length);
          this.grants.set(grants.data);
          this.grantsTotal.set(grants.page?.total ?? grants.data.length);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  onVouchersPageChange(page: number): void {
    this.vouchersPage.set(page);
    this.refreshLists();
  }

  onGrantsPageChange(page: number): void {
    this.grantsPage.set(page);
    this.refreshLists();
  }

  /** Fresh writes land on top of page 1 — jump back so they are visible. */
  private refreshLists(resetToFirstPage = false): void {
    if (resetToFirstPage) {
      this.vouchersPage.set(1);
      this.grantsPage.set(1);
    }
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
    if (expiresAt) dto.expiresAt = expiresAt;
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
          this.refreshLists(true);
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
    this.grantForm.reset({ email: '', amountGel: null, expiresAt: '', note: '' });
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
    const expiresAt = this.importExpiry.value || undefined;

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
          this.importExpiry.reset('');
          this.refreshLists(true);
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

  /** ss-badge modifier class for a derived voucher status. */
  statusBadgeClass(status: VoucherDerivedStatus): string {
    switch (status) {
      case 'active':
        return 'ss-badge ss-badge--positive';
      case 'depleted':
        return 'ss-badge ss-badge--neutral';
      case 'expired':
        return 'ss-badge ss-badge--negative';
      case 'pending_activation':
        return 'ss-badge ss-badge--warning';
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
