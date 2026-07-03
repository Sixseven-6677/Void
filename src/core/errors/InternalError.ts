/**
 * @file InternalError.ts
 * @description Errors arising from Core infrastructure violations —
 *              DI container misuse, lifecycle state machine violations,
 *              and other internal invariant breaches.
 *
 * RULE: These errors indicate programming mistakes, not user input errors.
 *       They should never reach end users — they fail fast at startup or
 *       during development.
 * RULE: Every internal invariant violation MUST be a typed InternalError,
 *       never a raw `new Error(...)`.
 */

import { type ErrorContext, VoidError } from './VoidError.js';

// ─── Internal Error Codes ─────────────────────────────────────────────────────

export type InternalErrorCode =
  // DI Container violations
  | 'CONTAINER_TOKEN_ALREADY_REGISTERED'
  | 'CONTAINER_TOKEN_NOT_FOUND'
  | 'CONTAINER_CIRCULAR_DEPENDENCY'
  // Application lifecycle violations
  | 'APP_INVALID_STATE_TRANSITION'
  | 'APP_ALREADY_STARTED'
  | 'APP_NOT_RUNNING'
  // General invariant breaches
  | 'INVARIANT_VIOLATION'
  | 'UNREACHABLE_CODE';

// ─── InternalError ────────────────────────────────────────────────────────────

export class InternalError extends VoidError {
  readonly category = 'INTERNAL' as const;
  readonly code: InternalErrorCode;

  constructor(
    code: InternalErrorCode,
    message: string,
    options?: { cause?: unknown; context?: ErrorContext },
  ) {
    super(message, options);
    this.code = code;
  }
}
