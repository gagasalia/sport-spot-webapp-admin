import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { UserFormComponent } from './user-form.component';
import { UserManagementService } from '../../../../services/http-services/user-management.service';
import { SsToastService } from '../../../../shared/ui/toast.service';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../../../shared/ui/dialog.service';
import { User, UserType } from '../../../../shared/models/user.model';

/** docs/29: signed up with Google, no phone yet. */
const googleOnly: User = {
  _id: 'u2',
  email: 'nino@gmail.com',
  googleLinked: true,
  firstName: 'Nino',
  lastName: 'Beridze',
  userType: [UserType.USER],
};

/** docs/30: signed up with Facebook — no phone, and Facebook shared no email. */
const facebookOnly: User = {
  _id: 'u4',
  facebookLinked: true,
  firstName: 'Giorgi',
  lastName: 'Lomidze',
  userType: [UserType.USER],
};

/** Both providers linked, no phone yet. */
const bothProviders: User = {
  ...googleOnly,
  _id: 'u5',
  facebookLinked: true,
};

const phonePlayer: User = {
  _id: 'u1',
  firstName: 'Anna',
  phone: '+995599000111',
  email: 'anna@example.com',
  userType: [UserType.USER],
};

describe('UserFormComponent — Google-only players (docs/29)', () => {
  let fixture: ComponentFixture<UserFormComponent>;
  let component: UserFormComponent;
  let serviceSpy: jasmine.SpyObj<UserManagementService>;

  async function setup(user?: User) {
    serviceSpy = jasmine.createSpyObj<UserManagementService>('UserManagementService', [
      'createUser',
      'updateUser',
    ]);
    serviceSpy.updateUser.and.callFake((_id, dto) => of({ ...user!, ...dto } as User));
    const context = jasmine.createSpyObj<SsDialogContext<User | null, { user?: User }>>(
      'SsDialogContext',
      ['completeWith', 'dismiss'],
      { data: user ? { user } : {} },
    );
    await TestBed.configureTestingModule({
      imports: [UserFormComponent],
      providers: [
        { provide: SS_DIALOG_CONTEXT, useValue: context },
        { provide: UserManagementService, useValue: serviceSpy },
        { provide: SsToastService, useValue: { open: () => of(undefined) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(UserFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('a Google-only player is valid without a phone and keeps its identity on save', async () => {
    await setup(googleOnly);

    expect(component.userForm.get('phone')!.value).toBe('');
    expect(component.userForm.valid).toBeTrue();
    expect(el().querySelector('[automation-id="phone-optional-hint"]')).not.toBeNull();
    // The Google-owned email is shown but locked.
    expect(component.userForm.get('email')!.disabled).toBeTrue();
    expect(el().querySelector('[automation-id="google-badge"]')).not.toBeNull();

    component.userForm.patchValue({ firstName: 'Nina' });
    component.onSubmit();

    expect(serviceSpy.updateUser).toHaveBeenCalledTimes(1);
    const [id, dto] = serviceSpy.updateUser.calls.mostRecent().args;
    expect(id).toBe('u2');
    expect(dto.firstName).toBe('Nina');
    // Neither an empty phone nor the Google email is ever sent.
    expect('phone' in dto).toBeFalse();
    expect('email' in dto).toBeFalse();
    expect('username' in dto).toBeFalse();
  });

  it('a Google-only player may still get a phone (format enforced)', async () => {
    await setup(googleOnly);

    component.userForm.patchValue({ phone: '+99559' });
    expect(component.userForm.valid).toBeFalse();

    component.userForm.patchValue({ phone: '+995599000222' });
    expect(component.userForm.valid).toBeTrue();
    component.onSubmit();
    expect(serviceSpy.updateUser.calls.mostRecent().args[1].phone).toBe('995599000222');
  });

  it('a raw /um document with googleId counts as Google-linked', async () => {
    await setup({ ...googleOnly, googleLinked: undefined, googleId: '1234567890' });
    expect(component.userForm.valid).toBeTrue();
  });

  it('a phone player keeps the phone required', async () => {
    await setup(phonePlayer);
    expect(component.userForm.valid).toBeTrue();
    expect(component.userForm.get('email')!.disabled).toBeFalse();
    expect(el().querySelector('[automation-id="phone-optional-hint"]')).toBeNull();

    component.userForm.patchValue({ phone: '' });
    expect(component.userForm.get('phone')!.hasError('required')).toBeTrue();
    expect(component.userForm.valid).toBeFalse();
  });

  it('a new player still requires a phone', async () => {
    await setup();
    component.userForm.patchValue({ email: 'new@example.com', password: 'secret123' });
    expect(component.userForm.get('phone')!.hasError('required')).toBeTrue();
    expect(el().querySelector('[automation-id="google-badge"]')).toBeNull();
    expect(el().querySelector('[automation-id="facebook-badge"]')).toBeNull();
  });

  it('a new player still requires an email', async () => {
    await setup();
    expect(component.userForm.get('email')!.hasError('required')).toBeTrue();
  });

  it('the Google phone hint names the provider', async () => {
    await setup(googleOnly);
    expect(
      el().querySelector('[automation-id="phone-optional-hint"]')?.textContent?.trim(),
    ).toBe('Google-ით დარეგისტრირებულ მოთამაშეს ტელეფონი ჯერ არ აქვს — ველი შეიძლება ცარიელი დარჩეს');
  });
});

describe('UserFormComponent — Facebook-linked players (docs/30)', () => {
  let fixture: ComponentFixture<UserFormComponent>;
  let component: UserFormComponent;
  let serviceSpy: jasmine.SpyObj<UserManagementService>;

  async function setup(user: User) {
    serviceSpy = jasmine.createSpyObj<UserManagementService>('UserManagementService', [
      'createUser',
      'updateUser',
    ]);
    serviceSpy.updateUser.and.callFake((_id, dto) => of({ ...user, ...dto } as User));
    const context = jasmine.createSpyObj<SsDialogContext<User | null, { user?: User }>>(
      'SsDialogContext',
      ['completeWith', 'dismiss'],
      { data: { user } },
    );
    await TestBed.configureTestingModule({
      imports: [UserFormComponent],
      providers: [
        { provide: SS_DIALOG_CONTEXT, useValue: context },
        { provide: UserManagementService, useValue: serviceSpy },
        { provide: SsToastService, useValue: { open: () => of(undefined) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(UserFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const chips = (): string[] =>
    Array.from(el().querySelectorAll('ss-provider-badges .ss-badge')).map((c) =>
      c.textContent!.trim(),
    );

  it('a Facebook-only player with no phone and no email is valid and saves', async () => {
    await setup(facebookOnly);

    expect(component.userForm.get('phone')!.value).toBe('');
    expect(component.userForm.get('email')!.value).toBe('');
    // Facebook does not own the email: editable, just not required.
    expect(component.userForm.get('email')!.disabled).toBeFalse();
    expect(component.userForm.get('email')!.hasError('required')).toBeFalse();
    expect(component.userForm.valid).toBeTrue();
    expect(chips()).toEqual(['Facebook']);
    expect(el().querySelector('[automation-id="email-optional-hint"]')).not.toBeNull();
    expect(
      el().querySelector('[automation-id="phone-optional-hint"]')?.textContent?.trim(),
    ).toBe('Facebook-ით დარეგისტრირებულ მოთამაშეს ტელეფონი ჯერ არ აქვს — ველი შეიძლება ცარიელი დარჩეს');
    expect(el().textContent).not.toContain('undefined');

    component.userForm.patchValue({ firstName: 'Gio' });
    component.onSubmit();

    expect(serviceSpy.updateUser).toHaveBeenCalledTimes(1);
    const [id, dto] = serviceSpy.updateUser.calls.mostRecent().args;
    expect(id).toBe('u4');
    expect(dto.firstName).toBe('Gio');
    // Neither an empty phone nor an empty email is ever sent.
    expect('phone' in dto).toBeFalse();
    expect('email' in dto).toBeFalse();
    expect('username' in dto).toBeFalse();
  });

  it('a Facebook-only player may get an email and a phone (formats enforced)', async () => {
    await setup(facebookOnly);

    component.userForm.patchValue({ email: 'not-an-email' });
    expect(component.userForm.valid).toBeFalse();
    component.userForm.patchValue({ email: 'giorgi@example.com', phone: '+99559' });
    expect(component.userForm.valid).toBeFalse();
    component.userForm.patchValue({ phone: '+995599000444' });
    expect(component.userForm.valid).toBeTrue();

    component.onSubmit();
    const dto = serviceSpy.updateUser.calls.mostRecent().args[1];
    expect(dto.email).toBe('giorgi@example.com');
    expect(dto.phone).toBe('995599000444');
  });

  it('a raw /um document with facebookId counts as Facebook-linked', async () => {
    await setup({ ...facebookOnly, facebookLinked: undefined, facebookId: '10230000000000001' });
    expect(component.userForm.valid).toBeTrue();
    expect(chips()).toEqual(['Facebook']);
  });

  it('a Facebook player WITH a phone keeps the phone required', async () => {
    await setup({ ...facebookOnly, phone: '+995599000333' });
    expect(component.userForm.valid).toBeTrue();
    expect(el().querySelector('[automation-id="phone-optional-hint"]')).toBeNull();

    component.userForm.patchValue({ phone: '' });
    expect(component.userForm.get('phone')!.hasError('required')).toBeTrue();
    // …while its missing email stays optional
    expect(component.userForm.get('email')!.hasError('required')).toBeFalse();
  });

  it('both providers: Google locks the email, two chips, phone optional', async () => {
    await setup(bothProviders);

    expect(component.userForm.get('email')!.disabled).toBeTrue();
    expect(component.userForm.valid).toBeTrue();
    expect(chips()).toEqual(['Google', 'Facebook']);
    expect(el().querySelector('[automation-id="email-optional-hint"]')).toBeNull();
    expect(
      el().querySelector('[automation-id="phone-optional-hint"]')?.textContent?.trim(),
    ).toBe(
      'Google / Facebook-ით დარეგისტრირებულ მოთამაშეს ტელეფონი ჯერ არ აქვს — ველი შეიძლება ცარიელი დარჩეს',
    );

    component.onSubmit();
    const dto = serviceSpy.updateUser.calls.mostRecent().args[1];
    expect('phone' in dto).toBeFalse();
    expect('email' in dto).toBeFalse();
  });
});
