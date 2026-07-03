/**
 * @file VoidError.ts
 * @description Base error class for the entire Void system.
 *
 * RULE: Every error thrown within Void MUST extend VoidError.
 * RULE: Raw infrastructure errors (pg, redis, etc.) MUST be caught and wrapped
 *       before propagating upward — they must never cross layer boundaries naked.
 * RULE: Every error carries a typed `code` (SCREAMING_SNAKE_CASE) and a `category`.
 */

// ─── Error Categories ────────────────────────────────────────────────────────

/** High-level classification of an error's origin. */
export type ErrorCategory =
  | 'FACEBOOK'
  | 'SESSION'
  | 'AUTH'
  | 'VALIDATION'
  | 'CONFIG'
  | 'PLUGIN'
  | 'COMMAND'
  | 'INFRASTRUCTURE'
  | 'INTERNAL';

// ─── Context ─────────────────────────────────────────────────────────────────

/** Arbitrary structured context attached to an error for diagnostics. */
export type ErrorContext = Readonly<Record<string, unknown>>;

// ─── Base Error ───────────────────────────────────────────────────────────────

/**
 * Abstract base for every error in the Void system.
 *
 * Subclasses MUST declare:
 *  - `readonly code: string`   — SCREAMING_SNAKE_CASE identifier
 *  - `readonly category: ErrorCategory`
 *
 * @example
 * ```ts
 * throw new SessionError('Session has expired', {
 *   cause: originalError,
 *   context: { sessionId, expiredAt },
 * });
 * ```
 */
export abstract class VoidError extends Error {
  /** SCREAMING_SNAKE_CASE unique error code — used for programmatic matching. */
  abstract readonly code: string;

  /** High-level category of this error. */
  abstract readonly category: ErrorCategory;

  /**
   * Structured diagnostic context attached to this error.
   * MUST NOT contain secrets, tokens, passwords, or PII.
   */
  readonly context: ErrorContext;

  constructor(
    message: string,
    options?: { cause?: unknown; context?: ErrorContext },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    this.context = options?.context ?? {};

    // Maintain proper prototype chain for instanceof checks across transpilation
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Returns a structured representation suitable for logging.
   * NEVER expose this directly in API responses — it may contain internal detail.
   */
  toLog(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      context: this.context,
      stack: this.stack,
      cause:
        this.cause instanceof VoidError
          ? this.cause.toLog()
          : String(this.cause ?? ''),
    };
  }
}
