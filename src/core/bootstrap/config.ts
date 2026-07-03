/**
 * @file config.ts
 * @description Bootstrap entry point for the Configuration Engine.
 *
 * This file is the bridge between the bootstrap layer and the Configuration
 * Engine. It exposes a single factory function that the process entry point
 * uses to wire configuration into the DI container.
 *
 * RULE: This is the ONLY file in the bootstrap layer that may import from
 *       the config package. All other bootstrap code resolves IConfig and
 *       IConfigProvider through the DI container.
 * RULE: process.env is never read here — the engine handles all env access
 *       exclusively through EnvironmentSource.
 *
 * Wiring pattern for process entry point (src/index.ts):
 * ```ts
 * import { buildConfig } from './core/bootstrap/config.js';
 *
 * const { config, provider } = await buildConfig();
 * container.bindInstance(TOKENS.Config,         config);
 * container.bindInstance(TOKENS.ConfigProvider, provider);
 * ```
 *
 * @see createDefaultConfigProvider — builds the provider backed by process.env
 * @see IConfigProvider             — the contract exposed to all consumers
 * @see .constitution/27-roadmap.md §3 (Phase 0 — Config Loader)
 */

import type { IConfig }         from '../interfaces/IConfig.js';
import type { IConfigProvider } from '../interfaces/IConfigProvider.js';
import { createDefaultConfigProvider } from '../config/ConfigProvider.js';

// ─── BuildConfigResult ────────────────────────────────────────────────────────

/**
 * The result of a successful buildConfig() call.
 * Both objects are ready to be bound into the DI container.
 */
export interface BuildConfigResult {
  /** The fully validated, typed configuration — for TOKENS.Config. */
  readonly config: IConfig;

  /**
   * The live ConfigProvider instance — for TOKENS.ConfigProvider.
   * Retain this to support reload() if secret rotation is ever needed.
   */
  readonly provider: IConfigProvider;
}

// ─── buildConfig ──────────────────────────────────────────────────────────────

/**
 * Construct the default ConfigProvider, load configuration from process.env,
 * validate all required fields, and return both objects ready for DI binding.
 *
 * This function is called exactly ONCE during application startup, before the
 * DI container is passed to Application or Kernel. The validated IConfig is
 * bound as a pre-constructed instance so that container.resolve(TOKENS.Config)
 * remains synchronous for all downstream consumers.
 *
 * Failure behaviour:
 *   Throws ConfigError immediately if any required environment variable is
 *   absent or malformed. The application must not start with invalid config.
 *
 * @returns { config, provider } — both ready to bind into the DI container.
 * @throws ConfigError if validation fails.
 */
export async function buildConfig(): Promise<BuildConfigResult> {
  const provider = createDefaultConfigProvider();
  const config   = await provider.get();
  return { config, provider };
}

