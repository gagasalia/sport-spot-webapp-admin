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
  });
});
