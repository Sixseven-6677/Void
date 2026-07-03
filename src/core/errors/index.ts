/**
 * @file errors/index.ts
 * @description Barrel export for the complete Void error hierarchy.
 *
 * Import pattern:
 *   import { VoidError, SessionError, type SessionErrorCode } from '@void/core/errors';
 */

export { VoidError, type ErrorCategory, type ErrorContext } from './VoidError.js';
export { FacebookError, type FacebookErrorCode } from './FacebookError.js';
export { SessionError, type SessionErrorCode } from './SessionError.js';
export { AuthError, type AuthErrorCode } from './AuthError.js';
export {
  ValidationError,
  type ValidationErrorCode,
  type ValidationViolation,
} from './ValidationError.js';
export { ConfigError, type ConfigErrorCode } from './ConfigError.js';
export { PluginError, type PluginErrorCode } from './PluginError.js';
export { CommandError, type CommandErrorCode } from './CommandError.js';
export {
  InfrastructureError,
  type InfrastructureErrorCode,
} from './InfrastructureError.js';
