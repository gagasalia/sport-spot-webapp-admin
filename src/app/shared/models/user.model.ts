export enum UserType {
  ADMIN = 'admin',
  USER = 'user',
  SUPERADMIN = 'superadmin',
}

export interface User {
  _id?: string;
  email: string;
  userType: UserType[];
  firstName?: string;
  lastName?: string;
  pid?: string;
  phone: string;
  dateOfBirth?: string;
  tenants?: string[];
}

export interface CreateUserDto {
  email: string;
  password: string;
  userType: UserType[];
  firstName?: string;
  lastName?: string;
  pid?: string;
  phone: string;
  dateOfBirth?: string;
  tenants?: string[];
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  userType?: UserType[];
  firstName?: string;
  lastName?: string;
  pid?: string;
  phone?: string;
  dateOfBirth?: string;
  tenants?: string[];
}
