/**
 * @file ConfigCache.ts
 * @description In-memory cache for the loaded and validated IConfig.
 *
 * The cache ensures that configuration is loaded from sources and validated
 * exactly ONCE per application lifetime during normal operation. All subsequent
 * access is a zero-cost in-memory lookup with no I/O or parsing overhead.
 *
 * RULE: The cache stores only a validated IConfig — never raw strings.
 * RULE: The cached object is frozen and immutable — it cannot be changed after storage.
 * RULE: invalidate() is reserved for forced reloads (secret rotation, test teardown).
 *       Normal application code MUST NOT call it.
 * RULE: The cache is NOT a dynamic configuration store. It does not watch for
 *       changes or expire entries on a timer.
 *
 * @see ConfigProvider — the only caller of set() and invalidate()
 * @see .constitution/18-cache-policy.md
 */

import type { IConfig }        from '../../interfaces/IConfig.js';
import type { ISOTimestamp }   from '../../types/common.types.js';
import { nowISO }              from '../../types/common.types.js';

// ─── CacheEntry ───────────────────────────────────────────────────────────────

/**
 * A stored cache entry: the validated configuration plus provenance metadata.
 *
 * The metadata (cachedAt) is intentionally minimal — the cache is not an
 * audit trail. It exists to support diagnostics and health checks.
 */
export interface CacheEntry {
  /** The validated, immutable configuration object. */
  readonly config: IConfig;

  /** ISO 8601 timestamp of when this entry was stored. */
  readonly cachedAt: ISOTimestamp;
}

// ─── ConfigCache ──────────────────────────────────────────────────────────────

/**
 * Holds the single validated IConfig instance for the application lifetime.
 *
 * Design:
 *   - One entry at a time — no eviction, no TTL, no size limit.
 *   - Write-once semantics under normal operation (set once, read many).
 *   - set() overwrites any previous entry — there is no "add-if-absent" guard;
 *     ConfigProvider ensures load-once semantics at a higher level.
 *
 * Thread-safety:
 *   Node.js is single-threaded; concurrent write races are not possible.
 *   No locking is necessary.
 */
export class ConfigCache {
  private entry: CacheEntry | null = null;

  // ─── Query ─────────────────────────────────────────────────────────────

  /**
   * Returns true if a validated config is currently held in the cache.
   * False means the application must call load before serving config.
   */
  has(): boolean {
    return this.entry !== null;
  }

  /**
   * Returns the full cache entry (config + metadata), or null if empty.
   * Prefer getConfig() when only the IConfig is needed.
   */
  get(): CacheEntry | null {
    return this.entry;
  }

  /**
   * Returns the validated IConfig directly, or null if the cache is empty.
   * This is the standard accessor for ConfigProvider.
   */
  getConfig(): IConfig | null {
    return this.entry?.config ?? null;
  }

  /**
   * ISO 8601 timestamp of the last successful cache population.
   * Null if the cache has never been populated.
   * Exposed via IConfigProvider.loadedAt for diagnostics.
   */
  get cachedAt(): ISOTimestamp | null {
    return this.entry?.cachedAt ?? null;
  }

  // ─── Mutation ──────────────────────────────────────────────────────────

  /**
   * Store a validated config in the cache, recording the current timestamp.
   * Overwrites any previously stored entry.
   *
   * @param config - A fully-validated, immutable IConfig instance.
   */
  set(config: IConfig): void {
    this.entry = Object.freeze({
      config,
      cachedAt: nowISO(),
    });
  }

  /**
   * Clear the cached entry, forcing the next get() to trigger a full reload.
   *
   * Permitted callers:
   *   - ConfigProvider.reload() — for forced reloads (secret rotation).
   *   - Test teardown — to reset state between test runs.
   *
   * Normal application code MUST NOT call this method.
   */
  invalidate(): void {
    this.entry = null;
  }
}
