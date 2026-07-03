/**
 * @file ConfigProvider.ts
 * @description The default implementation of IConfigProvider for the Void system.
 *
 * ConfigProvider wires together the three engine stages and presents a clean,
 * typed interface to the rest of the system:
 *
 *   [IConfigSource…] → ConfigLoader → ConfigValidator → ConfigCache → IConfig
 *                                                                      ↑
 *                                             All consumers stop here ─┘
 *
 * Responsibilities:
 *   - Accept one or more IConfigSource instances at construction time.
 *   - Delegate load → validate → cache to the engine internals.
 *   - Expose the stable IConfigProvider interface to all consumers.
 *   - Hide source type, count, and location from every consumer.
 *
 * RULE: This class is constructed ONCE per process during bootstrap.
 *       It is registered in the DI container under TOKENS.ConfigProvider.
 * RULE: Consumers MUST resolve this via TOKENS.ConfigProvider — never
 *       construct it directly outside of the bootstrap layer.
 * RULE: On reload() failure the previous cached config is preserved unchanged.
 *
 * @see IConfigProvider — the public contract this class implements
 * @see ConfigLoader    — reads and merges raw values from sources
 * @see ConfigValidator — coerces and validates raw values into IConfig
 * @see ConfigCache     — holds the single validated IConfig in memory
 * @see EnvironmentSource — the default (and only) process.env reader
 * @see createDefaultConfigProvider — the standard bootstrap factory
 */

import type { IConfig }          from '../interfaces/IConfig.js';
import type { IConfigProvider }  from '../interfaces/IConfigProvider.js';
import type { ISOTimestamp }     from '../types/common.types.js';
import type { IConfigSource }    from './sources/IConfigSource.js';
import { ConfigLoader }          from './engine/ConfigLoader.js';
import { ConfigValidator }       from './engine/ConfigValidator.js';
import { ConfigCache }           from './engine/ConfigCache.js';
import { EnvironmentSource }     from './sources/EnvironmentSource.js';

// ─── ConfigProvider ───────────────────────────────────────────────────────────

/**
 * The Void Configuration Provider.
 *
 * The sole bridge between the Configuration Engine internals and the
 * rest of the application. All layers that need configuration resolve
 * IConfigProvider from the DI container and call get().
 */
export class ConfigProvider implements IConfigProvider {
  private readonly loader:    ConfigLoader;
  private readonly validator: ConfigValidator;
  private readonly cache:     ConfigCache;

  /**
   * @param sources - Ordered list of IConfigSource instances.
   *                  Must contain at least one source (ConfigLoader enforces this).
   *                  Later sources override earlier ones for duplicate keys.
   */
  constructor(sources: readonly IConfigSource[]) {
    this.loader    = new ConfigLoader(sources);
    this.validator = new ConfigValidator();
    this.cache     = new ConfigCache();
  }

  // ─── IConfigProvider ───────────────────────────────────────────────────

  /**
   * Return the validated configuration, loading it on first call.
   *
   * Subsequent calls return the cached result — no I/O, no re-validation.
   * Safe to call repeatedly from any module.
   */
  async get(): Promise<IConfig> {
    const cached = this.cache.getConfig();
    if (cached !== null) return cached;
    return this.loadAndCache();
  }

  /**
   * Force a full reload from all registered sources, bypassing the cache.
   *
   * Atomicity guarantee:
   *   The cache is updated ONLY after all sources have been read and the
   *   new config has passed validation. If loading or validation fails, the
   *   previously cached config is preserved — the application keeps running
   *   on the last known-good configuration.
   *
   * Failure contract:
   *   The thrown ConfigError describes what went wrong. The cache is
   *   untouched. The next call to get() returns the old config unchanged.
   */
  async reload(): Promise<IConfig> {
    // Do NOT invalidate the cache before loading. loadAndCache() overwrites
    // the cache only on success — a failure leaves the old entry intact.
    return this.loadAndCache();
  }

  /** @inheritdoc */
  get isLoaded(): boolean {
    return this.cache.has();
  }

  /** @inheritdoc */
  get loadedAt(): ISOTimestamp | null {
    return this.cache.cachedAt;
  }

  // ─── Private ──────────────────────────────────────────────────────────

  /**
   * Execute the full load pipeline: read sources → validate → cache → return.
   *
   * Called only when the cache is empty (first load or after invalidation).
   * All thrown errors propagate to the caller unchanged.
   */
  private async loadAndCache(): Promise<IConfig> {
    const raw    = await this.loader.load();
    const config = this.validator.validate(raw);
    this.cache.set(config);
    return config;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create the standard ConfigProvider backed by process.env.
 *
 * This is the factory used during application bootstrap. The EnvironmentSource
 * is the only class in the system authorised to read process.env.
 *
 * Usage:
 * ```ts
 * const provider = createDefaultConfigProvider();
 * const config   = await provider.get();
 * container.bindInstance(TOKENS.Config,         config);
 * container.bindInstance(TOKENS.ConfigProvider, provider);
 * ```
 *
 * To add additional sources (e.g. a secrets manager in production):
 * ```ts
 * const provider = new ConfigProvider([
 *   new EnvironmentSource(),          // base
 *   new VaultSource(vaultClient),     // overrides env — higher priority
 * ]);
 * ```
 */
export function createDefaultConfigProvider(): ConfigProvider {
  return new ConfigProvider([new EnvironmentSource()]);
}
