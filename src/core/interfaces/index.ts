/**
 * @file interfaces/index.ts
 * @description Barrel export for all Core system contracts.
 *
 * Import pattern:
 *   import { type ILogger, type IEventBus } from '@void/core/interfaces';
 */

export type { ILogger, LogLevel, LogFields } from './ILogger.js';
export type { IConfig, ServerConfig, FacebookConfig, DatabaseConfig, CacheConfig, SessionConfig } from './IConfig.js';
export type { IFacebookClient, FacebookSendResult } from './IFacebookClient.js';
export type {
  IEventBus,
  EmitOptions,
  SubscriptionOptions,
  DeadLetterEntry,
} from './IEventBus.js';
export type { ISessionRepository } from './ISessionRepository.js';
export type { ISessionService } from './ISessionService.js';
export type { IUserRepository } from './IUserRepository.js';
export type { IUserService } from './IUserService.js';
export type { ICommandRegistry } from './ICommandRegistry.js';
export type { IPluginRegistry } from './IPluginRegistry.js';
export type {
  ICacheClient,
} from './ICacheClient.js';
export type {
  IScheduler,
  JobHandler,
  JobInfo,
  JobStatus,
  OneTimeJobOptions,
  RecurringJobOptions,
  CronExpression,
} from './IScheduler.js';
