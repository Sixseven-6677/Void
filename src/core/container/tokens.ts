/**
 * @file tokens.ts
 * @description DI injection tokens for all Core contracts.
 *
 * Every interface registered in the DI Container has a corresponding Symbol
 * token here. Tokens are the single source of truth for binding names —
 * no string literals are used for DI keys.
 *
 * RULE: Tokens are declared here and nowhere else.
 * RULE: One token per interface — no token aliasing.
 * RULE: New interfaces require a new token added to this file first.
 *
 * Usage:
 *   container.bind<ILogger>(TOKENS.Logger).to(PinoLogger);
 *   const logger = container.resolve<ILogger>(TOKENS.Logger);
 */

// ─── Core Infrastructure Tokens ───────────────────────────────────────────────

export const TOKENS = {
  // Infrastructure / Cross-cutting
  Logger:          Symbol.for('ILogger'),
  Config:          Symbol.for('IConfig'),
  ConfigProvider:  Symbol.for('IConfigProvider'),

  // Facebook Layer contract
  FacebookClient:  Symbol.for('IFacebookClient'),

  // Event system
  EventBus:        Symbol.for('IEventBus'),

  // Session domain
  SessionRepository: Symbol.for('ISessionRepository'),
  SessionService:    Symbol.for('ISessionService'),

  // User domain
  UserRepository: Symbol.for('IUserRepository'),
  UserService:    Symbol.for('IUserService'),

  // Command system
  CommandRegistry: Symbol.for('ICommandRegistry'),

  // Plugin system
  PluginRegistry:  Symbol.for('IPluginRegistry'),

  // Infrastructure
  CacheClient: Symbol.for('ICacheClient'),
  Scheduler:   Symbol.for('IScheduler'),
} as const;

/** Union of all valid token symbols. */
export type Token = (typeof TOKENS)[keyof typeof TOKENS];
