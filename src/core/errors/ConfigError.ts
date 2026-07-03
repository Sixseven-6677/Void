/**
 * @file ConfigError.ts
 * @description Errors related to application configuration loading and validation.
 *
 * RULE: ConfigError is thrown at startup. If config is invalid, the application
 *       MUST fail loudly and immediately — it MUST NOT silently use defaults
 *       for required configuration values.
 */

import { type ErrorContext, VoidError } from './VoidError.js';

// ─── Config Error Codes ───────────────────────────────────────────────────────

export type ConfigErrorCode =
  | 'CONFIG_REQUIRED_VARIABLE_MISSING'
  | 'CONFIG_INVALID_VALUE'
  | 'CONFIG_INVALID_FORMAT'
  | 'CONFIG_LOAD_FAILED'
  | 'CONFIG_SCHEMA_MISMATCH';

// ─── ConfigError ──────────────────────────────────────────────────────────────

export class ConfigError extends VoidError {
  readonly category = 'CONFIG' as const;
  readonly code: ConfigErrorCode;

  constructor(
    code: ConfigErrorCode,
    message: string,
    options?: { cause?: unknown; context?: ErrorContext },
  ) {
    super(message, options);
    this.code = code;
  }
}
