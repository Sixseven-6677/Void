/**
 * @file FacebookError.ts
 * @description Errors originating from the Facebook Layer.
 *
 * RULE: Only Facebook Layer components may throw FacebookError.
 * RULE: Upper layers receive FacebookError wrapped as InfrastructureError.
 */

import { type ErrorContext, VoidError } from './VoidError.js';

// ─── Facebook Error Codes ─────────────────────────────────────────────────────

export type FacebookErrorCode =
  | 'FACEBOOK_API_ERROR'
  | 'FACEBOOK_SIGNATURE_INVALID'
  | 'FACEBOOK_RATE_LIMITED'
  | 'FACEBOOK_TOKEN_INVALID'
  | 'FACEBOOK_CONNECTION_LOST'
  | 'FACEBOOK_PAYLOAD_INVALID'
  | 'FACEBOOK_SEND_FAILED'
  | 'FACEBOOK_WEBHOOK_VERIFICATION_FAILED';

// ─── FacebookError ─────────────────────────────────────────────────────────

export class FacebookError extends VoidError {
  readonly category = 'FACEBOOK' as const;
  readonly code: FacebookErrorCode;

  constructor(
    code: FacebookErrorCode,
    message: string,
    options?: { cause?: unknown; context?: ErrorContext },
  ) {
    super(message, options);
    this.code = code;
  }
}
