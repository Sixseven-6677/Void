/**
 * @file ILogger.ts
 * @description Contract for the structured logging system.
 *
 * RULE: No component may use console.log / console.error / console.warn.
 *       All logging MUST go through ILogger or req.log.
 * RULE: Log entries MUST NOT contain secrets, tokens, passwords, or PII.
 * RULE: Log levels must be used correctly — do not log errors as info or
 *       routine events as errors.
 *
 * @see 08-logging-policy.md
 */

// ─── Log Levels ───────────────────────────────────────────────────────────────

/** Standard severity levels in ascending order. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// ─── Log Fields ───────────────────────────────────────────────────────────────

/**
 * Structured fields attached to a log entry.
 * MUST NOT include secrets, tokens, passwords, session contents, or cookies.
 */
export type LogFields = Readonly<Record<string, unknown>>;

// ─── ILogger ──────────────────────────────────────────────────────────────────

/**
 * Contract for structured, leveled logging.
 *
 * All implementations must:
 * - Produce structured output (JSON) parseable by the monitoring system.
 * - Include a timestamp, level, and category in every entry.
 * - Support child loggers with additional bound fields.
 */
export interface ILogger {
  /** Detailed diagnostic information — disabled in production by default. */
  debug(message: string, fields?: LogFields): void;

  /** Normal operational events worth recording. */
  info(message: string, fields?: LogFields): void;

  /** Unexpected situations that do not interrupt operation. */
  warn(message: string, fields?: LogFields): void;

  /** Errors that interrupt an operation but not the whole system. */
  error(message: string, fields?: LogFields): void;

  /**
   * Critical failures that require immediate attention and may cause shutdown.
   * Use only for unrecoverable system-level failures.
   */
  fatal(message: string, fields?: LogFields): void;

  /**
   * Create a child logger with additional bound fields.
   * The child inherits all fields from its parent and adds its own.
   * Use for request-scoped or component-scoped logging.
   *
   * @example
   * const reqLogger = logger.child({ requestId, userId });
   */
  child(fields: LogFields): ILogger;
}
