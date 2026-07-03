/**
 * @file IUserService.ts
 * @description Business logic contract for User management.
 *
 * RULE: IUserService is the ONLY component that may make decisions about
 *       user state — creation, suspension, role changes.
 * RULE: No other layer accesses IUserRepository directly.
 *       All user access passes through IUserService.
 *
 * @see 15-service-rules.md
 */

import type { User, CreateUserInput, UserRole, UserStatus } from '../types/user.types.js';
import type { PaginatedResult, PaginationOptions, Result, UserId } from '../types/common.types.js';

// ─── IUserService ─────────────────────────────────────────────────────────────

/**
 * Business logic for User lifecycle management.
 *
 * Implementations use IUserRepository for persistence and
 * ICacheClient for cache-aside acceleration — both injected via DI.
 */
export interface IUserService {
  /**
   * Find a user by their system ID.
   * Returns null if not found.
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Find a user by their Facebook PSID.
   * Returns null if not found.
   */
  findByFacebookPsid(psid: string): Promise<User | null>;

  /**
   * Find or create a user for an inbound Facebook PSID.
   *
   * This is the primary entry point during webhook processing:
   * - If the user exists: returns the existing record.
   * - If the user does not exist: creates a new user, optionally fetching
   *   their public Facebook profile to populate displayName.
   */
  findOrCreate(psid: string): Promise<User>;

  /**
   * Create a new user.
   * Returns an error result if a user with the given PSID already exists.
   */
  create(input: CreateUserInput): Promise<Result<User>>;

  /**
   * List all users with pagination.
   */
  listAll(options: PaginationOptions): Promise<PaginatedResult<User>>;

  /**
   * Update a user's role.
   * Business rule: only OWNER may assign OWNER role.
   */
  updateRole(
    targetId: UserId,
    newRole: UserRole,
    actorId: UserId,
  ): Promise<Result<User>>;

  /**
   * Update a user's account status (e.g. suspend or ban).
   * Business rule: system records an audit log entry for every status change.
   */
  updateStatus(
    targetId: UserId,
    newStatus: UserStatus,
    actorId: UserId,
    reason?: string,
  ): Promise<Result<User>>;

  /**
   * Record that the user was seen now — updates lastSeenAt.
   * Best-effort: failures are logged but not thrown.
   */
  recordActivity(id: UserId): Promise<void>;
}
