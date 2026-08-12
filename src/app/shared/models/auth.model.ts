import { User } from './user.model';

/**
 * Decoded payload of the access token issued by `POST /auth/login`.
 * Mirrors the backend JWT claims.
 */
export interface JwtPayload {
  sub: string;
  phone: string;
  userType: string[];
  academies: string[];
  iat?: number;
  exp?: number;
}

/** Body sent to `POST /auth/login`. */
export interface LoginDto {
  phone: string;
  password: string;
}

/** `result.data` returned by `POST /auth/login`. */
export interface LoginResponse {
  accessToken: string;
  user: User;
}

/**
 * Thrown by `AuthService.login` when the credentials are valid but the account
 * has no admin/superadmin role. `/auth/login` is shared with the player webapp,
 * so a player authenticates fine — but every admin endpoint would 403. The
 * admin panel rejects such a session before the token is ever persisted.
 */
export class NonAdminLoginError extends Error {
  constructor() {
    super('Only administrator accounts can sign in');
    this.name = 'NonAdminLoginError';
  }
}
