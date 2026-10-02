import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactDialogComponent, ContactDialogData } from './contact-dialog.component';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../shared/ui/dialog.service';
import {
  CustomerProfile,
  UpdateCustomerContactDto,
} from '../../shared/models/customer.model';

const phoneProfile: CustomerProfile = {
  _id: 'u1',
  firstName: 'Anna',
  lastName: 'Kapanadze',
  phone: '+995599000111',
  phoneVerified: true,
};

/** docs/29: signed up with Google, no phone yet. */
const googleProfile: CustomerProfile = {
  _id: 'u2',
  firstName: 'Nino',
  lastName: 'Beridze',
  email: 'nino@gmail.com',
  googleLinked: true,
  phoneVerified: false,
};

/** docs/30: signed up with Facebook — no phone, and Facebook shared no email. */
const facebookProfile: CustomerProfile = {
  _id: 'u4',
  firstName: 'Giorgi',
  lastName: 'Lomidze',
  facebookLinked: true,
  phoneVerified: false,
};

/** Both providers linked, no phone yet: the email still belongs to Google. */
const bothProfile: CustomerProfile = {
  ...googleProfile,
  _id: 'u5',
  facebookLinked: true,
};

describe('ContactDialogComponent', () => {
  let fixture: ComponentFixture<ContactDialogComponent>;
  let component: ContactDialogComponent;
  let context: jasmine.SpyObj<
    SsDialogContext<UpdateCustomerContactDto | null, ContactDialogData>
  >;

  async function setup(data: ContactDialogData) {
    context = jasmine.createSpyObj<
      SsDialogContext<UpdateCustomerContactDto | null, ContactDialogData>
    >('SsDialogContext', ['completeWith', 'dismiss'], { data });
    // The template labels go through `| t` — TPipe rides in with the
    // standalone component's own imports (no override here).
    await TestBed.configureTestingModule({
      imports: [ContactDialogComponent],
      providers: [{ provide: SS_DIALOG_CONTEXT, useValue: context }],
    }).compileComponents();
    fixture = TestBed.createComponent(ContactDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const form = () => component['form'];

  describe('a phone-less Google player', () => {
    beforeEach(async () => setup({ profile: googleProfile, allowEmail: true }));

    it('starts with an empty phone and the no-phone note — never "undefined"', () => {
      expect(form().getRawValue().phone).toBe('');
      expect(
        el().querySelector('[automation-id="contact-no-phone"]')?.textContent?.trim(),
      ).toBe('ტელეფონი არ არის მითითებული');
      expect(el().textContent).not.toContain('undefined');
      expect((el().querySelector('input[type="tel"]') as HTMLInputElement).value).toBe('');
    });

    it('shows the Google email read-only (no editable email input)', () => {
      const google = el().querySelector('[automation-id="contact-google-email"]') as HTMLElement;
      expect(google.textContent).toContain('nino@gmail.com');
      expect(google.textContent).toContain('Google');
      expect(el().querySelector('input[type="email"]')).toBeNull();
    });

    it('a name fix emits only the name — no phone, no email', () => {
      form().patchValue({ firstName: 'Nina' });
      component['submit']();
      expect(context.completeWith).toHaveBeenCalledOnceWith({ firstName: 'Nina' });
    });

    it('never emits the Google email even if the control changed', () => {
      form().patchValue({ email: 'someone@else.com' });
      component['submit']();
      expect(context.completeWith).toHaveBeenCalledOnceWith(null);
    });

    it('adding a phone emits it', () => {
      form().patchValue({ phone: '599000222' });
      component['submit']();
      expect(context.completeWith).toHaveBeenCalledOnceWith({ phone: '599000222' });
    });
  });

  describe('a Facebook-only player without an email (docs/30)', () => {
    beforeEach(async () => setup({ profile: facebookProfile, allowEmail: true }));

    const chips = (): string[] =>
      Array.from(el().querySelectorAll('ss-provider-badges .ss-badge')).map((c) =>
        c.textContent!.trim(),
      );

    it('starts empty: no-phone note with the Facebook chip, editable optional email', () => {
      expect(form().getRawValue().phone).toBe('');
      expect(form().getRawValue().email).toBe('');
      expect(el().querySelector('[automation-id="contact-no-phone"]')).not.toBeNull();
      expect(chips()).toEqual(['Facebook']);
      // Facebook does not own the email: no read-only Google block, the input stays.
      expect(el().querySelector('[automation-id="contact-google-email"]')).toBeNull();
      expect(el().querySelector('input[type="email"]')).not.toBeNull();
      expect(el().querySelector('[automation-id="contact-email-optional"]')).not.toBeNull();
      expect(form().valid).toBeTrue();
      expect(el().textContent).not.toContain('undefined');
    });

    it('a name fix emits only the name — never an empty phone or email', () => {
      form().patchValue({ firstName: 'Gio' });
      component['submit']();
      expect(context.completeWith).toHaveBeenCalledOnceWith({ firstName: 'Gio' });
    });

    it('a whitespace-only phone counts as empty (nothing to send)', () => {
      form().patchValue({ phone: '   ' });
      component['submit']();
      expect(context.completeWith).toHaveBeenCalledOnceWith(null);
    });

    it('an operator may add an email (it is not provider-owned)', () => {
      form().patchValue({ email: 'giorgi@example.com' });
      component['submit']();
      expect(context.completeWith).toHaveBeenCalledOnceWith({ email: 'giorgi@example.com' });
    });
  });

  describe('a player linked to both Google and Facebook', () => {
    beforeEach(async () => setup({ profile: bothProfile, allowEmail: true }));

    it('the Google-owned email stays read-only; both chips sit by the no-phone note', () => {
      const google = el().querySelector('[automation-id="contact-google-email"]') as HTMLElement;
      expect(google.textContent).toContain('nino@gmail.com');
      expect(el().querySelector('input[type="email"]')).toBeNull();
      expect(el().querySelector('[automation-id="contact-email-optional"]')).toBeNull();
      const chips = Array.from(el().querySelectorAll('ss-provider-badges .ss-badge')).map((c) =>
        c.textContent!.trim(),
      );
      expect(chips).toEqual(['Google', 'Facebook']);
    });

    it('never emits the email', () => {
      form().patchValue({ email: 'someone@else.com', lastName: 'Beridze-Gelashvili' });
      component['submit']();
      expect(context.completeWith).toHaveBeenCalledOnceWith({ lastName: 'Beridze-Gelashvili' });
    });
  });

  describe('a phone player', () => {
    beforeEach(async () => setup({ profile: phoneProfile, allowEmail: true }));

    it('prefills the phone, hides the note and keeps the superadmin email field', () => {
      expect(form().getRawValue().phone).toBe('+995599000111');
      expect(el().querySelector('[automation-id="contact-no-phone"]')).toBeNull();
      expect(el().querySelector('[automation-id="contact-google-email"]')).toBeNull();
      expect(el().querySelector('input[type="email"]')).not.toBeNull();
      expect(el().textContent).not.toContain('undefined');
    });

    it('nothing changed → completes with null (no PATCH)', () => {
      component['submit']();
      expect(context.completeWith).toHaveBeenCalledOnceWith(null);
    });
  });

  it('tolerates a missing payload', async () => {
    await setup(undefined as unknown as ContactDialogData);
    expect(form().getRawValue()).toEqual({ firstName: '', lastName: '', phone: '', email: '' });
    expect(el().textContent).not.toContain('undefined');
  });
});
