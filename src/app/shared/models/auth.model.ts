import { User } from './user.model';

/**
 * Decoded payload of the access token issued by `POST /auth/login`.
 * Mirrors the backend JWT claims.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  userType: string[];
  academies: string[];
  iat?: number;
  exp?: number;
}

/** Body sent to `POST /auth/login`. */
export interface LoginDto {
  email: string;
  password: string;
}

/** `result.data` returned by `POST /auth/login`. */
export interface LoginResponse {
  accessToken: string;
  user: User;
}
