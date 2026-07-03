/**
 * @file AuthError.ts
 * @description Errors related to authentication and authorization.
 */

import { type ErrorContext, VoidError } from './VoidError.js';

// ─── Auth Error Codes ─────────────────────────────────────────────────────────

export type AuthErrorCode =
  | 'AUTH_SIGNATURE_INVALID'
  | 'AUTH_TOKEN_MISSING'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_UNAUTHORIZED'
  | 'AUTH_FORBIDDEN'
  | 'AUTH_USER_NOT_FOUND'
  | 'AUTH_RATE_LIMITED';

// ─── AuthError ────────────────────────────────────────────────────────────────

export class AuthError extends VoidError {
  readonly category = 'AUTH' as const;
  readonly code: AuthErrorCode;

  constructor(
    code: AuthErrorCode,
    message: string,
    options?: { cause?: unknown; context?: ErrorContext },
  ) {
    super(message, options);
    this.code = code;
  }
}
