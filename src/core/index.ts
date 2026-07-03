/**
 * @file src/core/index.ts
 * @description Main barrel export for the Void Core Framework.
 *
 * Core is the innermost layer of the Void architecture. It contains:
 *   - All system contracts (Interfaces)
 *   - All domain types
 *   - The error hierarchy
 *   - The DI container and token registry
 *   - Application lifecycle (bootstrap, graceful shutdown)
 *
 * RULE: Core has ZERO runtime dependencies on other Void layers.
 * RULE: Core has ZERO dependencies on Facebook SDK, database drivers, or
 *       any infrastructure library. It defines contracts — not implementations.
 * RULE: All other layers depend on Core. Core depends on nothing.
 *
 * Import pattern for consumers:
 *   import { type ILogger, TOKENS, VoidContainer } from '@void/core';
 *   import { VoidError, SessionError } from '@void/core/errors';
 *   import { type User, type Session } from '@void/core/types';
 *
 * @see .constitution/02-architecture.md
 * @see .constitution/04-dependency-rules.md
 */

// ─── Errors ───────────────────────────────────────────────────────────────────
export * from './errors/index.js';
export { InternalError, type InternalErrorCode } from './errors/InternalError.js';

// ─── Domain Types ─────────────────────────────────────────────────────────────
export * from './types/index.js';

// ─── System Contracts (Interfaces) ────────────────────────────────────────────
export type {
  ILogger,
  LogLevel,
  LogFields,
} from './interfaces/ILogger.js';

export type {
  IConfig,
  ServerConfig,
  FacebookConfig,
  DatabaseConfig,
  CacheConfig,
  SessionConfig,
} from './interfaces/IConfig.js';

export type {
  IFacebookClient,
  FacebookSendResult,
} from './interfaces/IFacebookClient.js';

export type {
  IEventBus,
  EmitOptions,
  SubscriptionOptions,
  DeadLetterEntry,
} from './interfaces/IEventBus.js';

export type { ISessionRepository } from './interfaces/ISessionRepository.js';
export type { ISessionService }    from './interfaces/ISessionService.js';
export type { IUserRepository }    from './interfaces/IUserRepository.js';
export type { IUserService }       from './interfaces/IUserService.js';
export type { ICommandRegistry }   from './interfaces/ICommandRegistry.js';
export type { IPluginRegistry }    from './interfaces/IPluginRegistry.js';

export type {
  ICacheClient,
} from './interfaces/ICacheClient.js';

export type {
  IScheduler,
  JobHandler,
  JobInfo,
  JobStatus,
  OneTimeJobOptions,
  RecurringJobOptions,
  CronExpression,
} from './interfaces/IScheduler.js';

export type { IService } from './interfaces/IService.js';

// ─── DI Container ─────────────────────────────────────────────────────────────
export { VoidContainer, type BindingFactory } from './container/container.js';
export { TOKENS, type Token }                  from './container/tokens.js';

// ─── Application Bootstrap ────────────────────────────────────────────────────
export { Application, type ApplicationOptions } from './bootstrap/Application.js';
export { loadConfig }                            from './bootstrap/config.js';

// ─── Application Kernel ───────────────────────────────────────────────────────
export { Kernel, type KernelOptions }     from './kernel/Kernel.js';
export type { IKernelModule }              from './kernel/IKernelModule.js';
export type { IKernelContext }             from './kernel/IKernelContext.js';
export {
  KernelPriority,
  type KernelPhase,
  type KernelHealth,
  type ModuleHealth,
  type ModuleHealthStatus,
  type ShutdownReason,
  type PhaseChangeEvent,
  type PhaseChangeHandler,
} from './kernel/kernel.types.js';
