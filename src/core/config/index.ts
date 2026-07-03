/**
 * @file config/index.ts
 * @description Barrel export for the Void Configuration Engine and Provider.
 *
 * This package owns all configuration infrastructure in the Core layer:
 *   - Sources     — where raw values come from (env, file, remote)
 *   - Engine      — loading, validation, and caching of raw values
 *   - Provider    — the single authorised interface for all consumers
 *
 * ─── Consumer import pattern ─────────────────────────────────────────────────
 *
 * Application code (resolving at runtime):
 *   import type { IConfigProvider } from '@void/core';
 *   const provider = container.resolve<IConfigProvider>(TOKENS.ConfigProvider);
 *   const config   = await provider.get();
 *
 * Bootstrap code (wiring the container):
 *   import { createDefaultConfigProvider } from '@void/core/config';
 *   const provider = createDefaultConfigProvider();
 *   const config   = await provider.get();
 *   container.bindInstance(TOKENS.Config,         config);
 *   container.bindInstance(TOKENS.ConfigProvider, provider);
 *
 * Custom source (advanced / future):
 *   import type { IConfigSource }  from '@void/core/config';
 *   import { ConfigProvider }      from '@void/core/config';
 *
 * ─── What NOT to import from here ────────────────────────────────────────────
 *
 * Engine internals (ConfigLoader, ConfigValidator, ConfigCache) are intentionally
 * excluded from this barrel. They are implementation details of the engine and
 * must not be used directly by application layers.
 */

// ─── Public API ───────────────────────────────────────────────────────────────

// Sources — the extension point for adding new configuration origins
export type { IConfigSource, RawConfigMap }  from './sources/IConfigSource.js';
export { EnvironmentSource }                 from './sources/EnvironmentSource.js';

// Loader — file-based configuration loading with existence and required-key checks
export type { EnvFileDescriptor }                        from './loader/EnvFileLoader.js';
export { EnvFileLoader }                                 from './loader/EnvFileLoader.js';
export { EnvironmentLoader, type EnvironmentLoaderOptions } from './loader/EnvironmentLoader.js';
export { VOID_REQUIRED_KEYS, type RequiredKey }          from './loader/RequiredKeys.js';

// Provider — the public face of the configuration system
export { ConfigProvider, createDefaultConfigProvider } from './ConfigProvider.js';
