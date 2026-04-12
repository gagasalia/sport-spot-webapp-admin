import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of, throwError, Subject } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';

import { WA_WINDOW } from '@ng-web-apis/common';
import { TuiAlertService } from '@taiga-ui/core';
import { TuiDialogService } from '@taiga-ui/experimental';

import { UserManagementComponent } from './user-management.component';
import { UserManagementService } from '../../../services/http-services/user-management.service';
import { User, UserType, FilterUsersDto } from '../../../shared/models/user.model';

// ─── Test data ───────────────────────────────────────────────────────────────

const mockUsers: User[] = [
  {
    _id: 'user-id-1',
    email: 'john@example.com',
    userType: [UserType.USER],
    firstName: 'John',
    lastName: 'Doe',
    phone: '5551234',
  },
  {
    _id: 'user-id-2',
    email: 'admin@example.com',
    userType: [UserType.ADMIN],
    firstName: 'Admin',
    lastName: 'User',
    phone: '5559999',
  },
];

// ─── Mock window ─────────────────────────────────────────────────────────────

// Use a Proxy over the real window so Taiga UI can access browser globals
// (HTMLInputElement, HTMLTextAreaElement, addEventListener, etc.) while
// allowing innerWidth to be overridden in individual tests.
let mockInnerWidth = 1024;
const mockWindow = new Proxy(window, {
  get(target, prop) {
    if (prop === 'innerWidth') return mockInnerWidth;
    const val = (target as any)[prop];
    return typeof val === 'function' ? val.bind(target) : val;
  },
  set(target, prop, value) {
    if (prop === 'innerWidth') {
      mockInnerWidth = value;
      return true;
    }
    (target as any)[prop] = value;
    return true;
  },
}) as any;

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('UserManagementComponent', () => {
  let component: UserManagementComponent;
  let fixture: ComponentFixture<UserManagementComponent>;
  let userServiceSpy: jasmine.SpyObj<UserManagementService>;
  let dialogServiceSpy: jasmine.SpyObj<TuiDialogService>;
  let alertServiceSpy: jasmine.SpyObj<TuiAlertService>;

  beforeEach(async () => {
    userServiceSpy = jasmine.createSpyObj('UserManagementService', [
      'findAllUsers',
      'createUser',
      'updateUser',
      'deleteUser',
    ]);
    dialogServiceSpy = jasmine.createSpyObj('TuiDialogService', ['open']);
    alertServiceSpy = jasmine.createSpyObj('TuiAlertService', ['open']);

    // Default: findAllUsers returns the mock list
    userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));
    // Default: dialog open returns empty subject (no completion)
    dialogServiceSpy.open.and.returnValue(new Subject<any>());
    // Default: alert open returns empty observable
    alertServiceSpy.open.and.returnValue(of(undefined) as any);

    await TestBed.configureTestingModule({
      imports: [UserManagementComponent],
      providers: [
        provideAnimations(),
        { provide: UserManagementService, useValue: userServiceSpy },
        { provide: TuiDialogService, useValue: dialogServiceSpy },
        { provide: TuiAlertService, useValue: alertServiceSpy },
        { provide: WA_WINDOW, useValue: mockWindow },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // Keep only DatePipe; strip Taiga UI and FormsModule so NO_ERRORS_SCHEMA
      // suppresses unknown-element/directive/control-accessor errors.
      .overrideComponent(UserManagementComponent, {
        set: { imports: [DatePipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserManagementComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ─── Initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should initialize filterName signal to empty string', () => {
      expect((component as any).filterName()).toBe('');
    });

    it('should initialize filterEmail signal to empty string', () => {
      expect((component as any).filterEmail()).toBe('');
    });

    it('should initialize filterPhone signal to empty string', () => {
      expect((component as any).filterPhone()).toBe('');
    });

    it('should initialize filterPid signal to empty string', () => {
      expect((component as any).filterPid()).toBe('');
    });

    it('should initialize filterRole signal to null', () => {
      expect((component as any).filterRole()).toBeNull();
    });

    it('should expose all UserType values as roleOptions', () => {
      expect((component as any).roleOptions).toEqual(Object.values(UserType));
    });
  });

  // ─── ngOnInit / loadUsers ──────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('should call findAllUsers on init and populate users signal', fakeAsync(() => {
      fixture.detectChanges(); // triggers ngOnInit
      tick();

      expect(userServiceSpy.findAllUsers).toHaveBeenCalledWith({});
      expect((component as any).users()).toEqual(mockUsers);
    }));

    it('should set isLoading to false after successful load', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      expect((component as any).isLoading()).toBeFalse();
    }));

    it('should set isLoading to false even when findAllUsers errors', fakeAsync(() => {
      userServiceSpy.findAllUsers.and.returnValue(throwError(() => new Error('network error')));

      fixture.detectChanges();
      tick();

      expect((component as any).isLoading()).toBeFalse();
    }));
  });

  // ─── applyFilters ──────────────────────────────────────────────────────────

  describe('applyFilters', () => {
    beforeEach(() => {
      // Initialise the component so it's in a stable state before each test
      fixture.detectChanges();
    });

    it('should call findAllUsers with an empty filter when all signals are empty', fakeAsync(() => {
      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));

      (component as any).applyFilters();
      tick();

      expect(userServiceSpy.findAllUsers).toHaveBeenCalledWith({});
    }));

    it('should include name in the filter when filterName signal has a value', fakeAsync(() => {
      (component as any).filterName.set('John');
      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));

      (component as any).applyFilters();
      tick();

      const calledWith = userServiceSpy.findAllUsers.calls.mostRecent().args[0] as FilterUsersDto;
      expect(calledWith.name).toBe('John');
    }));

    it('should include email in the filter when filterEmail signal has a value', fakeAsync(() => {
      (component as any).filterEmail.set('john@example.com');
      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));

      (component as any).applyFilters();
      tick();

      const calledWith = userServiceSpy.findAllUsers.calls.mostRecent().args[0] as FilterUsersDto;
      expect(calledWith.email).toBe('john@example.com');
    }));

    it('should include phone in the filter when filterPhone signal has a value', fakeAsync(() => {
      (component as any).filterPhone.set('555');
      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));

      (component as any).applyFilters();
      tick();

      const calledWith = userServiceSpy.findAllUsers.calls.mostRecent().args[0] as FilterUsersDto;
      expect(calledWith.phone).toBe('555');
    }));

    it('should include pid in the filter when filterPid signal has a value', fakeAsync(() => {
      (component as any).filterPid.set('PID001');
      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));

      (component as any).applyFilters();
      tick();

      const calledWith = userServiceSpy.findAllUsers.calls.mostRecent().args[0] as FilterUsersDto;
      expect(calledWith.pid).toBe('PID001');
    }));

    it('should include userType as a single-element array when filterRole is set', fakeAsync(() => {
      (component as any).filterRole.set(UserType.ADMIN);
      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));

      (component as any).applyFilters();
      tick();

      const calledWith = userServiceSpy.findAllUsers.calls.mostRecent().args[0] as FilterUsersDto;
      expect(calledWith.userType).toEqual([UserType.ADMIN]);
    }));

    it('should not include userType when filterRole is null', fakeAsync(() => {
      (component as any).filterRole.set(null);
      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));

      (component as any).applyFilters();
      tick();

      const calledWith = userServiceSpy.findAllUsers.calls.mostRecent().args[0] as FilterUsersDto;
      expect(calledWith.userType).toBeUndefined();
    }));

    it('should build a combined filter when multiple signals have values', fakeAsync(() => {
      (component as any).filterName.set('John');
      (component as any).filterEmail.set('john@example.com');
      (component as any).filterPhone.set('555');
      (component as any).filterPid.set('PID001');
      (component as any).filterRole.set(UserType.USER);

      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));

      (component as any).applyFilters();
      tick();

      const calledWith = userServiceSpy.findAllUsers.calls.mostRecent().args[0] as FilterUsersDto;

      expect(calledWith).toEqual({
        name: 'John',
        email: 'john@example.com',
        phone: '555',
        pid: 'PID001',
        userType: [UserType.USER],
      });
    }));

    it('should trim whitespace from string filter values', fakeAsync(() => {
      (component as any).filterName.set('  John  ');
      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));

      (component as any).applyFilters();
      tick();

      const calledWith = userServiceSpy.findAllUsers.calls.mostRecent().args[0] as FilterUsersDto;
      expect(calledWith.name).toBe('John');
    }));

    it('should not include a field when its trimmed value is empty', fakeAsync(() => {
      (component as any).filterName.set('   ');
      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));

      (component as any).applyFilters();
      tick();

      const calledWith = userServiceSpy.findAllUsers.calls.mostRecent().args[0] as FilterUsersDto;
      expect(calledWith.name).toBeUndefined();
    }));

    it('should update the users signal after a successful filtered load', fakeAsync(() => {
      const filteredUsers = [mockUsers[0]];
      (component as any).filterName.set('John');
      userServiceSpy.findAllUsers.and.returnValue(of(filteredUsers));

      (component as any).applyFilters();
      tick();

      expect((component as any).users()).toEqual(filteredUsers);
    }));
  });

  // ─── clearFilters ──────────────────────────────────────────────────────────

  describe('clearFilters', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should reset filterName to empty string', fakeAsync(() => {
      (component as any).filterName.set('John');

      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));
      (component as any).clearFilters();
      tick();

      expect((component as any).filterName()).toBe('');
    }));

    it('should reset filterEmail to empty string', fakeAsync(() => {
      (component as any).filterEmail.set('john@example.com');

      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));
      (component as any).clearFilters();
      tick();

      expect((component as any).filterEmail()).toBe('');
    }));

    it('should reset filterPhone to empty string', fakeAsync(() => {
      (component as any).filterPhone.set('555');

      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));
      (component as any).clearFilters();
      tick();

      expect((component as any).filterPhone()).toBe('');
    }));

    it('should reset filterPid to empty string', fakeAsync(() => {
      (component as any).filterPid.set('PID001');

      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));
      (component as any).clearFilters();
      tick();

      expect((component as any).filterPid()).toBe('');
    }));

    it('should reset filterRole to null', fakeAsync(() => {
      (component as any).filterRole.set(UserType.ADMIN);

      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));
      (component as any).clearFilters();
      tick();

      expect((component as any).filterRole()).toBeNull();
    }));

    it('should reload users after resetting all filters', fakeAsync(() => {
      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));

      (component as any).clearFilters();
      tick();

      expect(userServiceSpy.findAllUsers).toHaveBeenCalledWith({});
      expect((component as any).users()).toEqual(mockUsers);
    }));
  });

  // ─── isMobile ─────────────────────────────────────────────────────────────

  describe('isMobile signal', () => {
    afterEach(() => {
      // Ensure innerWidth is restored after each test in this describe
      mockInnerWidth = 1024;
    });

    it('should be false when window.innerWidth is 1024', () => {
      mockInnerWidth = 1024;
      const desktopFixture = TestBed.createComponent(UserManagementComponent);
      expect((desktopFixture.componentInstance as any).isMobile()).toBeFalse();
    });

    it('should be true when window.innerWidth is 375 (mobile)', () => {
      mockInnerWidth = 375;
      const mobileFixture = TestBed.createComponent(UserManagementComponent);
      expect((mobileFixture.componentInstance as any).isMobile()).toBeTrue();
    });
  });

  // ─── Helper methods ────────────────────────────────────────────────────────

  describe('getFullName', () => {
    beforeEach(() => fixture.detectChanges());

    it('should return full name when both firstName and lastName exist', () => {
      const result = (component as any).getFullName(mockUsers[0]);
      expect(result).toBe('John Doe');
    });

    it('should return just firstName when lastName is missing', () => {
      const user: User = { ...mockUsers[0], lastName: undefined };
      expect((component as any).getFullName(user)).toBe('John');
    });

    it('should return em dash when neither firstName nor lastName is set', () => {
      const user: User = { ...mockUsers[0], firstName: undefined, lastName: undefined };
      expect((component as any).getFullName(user)).toBe('—');
    });
  });

  describe('getInitials', () => {
    beforeEach(() => fixture.detectChanges());

    it('should return initials from firstName and lastName', () => {
      expect((component as any).getInitials(mockUsers[0])).toBe('JD');
    });

    it('should fall back to first letter of email when no name exists', () => {
      const user: User = {
        ...mockUsers[0],
        firstName: undefined,
        lastName: undefined,
      };
      expect((component as any).getInitials(user)).toBe('J');
    });

    it('should use first letter of email uppercased as fallback', () => {
      const user: User = {
        _id: 'u3',
        email: 'alice@example.com',
        userType: [UserType.USER],
        phone: '5550000',
        firstName: undefined,
        lastName: undefined,
      };
      expect((component as any).getInitials(user)).toBe('A');
    });
  });

  describe('getUserTypeLabel', () => {
    beforeEach(() => fixture.detectChanges());

    it('should capitalise and join multiple user type values', () => {
      const result = (component as any).getUserTypeLabel([UserType.ADMIN, UserType.USER]);
      expect(result).toBe('Admin, User');
    });

    it('should return a single type capitalised', () => {
      expect((component as any).getUserTypeLabel([UserType.SUPERADMIN])).toBe('Superadmin');
    });

    it('should return em dash for null/undefined input', () => {
      expect((component as any).getUserTypeLabel(null as any)).toBe('—');
    });
  });

  // ─── deleteUser ───────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    beforeEach(() => fixture.detectChanges());

    it('should do nothing when the user has no _id', () => {
      const userWithoutId: User = { ...mockUsers[0], _id: undefined };
      (component as any).deleteUser(userWithoutId);
      expect(dialogServiceSpy.open).not.toHaveBeenCalled();
    });

    it('should open a confirmation dialog when the user has an _id', () => {
      dialogServiceSpy.open.and.returnValue(of(false) as any);
      (component as any).deleteUser(mockUsers[0]);
      expect(dialogServiceSpy.open).toHaveBeenCalled();
    });

    it('should call deleteUser on the service and remove user from list when confirmed', fakeAsync(() => {
      userServiceSpy.deleteUser.and.returnValue(of(undefined));
      alertServiceSpy.open.and.returnValue(of(undefined) as any);

      // Populate users first
      (component as any).users.set([...mockUsers]);

      // Return true from the confirm dialog
      dialogServiceSpy.open.and.returnValue(of(true) as any);

      (component as any).deleteUser(mockUsers[0]);
      tick();

      expect(userServiceSpy.deleteUser).toHaveBeenCalledWith('user-id-1');
      const remainingUsers: User[] = (component as any).users();
      expect(remainingUsers.find((u: User) => u._id === 'user-id-1')).toBeUndefined();
    }));

    it('should not call deleteUser on the service when the dialog is dismissed (false)', fakeAsync(() => {
      dialogServiceSpy.open.and.returnValue(of(false) as any);

      (component as any).deleteUser(mockUsers[0]);
      tick();

      expect(userServiceSpy.deleteUser).not.toHaveBeenCalled();
    }));
  });

  // ─── addUser / editUser ───────────────────────────────────────────────────

  describe('addUser', () => {
    beforeEach(() => fixture.detectChanges());

    it('should open a dialog', () => {
      dialogServiceSpy.open.and.returnValue(of(null) as any);
      (component as any).addUser();
      expect(dialogServiceSpy.open).toHaveBeenCalled();
    });

    it('should reload users when the dialog returns a user', fakeAsync(() => {
      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));
      dialogServiceSpy.open.and.returnValue(of(mockUsers[0]) as any);

      (component as any).addUser();
      tick();

      expect(userServiceSpy.findAllUsers).toHaveBeenCalled();
    }));

    it('should not reload users when the dialog returns null', fakeAsync(() => {
      userServiceSpy.findAllUsers.calls.reset();
      dialogServiceSpy.open.and.returnValue(of(null) as any);

      (component as any).addUser();
      tick();

      expect(userServiceSpy.findAllUsers).not.toHaveBeenCalled();
    }));
  });

  describe('editUser', () => {
    beforeEach(() => fixture.detectChanges());

    it('should open a dialog with the user data', () => {
      dialogServiceSpy.open.and.returnValue(of(null) as any);
      (component as any).editUser(mockUsers[0]);
      expect(dialogServiceSpy.open).toHaveBeenCalled();
    });

    it('should reload users when the dialog returns an updated user', fakeAsync(() => {
      userServiceSpy.findAllUsers.calls.reset();
      userServiceSpy.findAllUsers.and.returnValue(of(mockUsers));
      dialogServiceSpy.open.and.returnValue(of(mockUsers[0]) as any);

      (component as any).editUser(mockUsers[0]);
      tick();

      expect(userServiceSpy.findAllUsers).toHaveBeenCalled();
    }));
  });
});
