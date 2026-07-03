/**
 * @file ConfigLoader.ts
 * @description Reads and merges raw configuration from one or more IConfigSource instances.
 *
 * The loader is the first stage of the Configuration Engine pipeline:
 *
 *   [Sources] → ConfigLoader → [Raw Map] → ConfigValidator → [IConfig] → ConfigCache
 *
 * Merge semantics:
 *   Sources are applied left-to-right. When the same key appears in multiple
 *   sources, the LAST registered source wins. This allows layered override:
 *     [ base defaults ] ← [ .env file ] ← [ process.env ] ← [ remote secrets ]
 *
 * RULE: The loader returns raw strings ONLY — it does NOT validate or coerce.
 * RULE: At least one source must be registered — a zero-source loader is invalid.
 * RULE: Source failures are wrapped in ConfigError and re-thrown immediately.
 *       The engine must not start with a partial configuration.
 *
 * @see IConfigSource  — the contract each source must implement
 * @see ConfigValidator — the downstream consumer of load()
 * @see .constitution/04-dependency-rules.md
 */

import { ConfigError }                       from '../../errors/ConfigError.js';
import type { IConfigSource, RawConfigMap }  from '../sources/IConfigSource.js';

// ─── ConfigLoader ─────────────────────────────────────────────────────────────

/**
 * Reads from all registered IConfigSource instances and merges their outputs
 * into a single frozen RawConfigMap.
 *
 * Usage:
 *   const loader = new ConfigLoader([new EnvironmentSource()]);
 *   const raw    = await loader.load();  // → merged frozen map
 */
export class ConfigLoader {
  private readonly sources: readonly IConfigSource[];

  /**
   * @param sources - Ordered list of sources. Must contain at least one entry.
   *                  Sources are applied left-to-right; later sources override earlier.
   * @throws ConfigError (CONFIG_LOAD_FAILED) if sources array is empty.
   */
  constructor(sources: readonly IConfigSource[]) {
    if (sources.length === 0) {
      throw new ConfigError(
        'CONFIG_LOAD_FAILED',
        'ConfigLoader requires at least one IConfigSource. ' +
        'Register an EnvironmentSource or a custom source before constructing the loader.',
        { context: { registeredSources: 0 } },
      );
    }
    this.sources = sources;
  }

  // ─── Load ──────────────────────────────────────────────────────────────

  /**
   * Read all sources sequentially and merge their outputs into a single frozen map.
   *
   * Execution:
   *   1. Each source is awaited in registration order.
   *   2. Outputs are merged left-to-right (later sources win on key conflicts).
   *   3. The final merged map is frozen before returning.
   *
   * Failure behaviour:
   *   Any source failure throws a ConfigError immediately — no partial merges
   *   are returned. The application must not start on incomplete data.
   *
   * @returns A frozen merged RawConfigMap from all sources.
   * @throws ConfigError (CONFIG_LOAD_FAILED) if any source throws during read().
   */
  async load(): Promise<RawConfigMap> {
    let merged: Record<string, string | undefined> = {};

    for (const source of this.sources) {
      try {
        const values = await source.read();
        // Spread preserves existing keys; new values from this source override.
        merged = { ...merged, ...values };
      } catch (error) {
        // Pass ConfigErrors through unchanged — they already carry full context.
        if (error instanceof ConfigError) throw error;

        throw new ConfigError(
          'CONFIG_LOAD_FAILED',
          `Configuration source "${source.name}" failed during read(): ` +
          (error instanceof Error ? error.message : String(error)),
          {
            cause:   error,
            context: { sourceName: source.name },
          },
        );
      }
    }

    return Object.freeze(merged) as RawConfigMap;
  }

  // ─── Introspection ─────────────────────────────────────────────────────

  /**
   * The names of all registered sources, in registration (priority) order.
   * Used for diagnostics — never includes secret values.
   */
  get sourceNames(): readonly string[] {
    return this.sources.map((s) => s.name);
  }

  /** Total number of registered sources. */
  get sourceCount(): number {
    return this.sources.length;
  }
}
