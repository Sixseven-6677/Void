/**
 * @file CommandError.ts
 * @description Errors originating from the Command System.
 */

import { type ErrorContext, VoidError } from './VoidError.js';

// ─── Command Error Codes ──────────────────────────────────────────────────────

export type CommandErrorCode =
  | 'COMMAND_NOT_FOUND'
  | 'COMMAND_ALREADY_REGISTERED'
  | 'COMMAND_PERMISSION_DENIED'
  | 'COMMAND_INVALID_ARGUMENTS'
  | 'COMMAND_EXECUTION_FAILED'
  | 'COMMAND_DISABLED'
  | 'COMMAND_COOLDOWN_ACTIVE'
  | 'COMMAND_HANDLER_MISSING';

// ─── CommandError ─────────────────────────────────────────────────────────────

export class CommandError extends VoidError {
  readonly category = 'COMMAND' as const;
  readonly code: CommandErrorCode;

  constructor(
    code: CommandErrorCode,
    message: string,
    options?: { cause?: unknown; context?: ErrorContext },
  ) {
    super(message, options);
    this.code = code;
  }
}
