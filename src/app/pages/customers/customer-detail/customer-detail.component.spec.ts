import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApplicationRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { CustomerDetailComponent } from './customer-detail.component';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { CustomersService } from '../../../services/http-services/customers.service';
import { AuthService } from '../../../shared/services/auth.service';
import { FacilityNamesService } from '../../../shared/i18n/facility-names.service';
import { SsDialogService } from '../../../shared/ui/dialog.service';
import { SsToastService } from '../../../shared/ui/toast.service';
import { SsProviderBadgesComponent } from '../../../shared/ui/provider-badges.component';
import {
  CustomerDetail,
  CustomerModeration,
} from '../../../shared/models/customer.model';

const cleanModeration: CustomerModeration = {
  banned: false,
  flagged: false,
  history: [],
};

const detail: CustomerDetail = {
  profile: {
    _id: 'u1',
    email: 'anna@example.com',
    firstName: 'Anna',
    lastName: 'Kapanadze',
    phone: '+995599000111',
    emailVerified: true,
    phoneVerified: false,
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  moderation: cleanModeration,
  stats: {
    bookings: 12,
    cancelled: 3,
    cancelRate: 0.25,
    noShows: 1,
    noShowRate: 1 / 12,
    spentTetri: 66000,
    upcoming: 2,
    firstBookingAt: '2026-05-05T10:00:00.000Z',
    lastBookingAt: '2026-07-30T10:00:00.000Z',
  },
};

/** docs/29: signed up with Google, no phone yet (transitional state). */
const googleDetail: CustomerDetail = {
  ...detail,
  profile: {
    _id: 'u2',
    firstName: 'Nino',
    lastName: 'Beridze',
    email: 'nino@gmail.com',
    googleLinked: true,
    phoneVerified: false,
    createdAt: '2026-09-29T00:00:00.000Z',
  },
};

/** docs/30: signed up with Facebook — no phone, and Facebook shared no email. */
const facebookDetail: CustomerDetail = {
  ...detail,
  profile: {
    _id: 'u4',
    memberId: 43,
    firstName: 'Giorgi',
    lastName: 'Lomidze',
    facebookLinked: true,
    phoneVerified: false,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
};

/** Both providers linked, no phone yet: the Google email + two chips. */
const bothDetail: CustomerDetail = {
  ...detail,
  profile: {
    ...googleDetail.profile,
    _id: 'u5',
    facebookLinked: true,
  },
};

const bookingRows = [
  {
    _id: 'b1',
    date: '2026-07-30',
    start: '18:00',
    end: '19:00',
    status: 'confirmed' as const,
    paymentStatus: 'paid',
    paymentMethod: 'card',
    priceTetri: 6000,
    facilityName: 'Arena',
    courtName: 'კორტი 2',
    courtNameEn: 'Court 2',
  },
];

describe('CustomerDetailComponent', () => {
  let component: CustomerDetailComponent;
  let fixture: ComponentFixture<CustomerDetailComponent>;
  let customersSpy: jasmine.SpyObj<CustomersService>;
  let dialogsSpy: jasmine.SpyObj<SsDialogService>;
  let routerSpy: jasmine.SpyObj<Router>;

  async function setup(superAdmin: boolean, served: CustomerDetail = detail) {
    customersSpy = jasmine.createSpyObj<CustomersService>('CustomersService', [
      'detail',
      'bookings',
      'ban',
      'unban',
      'flag',
      'unflag',
      'fixContact',
    ]);
    customersSpy.detail.and.returnValue(of(served));
    customersSpy.bookings.and.returnValue(
      of({ data: bookingRows, page: { page: 1, size: 10, total: 1 } }),
    );
    dialogsSpy = jasmine.createSpyObj<SsDialogService>('SsDialogService', [
      'open',
    ]);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [CustomerDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'u1' })) },
        },
        { provide: AuthService, useValue: { isSuperAdmin: () => superAdmin } },
        { provide: CustomersService, useValue: customersSpy },
        // Name lookup is exercised in facility-names.service.spec; here it just
        // echoes the row snapshot so the labels stay the Georgian fixtures.
        {
          provide: FacilityNamesService,
          useValue: {
            ensure: () => undefined,
            ensureFor: () => undefined,
            label: (_id: string | undefined, fallback: string | undefined) => fallback ?? '',
          },
        },
        { provide: SsDialogService, useValue: dialogsSpy },
        {
          provide: SsToastService,
          useValue: { open: () => of(undefined) },
        },
        { provide: Router, useValue: routerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(CustomerDetailComponent, {
        // set:{imports} REPLACES the array — the template renders `| date`
        // unconditionally and every label through `| t`; keep both pipes, and
        // the provider chips (asserted below).
        set: {
          imports: [DatePipe, TPipe, SsProviderBadgesComponent],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CustomerDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
  }

  describe('loading', () => {
    beforeEach(async () => setup(false));

    it('loads the detail and the first history page for the route id', () => {
      expect(customersSpy.detail).toHaveBeenCalledWith('u1');
      expect(customersSpy.bookings).toHaveBeenCalledWith('u1', 1, 10);
      expect(component['detail']()).toEqual(detail);
      expect(component['bookingRows']()).toEqual(bookingRows as never);
      expect(component['bookingsTotal']()).toBe(1);
    });
  });

  describe('moderation actions', () => {
    beforeEach(async () => setup(false));

    it('ban: reason dialog → PATCH → moderation patched in place', () => {
      const banned: CustomerModeration = {
        banned: true,
        banReason: 'chronic no-show',
        flagged: false,
        history: [],
      };
      dialogsSpy.open.and.returnValue(of('chronic no-show'));
      customersSpy.ban.and.returnValue(of(banned));

      component['ban']();

      expect(customersSpy.ban).toHaveBeenCalledWith('u1', 'chronic no-show');
      expect(component['detail']()?.moderation.banned).toBeTrue();
      // The rest of the detail stays untouched.
      expect(component['detail']()?.stats.bookings).toBe(12);
    });

    it('a cancelled reason dialog never fires the PATCH', () => {
      dialogsSpy.open.and.returnValue(of(null));
      component['ban']();
      expect(customersSpy.ban).not.toHaveBeenCalled();

      component['flagCustomer']();
      expect(customersSpy.flag).not.toHaveBeenCalled();
    });

    it('unban goes through the confirm dialog', () => {
      const lifted: CustomerModeration = { ...cleanModeration };
      dialogsSpy.open.and.returnValue(of(true));
      customersSpy.unban.and.returnValue(of(lifted));

      component['unban']();
      expect(customersSpy.unban).toHaveBeenCalledWith('u1');
      expect(component['detail']()?.moderation.banned).toBeFalse();
    });

    it('cannot edit identity: no contact dialog, no PATCH', () => {
      dialogsSpy.open.calls.reset();
      component['editContact']();
      expect(dialogsSpy.open).not.toHaveBeenCalled();
      expect(customersSpy.fixContact).not.toHaveBeenCalled();
    });

    it('hides the edit button', () => {
      fixture.detectChanges();
      const btn = (
        fixture.nativeElement as HTMLElement
      ).querySelector('[automation-id="customer-edit"]');
      expect(btn).toBeNull();
    });
  });

  describe('as a superadmin', () => {
    beforeEach(async () => setup(true));

    it('contact fix reloads the whole detail (profile + audit trail changed)', () => {
      dialogsSpy.open.and.returnValue(of({ firstName: 'Ana' }));
      customersSpy.fixContact.and.returnValue(of(detail.profile));
      customersSpy.detail.calls.reset();

      component['editContact']();

      expect(customersSpy.fixContact).toHaveBeenCalledWith('u1', {
        firstName: 'Ana',
      });
      expect(customersSpy.detail).toHaveBeenCalledTimes(1);
    });

    it('passes allowEmail=true to the contact dialog', () => {
      dialogsSpy.open.and.returnValue(of(null));
      component['editContact']();
      const options = dialogsSpy.open.calls.mostRecent().args[1] as {
        data: { allowEmail: boolean };
      };
      expect(options.data.allowEmail).toBeTrue();
    });

    it('deep-links to the full account surface by member ID, else phone', () => {
      component['openFullAccount']();
      expect(routerSpy.navigate).toHaveBeenCalledWith(
        ['/super-admin/user-management'],
        { queryParams: { phone: '+995599000111' } },
      );

      component['detail'].set({ ...detail, profile: { ...detail.profile, memberId: 42 } });
      component['openFullAccount']();
      expect(routerSpy.navigate).toHaveBeenCalledWith(
        ['/super-admin/user-management'],
        { queryParams: { memberId: '42' } },
      );
    });

    it('deep-links a Google-only player (no member ID, no phone) by email', () => {
      component['detail'].set(googleDetail);
      component['openFullAccount']();
      expect(routerSpy.navigate).toHaveBeenCalledWith(
        ['/super-admin/user-management'],
        { queryParams: { email: 'nino@gmail.com' } },
      );
    });
  });

  describe('a phone-less Google player (docs/29)', () => {
    const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

    it('shows the email with a Google badge and the no-phone note', async () => {
      await setup(true, googleDetail);
      fixture.detectChanges();

      const contact = el().querySelector('[automation-id="customer-contact"]') as HTMLElement;
      expect(contact.textContent).toContain('nino@gmail.com');
      expect(
        contact.querySelector('[automation-id="google-badge"]')?.textContent?.trim(),
      ).toBe('Google');
      expect(
        el().querySelector('[automation-id="customer-no-phone"]')?.textContent?.trim(),
      ).toBe('ტელეფონი არ არის მითითებული');
      // The contact fix stays available — it is how a superadmin adds a phone.
      expect(el().querySelector('[automation-id="customer-edit"]')).not.toBeNull();
      expect(el().textContent).not.toContain('undefined');
    });

    it('a phone player shows the phone, no note and no Google badge', async () => {
      await setup(false);
      fixture.detectChanges();

      const contact = el().querySelector('[automation-id="customer-contact"]') as HTMLElement;
      expect(contact.textContent).toContain('+995599000111');
      expect(el().querySelector('[automation-id="google-badge"]')).toBeNull();
      expect(el().querySelector('[automation-id="customer-no-phone"]')).toBeNull();
      expect(el().textContent).not.toContain('undefined');
    });

    it('name helpers never fall through to undefined', async () => {
      await setup(false, googleDetail);
      expect(component['fullName']()).toBe('Nino Beridze');
      expect(component['initials']()).toBe('NB');

      component['detail'].set({
        ...googleDetail,
        profile: { ...googleDetail.profile, firstName: undefined, lastName: undefined },
      });
      expect(component['fullName']()).toBe('nino@gmail.com');
      expect(component['initials']()).toBe('N');

      component['detail'].set({
        ...detail,
        profile: { ...detail.profile, firstName: undefined, lastName: undefined, email: undefined },
      });
      expect(component['fullName']()).toBe('+995599000111');
      expect(component['initials']()).toBe('?');
    });
  });

  describe('Facebook-linked players (docs/30)', () => {
    const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
    const chips = (scope: Element): string[] =>
      Array.from(scope.querySelectorAll('ss-provider-badges .ss-badge')).map((c) =>
        c.textContent!.trim(),
      );

    it('a Facebook-only player (no phone, no email) shows the provider chip and the note', async () => {
      await setup(true, facebookDetail);
      fixture.detectChanges();

      const contact = el().querySelector('[automation-id="customer-contact"]') as HTMLElement;
      expect(contact.textContent).toContain('ID - 000043');
      expect(chips(contact)).toEqual(['Facebook']);
      expect(contact.querySelector('[automation-id="facebook-badge"]')).not.toBeNull();
      expect(contact.querySelector('[automation-id="google-badge"]')).toBeNull();
      expect(
        el().querySelector('[automation-id="customer-no-phone"]')?.textContent?.trim(),
      ).toBe('ტელეფონი არ არის მითითებული');
      expect(el().querySelector('[automation-id="customer-edit"]')).not.toBeNull();
      expect(el().textContent).not.toContain('undefined');
    });

    it('both providers: the email with a Google and a Facebook chip', async () => {
      await setup(true, bothDetail);
      fixture.detectChanges();

      const contact = el().querySelector('[automation-id="customer-contact"]') as HTMLElement;
      expect(contact.textContent).toContain('nino@gmail.com');
      expect(chips(contact)).toEqual(['Google', 'Facebook']);
      expect(el().querySelector('[automation-id="customer-no-phone"]')).not.toBeNull();
    });

    it('a phone player that linked Facebook keeps the phone, gains the chip, no note', async () => {
      await setup(false, {
        ...detail,
        profile: { ...detail.profile, email: undefined, facebookLinked: true },
      });
      fixture.detectChanges();

      const contact = el().querySelector('[automation-id="customer-contact"]') as HTMLElement;
      expect(contact.textContent).toContain('+995599000111');
      expect(chips(contact)).toEqual(['Facebook']);
      expect(el().querySelector('[automation-id="customer-no-phone"]')).toBeNull();
    });

    it('name helpers fall back to the provider name, deep link uses the member ID', async () => {
      await setup(true, facebookDetail);
      expect(component['fullName']()).toBe('Giorgi Lomidze');
      expect(component['initials']()).toBe('GL');

      component['detail'].set({
        ...facebookDetail,
        profile: { ...facebookDetail.profile, firstName: undefined, lastName: undefined },
      });
      expect(component['fullName']()).toBe('Facebook');
      expect(component['initials']()).toBe('?');

      component['openFullAccount']();
      expect(routerSpy.navigate).toHaveBeenCalledWith(
        ['/super-admin/user-management'],
        { queryParams: { memberId: '43' } },
      );
    });
  });

  describe('display helpers', () => {
    beforeEach(async () => setup(false));

    it('formats money, percentages and payment labels', () => {
      expect(component['gel'](66000)).toContain('660');
      expect(component['pct'](0.25)).toBe('25%');
      expect(component['pct'](null)).toBe('—');
      expect(component['paymentLabel'](bookingRows[0] as never)).toBe(
        'გადახდილი (ბარათი)',
      );
      expect(
        component['paymentLabel']({
          ...bookingRows[0],
          paymentStatus: 'pay_at_venue',
          paymentMethod: undefined,
        } as never),
      ).toBe('ადგილზე გადახდა');
      expect(component['fullName']()).toBe('Anna Kapanadze');
      expect(component['initials']()).toBe('AK');
    });
  });
});
