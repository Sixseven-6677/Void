/**
 * @file InfrastructureError.ts
 * @description Errors originating from infrastructure components (database, cache, network).
 *
 * RULE: Raw infrastructure errors (pg, ioredis, fetch) MUST be caught at the
 *       infrastructure layer and wrapped in InfrastructureError before propagating.
 * RULE: The domain layer MUST never receive a raw pg error, redis error, or
 *       network error — only InfrastructureError.
 */

import { type ErrorContext, VoidError } from './VoidError.js';

// ─── Infrastructure Error Codes ───────────────────────────────────────────────

export type InfrastructureErrorCode =
  | 'DB_QUERY_FAILED'
  | 'DB_CONNECTION_FAILED'
  | 'DB_TRANSACTION_FAILED'
  | 'DB_CONSTRAINT_VIOLATION'
  | 'CACHE_READ_FAILED'
  | 'CACHE_WRITE_FAILED'
  | 'CACHE_CONNECTION_FAILED'
  | 'CACHE_EVICTION_FAILED'
  | 'NETWORK_REQUEST_FAILED'
  | 'NETWORK_TIMEOUT'
  | 'SCHEDULER_JOB_FAILED'
  | 'SCHEDULER_ENQUEUE_FAILED';

// ─── InfrastructureError ──────────────────────────────────────────────────────

export class InfrastructureError extends VoidError {
  readonly category = 'INFRASTRUCTURE' as const;
  readonly code: InfrastructureErrorCode;

  constructor(
    code: InfrastructureErrorCode,
    message: string,
    options?: { cause?: unknown; context?: ErrorContext },
  ) {
    super(message, options);
    this.code = code;
  }
}
