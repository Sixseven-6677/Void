/**
 * @file ICacheClient.ts
 * @description Contract for the cache layer (Cache-Aside pattern).
 *
 * RULE: Cache is a performance optimization — the system MUST function
 *       correctly without it. A cache miss is not an error.
 * RULE: Cache keys must include a version suffix to enable atomic invalidation.
 * RULE: Repositories MUST NOT use the cache — only Services apply Cache-Aside.
 * RULE: Cache entries MUST NOT contain secrets, tokens, or passwords.
 *
 * @see 18-cache-policy.md
 */

// ─── ICacheClient ─────────────────────────────────────────────────────────────

/**
 * Contract for key-value cache operations.
 *
 * Implementations must:
 * - Prepend the configured key prefix to all keys.
 * - Serialize/deserialize values transparently.
 * - Never throw on cache misses — return null instead.
 * - Log (not throw) on transient connection issues, unless the error
 *   is unrecoverable.
 */
export interface ICacheClient {
  /**
   * Retrieve a cached value by key.
   * Returns null on cache miss or deserialization failure.
   * MUST NOT throw for expected misses.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value in the cache.
   *
   * @param key     - Cache key (prefix applied internally).
   * @param value   - Value to store (must be JSON-serializable).
   * @param ttlSecs - Time-to-live in seconds. If omitted, uses the default TTL.
   */
  set<T>(key: string, value: T, ttlSecs?: number): Promise<void>;

  /**
   * Delete a specific cache entry by key.
   * No-op if the key does not exist.
   */
  delete(key: string): Promise<void>;

  /**
   * Delete all cache entries matching a key pattern.
   * Pattern syntax is implementation-specific (e.g. Redis glob patterns).
   * Use with care — a broad pattern can evict many entries.
   *
   * @returns the number of keys deleted.
   */
  deleteByPattern(pattern: string): Promise<number>;

  /**
   * Check whether a key exists in the cache.
   * Returns false for expired or absent keys.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Atomically get a value, or compute and store it if absent.
   * This prevents the cache stampede problem for high-traffic keys.
   *
   * @param key       - Cache key.
   * @param factory   - Async function to compute the value on a miss.
   * @param ttlSecs   - TTL for the stored value.
   */
  getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSecs?: number,
  ): Promise<T>;

  /**
   * Reset the remaining TTL of an existing key.
   * No-op if the key does not exist.
   */
  expire(key: string, ttlSecs: number): Promise<void>;

  /**
   * Gracefully disconnect from the cache backend.
   * Called during application shutdown.
   */
  disconnect(): Promise<void>;

  /**
   * Check whether the cache connection is healthy.
   */
  ping(): Promise<boolean>;
}
