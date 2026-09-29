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
