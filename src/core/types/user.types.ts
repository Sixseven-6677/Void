/**
 * @file user.types.ts
 * @description Domain types for the User entity.
 *
 * RULE: These are pure data shapes — no methods, no business logic.
 * RULE: No Facebook-specific fields. User is a domain concept,
 *       not a Facebook API response.
 */

import type { ISOTimestamp, UserId } from './common.types.js';

// ─── User Role ────────────────────────────────────────────────────────────────

/** Permission tier of a user within the system. */
export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN' | 'OWNER';

// ─── User Status ──────────────────────────────────────────────────────────────

/** Current state of a user account. */
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

// ─── User ─────────────────────────────────────────────────────────────────────

/**
 * Core user entity.
 * Represents a person who has interacted with the bot.
 */
export interface User {
  /** System-assigned unique identifier. */
  readonly id: UserId;

  /**
   * Facebook Page-Scoped ID (PSID) for this user.
   * This is the identifier Facebook sends in Webhook events.
   * Stored here to map Facebook events → domain User.
   */
  readonly facebookPsid: string;

  /** Display name retrieved from Facebook profile, may be absent. */
  readonly displayName: string | null;

  /** User's permission level within the system. */
  readonly role: UserRole;

  /** Current account status. */
  readonly status: UserStatus;

  /** Timestamp of first interaction. */
  readonly createdAt: ISOTimestamp;

  /** Timestamp of last update to this record. */
  readonly updatedAt: ISOTimestamp;

  /** Timestamp of the most recent interaction, if any. */
  readonly lastSeenAt: ISOTimestamp | null;
}

// ─── User Profile (from Facebook) ────────────────────────────────────────────

/**
 * Lightweight profile data fetched from Facebook Graph API.
 * This is a Facebook Layer concern — returned via IFacebookClient.getUserProfile().
 * Stored in User.displayName after fetch.
 */
export interface FacebookUserProfile {
  readonly psid: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Fields that may be updated on an existing User record. */
export interface UserUpdate {
  readonly displayName?: string | null;
  readonly role?: UserRole;
  readonly status?: UserStatus;
  readonly lastSeenAt?: ISOTimestamp;
}

/** Fields required to create a new User record. */
export interface CreateUserInput {
  readonly facebookPsid: string;
  readonly displayName?: string | null;
  readonly role?: UserRole;
}
