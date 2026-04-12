import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { UserManagementService } from './user-management.service';
import {
  User,
  UserType,
  CreateUserDto,
  UpdateUserDto,
  FilterUsersDto,
} from '../../shared/models/user.model';
import { environment } from '../../../environments/environment';

// ─── Test data ───────────────────────────────────────────────────────────────

const mockUser: User = {
  _id: 'user-id-1',
  email: 'john@example.com',
  userType: [UserType.USER],
  firstName: 'John',
  lastName: 'Doe',
  phone: '5551234',
};

function wrapInApiResponse<T>(data: T) {
  return { result: { data } };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('UserManagementService', () => {
  let service: UserManagementService;
  let httpMock: HttpTestingController;

  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UserManagementService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(UserManagementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ─── findAllUsers ──────────────────────────────────────────────────────────

  describe('findAllUsers', () => {
    it('should POST to the correct URL with an empty body when no filters are passed', () => {
      service.findAllUsers().subscribe();

      const req = httpMock.expectOne(`${base}/um/find`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(wrapInApiResponse([]));
    });

    it('should POST to the correct URL with an explicit empty object body', () => {
      service.findAllUsers({}).subscribe();

      const req = httpMock.expectOne(`${base}/um/find`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(wrapInApiResponse([]));
    });

    it('should POST with the provided filter body', () => {
      const filters: FilterUsersDto = { name: 'John', email: 'john@example.com' };

      service.findAllUsers(filters).subscribe();

      const req = httpMock.expectOne(`${base}/um/find`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'John', email: 'john@example.com' });
      req.flush(wrapInApiResponse([]));
    });

    it('should POST with phone filter', () => {
      service.findAllUsers({ phone: '555' }).subscribe();

      const req = httpMock.expectOne(`${base}/um/find`);
      expect(req.request.body).toEqual({ phone: '555' });
      req.flush(wrapInApiResponse([]));
    });

    it('should POST with pid filter', () => {
      service.findAllUsers({ pid: 'PID001' }).subscribe();

      const req = httpMock.expectOne(`${base}/um/find`);
      expect(req.request.body).toEqual({ pid: 'PID001' });
      req.flush(wrapInApiResponse([]));
    });

    it('should POST with userType filter', () => {
      service.findAllUsers({ userType: [UserType.ADMIN] }).subscribe();

      const req = httpMock.expectOne(`${base}/um/find`);
      expect(req.request.body).toEqual({ userType: [UserType.ADMIN] });
      req.flush(wrapInApiResponse([]));
    });

    it('should POST with page and limit filters', () => {
      service.findAllUsers({ page: 2, limit: 25 }).subscribe();

      const req = httpMock.expectOne(`${base}/um/find`);
      expect(req.request.body).toEqual({ page: 2, limit: 25 });
      req.flush(wrapInApiResponse([]));
    });

    it('should map the response through res.result.data and return the user array', () => {
      const users: User[] = [mockUser];
      let emittedUsers: User[] | undefined;

      service.findAllUsers().subscribe((data) => {
        emittedUsers = data;
      });

      const req = httpMock.expectOne(`${base}/um/find`);
      req.flush(wrapInApiResponse(users));

      expect(emittedUsers).toEqual(users);
    });

    it('should return an empty array when the API returns no users', () => {
      let emittedUsers: User[] | undefined;

      service.findAllUsers().subscribe((data) => {
        emittedUsers = data;
      });

      httpMock.expectOne(`${base}/um/find`).flush(wrapInApiResponse([]));

      expect(emittedUsers).toEqual([]);
    });
  });

  // ─── createUser ───────────────────────────────────────────────────────────

  describe('createUser', () => {
    it('should POST to the correct URL with the user dto', () => {
      const dto: CreateUserDto = {
        email: 'new@example.com',
        password: 'secret',
        userType: [UserType.USER],
        phone: '5550000',
      };

      service.createUser(dto).subscribe();

      const req = httpMock.expectOne(`${base}/um/create`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(wrapInApiResponse(mockUser));
    });

    it('should map the response through res.result.data and return the created user', () => {
      let createdUser: User | undefined;

      service
        .createUser({
          email: 'new@example.com',
          password: 'secret',
          userType: [UserType.USER],
          phone: '5550000',
        })
        .subscribe((u) => {
          createdUser = u;
        });

      httpMock.expectOne(`${base}/um/create`).flush(wrapInApiResponse(mockUser));

      expect(createdUser).toEqual(mockUser);
    });
  });

  // ─── findUserById ─────────────────────────────────────────────────────────

  describe('findUserById', () => {
    it('should GET from the correct URL with the user id', () => {
      service.findUserById('user-id-1').subscribe();

      const req = httpMock.expectOne(`${base}/um/user-id-1`);
      expect(req.request.method).toBe('GET');
      req.flush(wrapInApiResponse(mockUser));
    });

    it('should map the response through res.result.data and return the user', () => {
      let foundUser: User | undefined;

      service.findUserById('user-id-1').subscribe((u) => {
        foundUser = u;
      });

      httpMock.expectOne(`${base}/um/user-id-1`).flush(wrapInApiResponse(mockUser));

      expect(foundUser).toEqual(mockUser);
    });
  });

  // ─── updateUser ───────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('should PATCH to the correct URL with the update dto', () => {
      const updateDto: UpdateUserDto = { firstName: 'Jane' };

      service.updateUser('user-id-1', updateDto).subscribe();

      const req = httpMock.expectOne(`${base}/um/user-id-1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateDto);
      req.flush(wrapInApiResponse({ ...mockUser, firstName: 'Jane' }));
    });

    it('should map the response through res.result.data and return the updated user', () => {
      const updated: User = { ...mockUser, firstName: 'Jane' };
      let updatedUser: User | undefined;

      service.updateUser('user-id-1', { firstName: 'Jane' }).subscribe((u) => {
        updatedUser = u;
      });

      httpMock.expectOne(`${base}/um/user-id-1`).flush(wrapInApiResponse(updated));

      expect(updatedUser).toEqual(updated);
    });
  });

  // ─── deleteUser ───────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('should DELETE the correct URL', () => {
      service.deleteUser('user-id-1').subscribe();

      const req = httpMock.expectOne(`${base}/um/user-id-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should complete without emitting a value on success', () => {
      let completed = false;

      service.deleteUser('user-id-1').subscribe({
        complete: () => {
          completed = true;
        },
      });

      httpMock.expectOne(`${base}/um/user-id-1`).flush(null);

      expect(completed).toBeTrue();
    });
  });
});
