import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TuiAlertService } from '@taiga-ui/core';

import { VouchersComponent } from './vouchers.component';
import { VoucherService } from '../../services/http-services/voucher.service';
import { FacilityService } from '../../services/http-services/facility.service';
import { TenantService } from '../../shared/services/tenant.service';
import { Facility } from '../../shared/models/facility.model';
import { PendingGrant, Voucher } from '../../shared/models/voucher.model';

const facility: Facility = {
  _id: 'fac-1',
  name: 'Padel House',
  country: 'Georgia',
  city: 'Tbilisi',
  description: 'desc',
  amenities: [],
};

const activeVoucher: Voucher = {
  _id: 'v-1',
  facility: 'fac-1',
  code: 'SS-ABCD-2345',
  initialTetri: 5000,
  balanceTetri: 5000,
  currency: 'GEL',
  status: 'active',
  source: 'admin_grant',
  ownerEmail: 'gio@mail.com',
};

const pendingGrant: PendingGrant = {
  _id: 'g-1',
  email: 'new@mail.com',
  facility: 'fac-1',
  amountTetri: 3000,
  source: 'admin_grant',
  note: 'welcome',
};

describe('VouchersComponent', () => {
  let component: VouchersComponent;
  let fixture: ComponentFixture<VouchersComponent>;
  let voucherSpy: jasmine.SpyObj<VoucherService>;
  let facilitySpy: jasmine.SpyObj<FacilityService>;
  let tenantSpy: jasmine.SpyObj<TenantService>;
  let alertSpy: jasmine.SpyObj<TuiAlertService>;

  async function setup() {
    voucherSpy = jasmine.createSpyObj<VoucherService>('VoucherService', [
      'grant',
      'import',
      'getVouchers',
      'getGrants',
    ]);
    facilitySpy = jasmine.createSpyObj<FacilityService>('FacilityService', [
      'getFacilitiesByAcademy',
    ]);
    tenantSpy = jasmine.createSpyObj<TenantService>('TenantService', ['academyId', 'ensure']);
    alertSpy = jasmine.createSpyObj<TuiAlertService>('TuiAlertService', ['open']);

    tenantSpy.academyId.and.returnValue('aca-1');
    tenantSpy.ensure.and.returnValue(of(null));
    facilitySpy.getFacilitiesByAcademy.and.returnValue(of([facility]));
    voucherSpy.getVouchers.and.returnValue(of([activeVoucher]));
    voucherSpy.getGrants.and.returnValue(of([pendingGrant]));
    voucherSpy.grant.and.returnValue(of(activeVoucher));
    voucherSpy.import.and.returnValue(of({ granted: 1, pending: 1 }));
    alertSpy.open.and.returnValue(of(undefined));

    const routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [VouchersComponent],
      providers: [
        { provide: VoucherService, useValue: voucherSpy },
        { provide: FacilityService, useValue: facilitySpy },
        { provide: TenantService, useValue: tenantSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: TuiAlertService, useValue: alertSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(VouchersComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VouchersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => setup());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── facility resolution ──────────────────────────────────────────────────────
  it('resolves the tenant, auto-selects the single facility and loads both lists', () => {
    expect(facilitySpy.getFacilitiesByAcademy).toHaveBeenCalledWith('aca-1');
    expect(component.selectedFacilityId()).toBe('fac-1');
    expect(voucherSpy.getVouchers).toHaveBeenCalledWith('fac-1');
    expect(voucherSpy.getGrants).toHaveBeenCalledWith('fac-1');
    expect(component.vouchers()).toEqual([activeVoucher]);
    expect(component.grants()).toEqual([pendingGrant]);
  });

  it('does not load facilities when there is no tenant academy', fakeAsync(() => {
    tenantSpy.academyId.and.returnValue(null);
    facilitySpy.getFacilitiesByAcademy.calls.reset();
    component.ngOnInit();
    tick();
    expect(facilitySpy.getFacilitiesByAcademy).not.toHaveBeenCalled();
    expect(component.facilities()).toEqual([]);
  }));

  it('surfaces an error state when a list fetch hard-fails', () => {
    voucherSpy.getVouchers.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    voucherSpy.getGrants.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    // Re-run the facility selection to trigger a fresh loadLists().
    component.onFacilityChange('fac-1');
    expect(component.hasError()).toBeTrue();
  });

  // ── grant submit ─────────────────────────────────────────────────────────────
  it('submitGrant converts GEL to tetri and POSTs the grant (success alert)', () => {
    component.grantForm.patchValue({ email: 'Gio@Mail.com', amountGel: 50, note: '  hi  ' });
    component.submitGrant();

    expect(voucherSpy.grant).toHaveBeenCalledWith({
      email: 'gio@mail.com',
      facilityId: 'fac-1',
      amountTetri: 5000,
      note: 'hi',
    });
    expect(alertSpy.open).toHaveBeenCalledWith('მიენიჭა', jasmine.objectContaining({ appearance: 'success' }));
    // The form is reset after a successful grant, and the lists refresh.
    expect(component.grantForm.value.email).toBeFalsy();
    expect(voucherSpy.getVouchers).toHaveBeenCalledTimes(2);
  });

  it('submitGrant shows an info alert when the API returns a pending grant', () => {
    voucherSpy.grant.and.returnValue(of(pendingGrant));
    component.grantForm.patchValue({ email: 'new@mail.com', amountGel: 30 });
    component.submitGrant();

    expect(voucherSpy.grant).toHaveBeenCalledWith(
      jasmine.objectContaining({ email: 'new@mail.com', amountTetri: 3000 }),
    );
    expect(alertSpy.open).toHaveBeenCalledWith('მოლოდინში დაემატა', jasmine.objectContaining({ appearance: 'info' }));
  });

  it('submitGrant does nothing when the form is invalid', () => {
    component.grantForm.patchValue({ email: 'not-an-email', amountGel: 0 });
    component.submitGrant();
    expect(voucherSpy.grant).not.toHaveBeenCalled();
  });

  // ── import parsing ───────────────────────────────────────────────────────────
  it('parseImport accepts valid lines (amounts in tetri) and skips blanks', () => {
    const { entries, errors } = component.parseImport('a@mail.com,50\n\n  b@mail.com , 12.5 \n');
    expect(errors).toEqual([]);
    expect(entries).toEqual([
      { email: 'a@mail.com', amountTetri: 5000 },
      { email: 'b@mail.com', amountTetri: 1250 },
    ]);
  });

  it('parseImport reports a per-line error for each bad line', () => {
    const text = ['good@mail.com,10', 'bad-email,10', 'x@mail.com,-5', 'too,many,fields'].join('\n');
    const { entries, errors } = component.parseImport(text);
    expect(entries).toEqual([{ email: 'good@mail.com', amountTetri: 1000 }]);
    expect(errors.length).toBe(3);
    expect(errors[0]).toContain('ხაზი 2');
    expect(errors[1]).toContain('ხაზი 3');
    expect(errors[2]).toContain('ხაზი 4');
  });

  it('submitImport blocks on parse errors and does not call the API', () => {
    component.importControl.setValue('bad-email,10');
    component.submitImport();
    expect(component.importErrors().length).toBe(1);
    expect(voucherSpy.import).not.toHaveBeenCalled();
  });

  it('submitImport posts valid entries and reports the granted/pending split', () => {
    component.importControl.setValue('a@mail.com,50\nb@mail.com,25');
    component.submitImport();

    expect(voucherSpy.import).toHaveBeenCalledWith(
      'fac-1',
      [
        { email: 'a@mail.com', amountTetri: 5000 },
        { email: 'b@mail.com', amountTetri: 2500 },
      ],
      undefined,
    );
    expect(alertSpy.open).toHaveBeenCalledWith(
      'მიენიჭა 1 · მოლოდინში 1',
      jasmine.objectContaining({ appearance: 'success' }),
    );
    expect(component.importErrors()).toEqual([]);
  });

  it('submitImport flags an empty list', () => {
    component.importControl.setValue('   \n  ');
    component.submitImport();
    expect(component.importErrors().length).toBe(1);
    expect(voucherSpy.import).not.toHaveBeenCalled();
  });

  // ── derived status chips ─────────────────────────────────────────────────────
  it('derivedStatus: pending_activation wins over everything', () => {
    const v: Voucher = { ...activeVoucher, status: 'pending_activation', balanceTetri: 0 };
    expect(component.derivedStatus(v)).toBe('pending_activation');
  });

  it('derivedStatus: a zero balance is depleted', () => {
    expect(component.derivedStatus({ ...activeVoucher, balanceTetri: 0 })).toBe('depleted');
  });

  it('derivedStatus: a past expiry with balance left is expired', () => {
    expect(component.derivedStatus({ ...activeVoucher, expiresAt: '2020-01-01' })).toBe('expired');
  });

  it('derivedStatus: an active, funded, unexpired voucher is active', () => {
    expect(component.derivedStatus({ ...activeVoucher, expiresAt: '2999-01-01' })).toBe('active');
  });

  it('statusChipAppearance maps each state to its chip appearance', () => {
    expect(component.statusChipAppearance('active')).toBe('positive');
    expect(component.statusChipAppearance('depleted')).toBe('neutral');
    expect(component.statusChipAppearance('expired')).toBe('destructive');
    expect(component.statusChipAppearance('pending_activation')).toBe('warning');
  });

  it('renders the voucher and grant tables from the loaded lists', () => {
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('SS-ABCD-2345');
    expect(html).toContain('gio@mail.com');
    expect(html).toContain('new@mail.com');
    // balance/initial rendered in GEL
    expect(html).toContain('50');
  });

  it('ownerLabel and money helpers convert tetri to GEL', () => {
    expect(component.balanceGel(activeVoucher)).toBe(50);
    expect(component.initialGel(activeVoucher)).toBe(50);
    expect(component.grantAmountGel(pendingGrant)).toBe(30);
    expect(component.ownerLabel(activeVoucher)).toBe('gio@mail.com');
    expect(component.expiryLabel(null)).toBe('—');
    expect(component.expiryLabel('2026-12-31T00:00:00Z')).toBe('2026-12-31');
  });
});
