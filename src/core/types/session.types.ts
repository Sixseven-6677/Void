/**
 * @file session.types.ts
 * @description Domain types for Conversation Session management.
 *
 * In Void, a "session" represents the stateful context of an ongoing
 * conversation between a user and the bot. It tracks step, flow, and
 * temporary data for the duration of an interaction window.
 *
 * RULE: Session state is a domain concept — not an HTTP session.
 * RULE: Sessions must be encrypted at rest (per 11-session-management.md).
 */

import type { ConversationId, ISOTimestamp, SessionId, UserId } from './common.types.js';

// ─── Session Status ───────────────────────────────────────────────────────────

/** Lifecycle state of a conversation session. */
export type SessionStatus = 'ACTIVE' | 'EXPIRED' | 'INVALIDATED';

// ─── Session Data ─────────────────────────────────────────────────────────────

/**
 * Arbitrary key-value store attached to a session for tracking
 * conversation state (e.g. current flow step, collected inputs).
 *
 * RULE: Must never contain secrets, tokens, or passwords.
 * RULE: Values must be JSON-serializable.
 */
export type SessionData = Readonly<Record<string, unknown>>;

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * Conversation session entity.
 * One session per active conversation thread between a user and the bot.
 */
export interface Session {
  /** Unique session identifier. */
  readonly id: SessionId;

  /** The user this session belongs to. */
  readonly userId: UserId;

  /** Facebook conversation identifier (thread ID). */
  readonly conversationId: ConversationId;

  /** Current lifecycle state. */
  readonly status: SessionStatus;

  /** Current flow step the user is in, if any. */
  readonly currentStep: string | null;

  /** Conversation context accumulated during this session. */
  readonly data: SessionData;

  /** When this session was created. */
  readonly createdAt: ISOTimestamp;

  /** When this session was last accessed or modified. */
  readonly updatedAt: ISOTimestamp;

  /** When this session will automatically expire. */
  readonly expiresAt: ISOTimestamp;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Input to create a new session. */
export interface CreateSessionInput {
  readonly userId: UserId;
  readonly conversationId: ConversationId;
  readonly ttlSeconds?: number;
}

/** Fields that may be updated on an existing session. */
export interface SessionUpdate {
  readonly currentStep?: string | null;
  readonly data?: SessionData;
  readonly expiresAt?: ISOTimestamp;
}
