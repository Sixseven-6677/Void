/**
 * @file PluginError.ts
 * @description Errors originating from the Plugin System.
 *
 * RULE: Plugin errors MUST NOT propagate to the EventDispatcher or Core.
 *       They are isolated within the Plugin execution boundary.
 */

import { type ErrorContext, VoidError } from './VoidError.js';

// ─── Plugin Error Codes ───────────────────────────────────────────────────────

export type PluginErrorCode =
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_LOAD_FAILED'
  | 'PLUGIN_INIT_FAILED'
  | 'PLUGIN_ALREADY_REGISTERED'
  | 'PLUGIN_DISABLED'
  | 'PLUGIN_PERMISSION_DENIED'
  | 'PLUGIN_INVALID_MANIFEST'
  | 'PLUGIN_DEPENDENCY_MISSING'
  | 'PLUGIN_EXECUTION_FAILED'
  | 'PLUGIN_EVENT_NOT_DECLARED';

// ─── PluginError ──────────────────────────────────────────────────────────────

export class PluginError extends VoidError {
  readonly category = 'PLUGIN' as const;
  readonly code: PluginErrorCode;

  constructor(
    code: PluginErrorCode,
    message: string,
    options?: { cause?: unknown; context?: ErrorContext },
  ) {
    super(message, options);
    this.code = code;
  }
}
