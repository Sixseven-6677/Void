/**
 * @file ISessionRepository.ts
 * @description Storage contract for Conversation Sessions.
 *
 * RULE: Repositories only store and retrieve — they contain NO business logic.
 * RULE: Cache-Aside pattern is the Service's responsibility, not the Repository's.
 * RULE: The Repository must not know about the Cache layer.
 *
 * @see 17-database-policy.md
 */

import type {
  Session,
  CreateSessionInput,
  SessionUpdate,
} from '../types/session.types.js';
import type { ConversationId, SessionId, UserId } from '../types/common.types.js';

// ─── ISessionRepository ───────────────────────────────────────────────────────

/**
 * Persistent storage contract for Session entities.
 *
 * All methods may throw InfrastructureError on storage failure.
 * Methods return null instead of throwing when an entity is not found.
 */
export interface ISessionRepository {
  /**
   * Find a session by its unique ID.
   * Returns null if the session does not exist.
   */
  findById(id: SessionId): Promise<Session | null>;

  /**
   * Find the active session for a given conversation.
   * Returns null if no active session exists for this conversation.
   */
  findActiveByConversationId(conversationId: ConversationId): Promise<Session | null>;

  /**
   * Find all sessions belonging to a user.
   * Returns an empty array if the user has no sessions.
   */
  findAllByUserId(userId: UserId): Promise<readonly Session[]>;

  /**
   * Persist a new session.
   * Returns the created session with all generated fields populated.
   */
  create(input: CreateSessionInput): Promise<Session>;

  /**
   * Apply a partial update to an existing session.
   * Returns the updated session, or null if the session was not found.
   */
  update(id: SessionId, update: SessionUpdate): Promise<Session | null>;

  /**
   * Mark a session as invalidated.
   * Returns true if the session was found and invalidated, false otherwise.
   */
  invalidate(id: SessionId): Promise<boolean>;

  /**
   * Remove all sessions that have passed their expiry time.
   * Returns the number of sessions removed.
   * Intended for use by the Scheduler — not for direct call from Services.
   */
  deleteExpired(): Promise<number>;
}
