/**
 * @file SessionError.ts
 * @description Errors related to session lifecycle and state management.
 */

import { type ErrorContext, VoidError } from './VoidError.js';

// ─── Session Error Codes ──────────────────────────────────────────────────────

export type SessionErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'SESSION_INVALIDATED'
  | 'SESSION_CREATION_FAILED'
  | 'SESSION_REFRESH_FAILED'
  | 'SESSION_PERSISTENCE_FAILED'
  | 'SESSION_DECRYPTION_FAILED'
  | 'SESSION_ENCRYPTION_FAILED';

// ─── SessionError ─────────────────────────────────────────────────────────────

export class SessionError extends VoidError {
  readonly category = 'SESSION' as const;
  readonly code: SessionErrorCode;

  constructor(
    code: SessionErrorCode,
    message: string,
    options?: { cause?: unknown; context?: ErrorContext },
  ) {
    super(message, options);
    this.code = code;
  }
}
