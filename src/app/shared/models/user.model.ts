export enum UserType {
  ADMIN = 'admin',
  USER = 'user',
  SUPERADMIN = 'superadmin',
}

export interface User {
  _id?: string;
  /** Public numeric member ID (0-based, incremental) — the filterable "ID". */
  memberId?: number;
  /**
   * Absent on phone-only players; a Google player's email comes from the
   * Google account (docs/29). A Facebook player (docs/30) may have none.
   */
  email?: string;
  userType: UserType[];
  firstName?: string;
  lastName?: string;
  pid?: string;
  /**
   * Player login identifier — absent on admin accounts, and on an
   * external-only (Google docs/29 / Facebook docs/30) player until they add one.
   */
  phone?: string;
  /** True when the player can sign in with Google (docs/29). */
  googleLinked?: boolean;
  /**
   * Raw Google subject — only present while /um/find serves the raw user
   * document. Read solely as a "linked" signal (isGoogleLinked); never shown.
   */
  googleId?: string;
  /** True when the player can sign in with Facebook (docs/30). */
  facebookLinked?: boolean;
  /**
   * Raw Graph API user id — only present while /um/find serves the raw user
   * document. Read solely as a "linked" signal (isFacebookLinked); never shown.
   */
  facebookId?: string;
  /** Admin login identifier (lowercased) — absent on player accounts. */
  username?: string;
  /** Profile picture (set by players in the player app). */
  avatarUrl?: string;
  dateOfBirth?: string;
  academies?: string[];
}

export interface CreateUserDto {
  email: string;
  password: string;
  userType: UserType[];
  firstName?: string;
  lastName?: string;
  pid?: string;
  /** Required for player accounts; must be absent for admin accounts. */
  phone?: string;
  /** Required for admin accounts; must be absent for player accounts. */
  username?: string;
  dateOfBirth?: string;
  academies?: string[];
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  userType?: UserType[];
  firstName?: string;
  lastName?: string;
  pid?: string;
  phone?: string;
  username?: string;
  dateOfBirth?: string;
  academies?: string[];
}

export interface FilterUsersDto {
  name?: string;
  email?: string;
  phone?: string;
  pid?: string;
  /** Exact public member ID (server strips leading zeros via Number coercion). */
  memberId?: number;
  userType?: UserType[];
  page?: number;
  limit?: number;
}
