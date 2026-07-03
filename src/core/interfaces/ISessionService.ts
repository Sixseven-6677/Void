/**
 * @file ISessionService.ts
 * @description Business logic contract for Conversation Session management.
 *
 * RULE: ISessionService is the ONLY component that may make decisions about
 *       session lifecycle — creation, expiry, invalidation, refresh.
 * RULE: Services are the single authority for business rules.
 *       SessionManager coordinates lifecycle — SessionService decides rules.
 *
 * @see 15-service-rules.md
 */

import type {
  Session,
  CreateSessionInput,
  SessionData,
} from '../types/session.types.js';
import type { ConversationId, Result, SessionId, UserId } from '../types/common.types.js';

// ─── ISessionService ──────────────────────────────────────────────────────────

/**
 * Business logic for session lifecycle management.
 *
 * Implementations use ISessionRepository for persistence and
 * ICacheClient for cache-aside acceleration — both injected via DI.
 */
export interface ISessionService {
  /**
   * Retrieve a session by its ID.
   * Returns null if the session does not exist or has expired.
   */
  getById(id: SessionId): Promise<Session | null>;

  /**
   * Get or create the active session for a conversation.
   *
   * - If an active session exists: returns it and refreshes its expiry.
   * - If no active session exists: creates a new one.
   *
   * This is the primary entry point called from the Middleware Pipeline
   * at the start of each request.
   */
  getOrCreateForConversation(
    userId: UserId,
    conversationId: ConversationId,
  ): Promise<Session>;

  /**
   * Create a new session.
   * If an active session already exists for this conversation, it is
   * invalidated before the new one is created.
   */
  create(input: CreateSessionInput): Promise<Session>;

  /**
   * Advance the session to a new step in the current flow.
   * Returns the updated session, or an error if the transition is invalid.
   */
  advanceStep(
    id: SessionId,
    newStep: string,
  ): Promise<Result<Session>>;

  /**
   * Merge additional data into the session's data store.
   * Existing keys are overwritten with new values.
   */
  updateData(
    id: SessionId,
    data: Partial<SessionData>,
  ): Promise<Result<Session>>;

  /**
   * Invalidate a session, ending the conversation flow.
   * Emits a `system.session.invalidated` event.
   */
  invalidate(id: SessionId): Promise<boolean>;

  /**
   * Reset a session to a clean state without invalidating it.
   * Clears step and data, refreshes expiry.
   */
  reset(id: SessionId): Promise<Result<Session>>;
}
