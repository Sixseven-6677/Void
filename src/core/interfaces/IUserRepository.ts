/**
 * @file IUserRepository.ts
 * @description Storage contract for User entities.
 *
 * RULE: Repositories contain NO business logic — only store/retrieve.
 * RULE: The Repository does not apply cache — that is the Service's concern.
 *
 * @see 17-database-policy.md
 */

import type { User, CreateUserInput, UserUpdate } from '../types/user.types.js';
import type { PaginatedResult, PaginationOptions, UserId } from '../types/common.types.js';

// ─── IUserRepository ──────────────────────────────────────────────────────────

/**
 * Persistent storage contract for User entities.
 *
 * All methods may throw InfrastructureError on storage failure.
 * Methods return null instead of throwing when an entity is not found.
 */
export interface IUserRepository {
  /**
   * Find a user by their system-assigned ID.
   * Returns null if not found.
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Find a user by their Facebook Page-Scoped ID (PSID).
   * Returns null if not found.
   * Primary lookup path for inbound webhook events.
   */
  findByFacebookPsid(psid: string): Promise<User | null>;

  /**
   * Retrieve a paginated list of all users.
   */
  findAll(options: PaginationOptions): Promise<PaginatedResult<User>>;

  /**
   * Persist a new user record.
   * Returns the created user with all generated fields populated.
   */
  create(input: CreateUserInput): Promise<User>;

  /**
   * Apply a partial update to an existing user.
   * Returns the updated user, or null if the user was not found.
   */
  update(id: UserId, update: UserUpdate): Promise<User | null>;

  /**
   * Check whether a user with the given PSID already exists.
   */
  existsByFacebookPsid(psid: string): Promise<boolean>;
}
