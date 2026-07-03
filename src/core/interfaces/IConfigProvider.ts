/**
 * @file IConfigProvider.ts
 * @description The official contract for the Configuration Provider.
 *
 * IConfigProvider is the ONLY authorised gateway for accessing configuration
 * across the entire Void system. Every layer — Facebook, Services, Managers,
 * Repositories, Middleware — that needs configuration must resolve it through
 * this interface.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ARCHITECTURAL RULE                                                      ║
 * ║                                                                          ║
 * ║  No layer outside the Configuration Engine may read process.env.        ║
 * ║  No layer may construct IConfig directly.                                ║
 * ║  All configuration access goes through IConfigProvider.get().           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Why an interface and not a direct class reference?
 *   - Consumers depend on the contract, not the implementation.
 *   - The implementation can be swapped without touching any consumer.
 *   - Tests can inject a TestConfigProvider without touching process.env.
 *   - The source (env vars, remote secrets, files) is invisible to consumers.
 *
 * @see ConfigProvider — the default implementation
 * @see TOKENS.ConfigProvider — the DI token used to resolve this interface
 * @see .constitution/04-dependency-rules.md
 * @see .constitution/02-architecture.md
 */

import type { IConfig }      from './IConfig.js';
import type { ISOTimestamp } from '../types/common.types.js';

// ─── IConfigProvider ──────────────────────────────────────────────────────────

/**
 * The centralised, source-agnostic gateway for all configuration access.
 *
 * Consumers receive a fully validated, typed IConfig. They never interact
 * with raw strings, process.env, config files, or remote secrets stores.
 *
 * Standard usage (in a KernelModule or Service):
 * ```ts
 * const provider = ctx.container.resolve<IConfigProvider>(TOKENS.ConfigProvider);
 * const config   = await provider.get();
 * const port     = config.server.port;   // typed, validated, never null
 * ```
 */
export interface IConfigProvider {

  /**
   * Return the current validated configuration.
   *
   * - On first call: loads from all registered sources, validates, caches, returns.
   * - On subsequent calls: returns the cached result instantly (no I/O).
   *
   * This is the standard access path for all consumers in the system.
   * It is safe to call repeatedly — the cache ensures no redundant I/O.
   *
   * @throws ConfigError if loading or validation fails on the first call.
   */
  get(): Promise<IConfig>;

  /**
   * Force a full reload from all registered sources, bypassing the cache.
   *
   * Use cases:
   *   - Secret rotation: the application is running and a secret has changed.
   *   - Test isolation: reset configuration between test runs.
   *
   * Atomicity guarantee:
   *   The cache is updated ONLY after all sources have been read and the new
   *   config has passed validation. If loading or validation fails, the
   *   previously cached config is PRESERVED — the application keeps running on
   *   the last known-good configuration. The error propagates to the caller.
   *
   * RULE: Normal, steady-state application code MUST NOT call reload().
   *       It is an operational tool, not a runtime code path.
   *
   * @throws ConfigError if loading or validation fails (old config preserved).
   */
  reload(): Promise<IConfig>;

  /**
   * Whether configuration has been successfully loaded and is currently cached.
   *
   * - false: before the first successful get() or reload() call.
   * - true:  after any successful load, until invalidated internally.
   *
   * Useful for readiness checks — do not use this for control-flow branching
   * in business logic (always call get() instead).
   */
  readonly isLoaded: boolean;

  /**
   * ISO 8601 timestamp of when the configuration was last successfully loaded.
   * Null before the first successful load.
   *
   * Exposed for diagnostics and health-check endpoints — not for application logic.
   */
  readonly loadedAt: ISOTimestamp | null;
}
