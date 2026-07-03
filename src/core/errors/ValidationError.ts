/**
 * @file ValidationError.ts
 * @description Errors arising from input or schema validation failures.
 *
 * RULE: ValidationError represents expected, non-exceptional failures.
 *       It MUST NOT be used as control flow — return a Result type instead
 *       when the caller needs to branch on validation failure.
 */

import { type ErrorContext, VoidError } from './VoidError.js';

// ─── Validation Error Codes ───────────────────────────────────────────────────

export type ValidationErrorCode =
  | 'VALIDATION_REQUIRED_FIELD_MISSING'
  | 'VALIDATION_INVALID_TYPE'
  | 'VALIDATION_INVALID_FORMAT'
  | 'VALIDATION_OUT_OF_RANGE'
  | 'VALIDATION_SCHEMA_MISMATCH'
  | 'VALIDATION_DUPLICATE_VALUE'
  | 'VALIDATION_PAYLOAD_MALFORMED';

// ─── Field-Level Violation ────────────────────────────────────────────────────

/** A single field-level validation failure. */
export interface ValidationViolation {
  readonly field: string;
  readonly message: string;
  readonly receivedValue?: unknown;
}

// ─── ValidationError ──────────────────────────────────────────────────────────

export class ValidationError extends VoidError {
  readonly category = 'VALIDATION' as const;
  readonly code: ValidationErrorCode;

  /** Individual field-level violations, if available. */
  readonly violations: readonly ValidationViolation[];

  constructor(
    code: ValidationErrorCode,
    message: string,
    options?: {
      cause?: unknown;
      context?: ErrorContext;
      violations?: ValidationViolation[];
    },
  ) {
    super(message, options);
    this.code = code;
    this.violations = options?.violations ?? [];
  }

  override toLog(): Record<string, unknown> {
    return { ...super.toLog(), violations: this.violations };
  }
}
