/**
 * @file common.types.ts
 * @description Shared primitive types and utilities used across all layers.
 *
 * RULE: No business logic lives here — only type definitions.
 * RULE: Every ID type is a branded string to prevent accidental misuse
 *       (e.g. passing a UserId where a SessionId is expected).
 */

// ─── Branded IDs ──────────────────────────────────────────────────────────────

/** Branded string to prevent raw string misuse as a UserId. */
export type UserId = string & { readonly __brand: 'UserId' };

/** Branded string to prevent raw string misuse as a SessionId. */
export type SessionId = string & { readonly __brand: 'SessionId' };

/** Branded string to prevent raw string misuse as a MessageId. */
export type MessageId = string & { readonly __brand: 'MessageId' };

/** Branded string to prevent raw string misuse as a ConversationId. */
export type ConversationId = string & { readonly __brand: 'ConversationId' };

/** Branded string to prevent raw string misuse as a PluginId. */
export type PluginId = string & { readonly __brand: 'PluginId' };

/** Branded string to prevent raw string misuse as a CommandName. */
export type CommandName = string & { readonly __brand: 'CommandName' };

/** Branded string to prevent raw string misuse as a JobId. */
export type JobId = string & { readonly __brand: 'JobId' };

/** Branded string to prevent raw string misuse as a CorrelationId. */
export type CorrelationId = string & { readonly __brand: 'CorrelationId' };

// ─── Constructor helpers (cast, not validate) ─────────────────────────────────
// Why: these helpers make intent explicit at construction sites without adding
//      runtime overhead. Validation happens at the boundary — not here.

export const asUserId = (id: string): UserId => id as UserId;
export const asSessionId = (id: string): SessionId => id as SessionId;
export const asMessageId = (id: string): MessageId => id as MessageId;
export const asConversationId = (id: string): ConversationId =>
  id as ConversationId;
export const asPluginId = (id: string): PluginId => id as PluginId;
export const asCommandName = (name: string): CommandName =>
  name as CommandName;
export const asJobId = (id: string): JobId => id as JobId;
export const asCorrelationId = (id: string): CorrelationId =>
  id as CorrelationId;

// ─── Result Type ──────────────────────────────────────────────────────────────

/**
 * A discriminated union representing either a successful value or an error.
 *
 * RULE: Use Result<T> for expected, non-exceptional failures instead of
 *       throwing errors — per 07-error-handling.md §4.5.
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// ─── Timestamps ───────────────────────────────────────────────────────────────

/** ISO 8601 timestamp string. */
export type ISOTimestamp = string & { readonly __brand: 'ISOTimestamp' };

export const nowISO = (): ISOTimestamp =>
  new Date().toISOString() as ISOTimestamp;

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationOptions {
  readonly limit: number;
  readonly offset: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// ─── Lifecycle State ──────────────────────────────────────────────────────────

/**
 * Standard lifecycle states for managed components.
 * Used by Application, Managers, and long-lived services.
 */
export type LifecycleState =
  | 'IDLE'
  | 'STARTING'
  | 'RUNNING'
  | 'STOPPING'
  | 'STOPPED'
  | 'FAILED';
