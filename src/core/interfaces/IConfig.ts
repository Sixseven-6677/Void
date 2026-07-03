/**
 * @file IConfig.ts
 * @description Contract for application configuration access.
 *
 * RULE: Configuration is loaded and validated once at startup.
 *       If any required variable is missing, the application MUST fail loudly.
 *       Silent defaults for required configuration are forbidden.
 * RULE: Config values are read-only after load — no runtime mutation.
 * RULE: Secrets (tokens, keys) are accessed through Config, never via
 *       process.env directly in application code.
 *
 * @see 27-roadmap.md Phase 0 (Config Loader)
 */

// ─── Server Config ────────────────────────────────────────────────────────────

export interface ServerConfig {
  /** The port the HTTP server listens on. */
  readonly port: number;

  /** The environment the application runs in. */
  readonly nodeEnv: 'development' | 'production' | 'test';

  /** Maximum request body size in bytes. */
  readonly maxBodySizeBytes: number;
}

// ─── Facebook Config ──────────────────────────────────────────────────────────

export interface FacebookConfig {
  /**
   * Facebook Page Access Token for sending messages.
   * MUST NOT be logged.
   */
  readonly pageAccessToken: string;

  /**
   * Facebook App Secret for verifying webhook signatures.
   * MUST NOT be logged.
   */
  readonly appSecret: string;

  /**
   * Token used to verify the webhook during Facebook's verification handshake.
   * MUST NOT be logged.
   */
  readonly verifyToken: string;

  /** Facebook Graph API version (e.g. 'v19.0'). */
  readonly apiVersion: string;

  /** Base URL for the Facebook Graph API. */
  readonly apiBaseUrl: string;
}

// ─── Database Config ──────────────────────────────────────────────────────────

export interface DatabaseConfig {
  /**
   * Full PostgreSQL connection string.
   * MUST NOT be logged.
   */
  readonly connectionUrl: string;

  /** Maximum number of connections in the pool. */
  readonly maxConnections: number;

  /** Connection idle timeout in milliseconds. */
  readonly idleTimeoutMs: number;
}

// ─── Cache Config ─────────────────────────────────────────────────────────────

export interface CacheConfig {
  /**
   * Redis connection URL.
   * MUST NOT be logged.
   */
  readonly connectionUrl: string;

  /** Key prefix applied to all cache entries. Prevents namespace collisions. */
  readonly keyPrefix: string;

  /** Default TTL in seconds for cache entries. */
  readonly defaultTtlSeconds: number;
}

// ─── Session Config ───────────────────────────────────────────────────────────

export interface SessionConfig {
  /** Session TTL in seconds before automatic expiry. */
  readonly ttlSeconds: number;

  /**
   * Encryption key for session data at rest.
   * MUST NOT be logged.
   */
  readonly encryptionKey: string;
}

// ─── IConfig ──────────────────────────────────────────────────────────────────

/**
 * Application configuration contract.
 * Provides typed, read-only access to all configuration sections.
 *
 * Implementations must validate all required fields at construction time
 * and throw ConfigError with code CONFIG_REQUIRED_VARIABLE_MISSING
 * for any absent required value.
 */
export interface IConfig {
  readonly server: ServerConfig;
  readonly facebook: FacebookConfig;
  readonly database: DatabaseConfig;
  readonly cache: CacheConfig;
  readonly session: SessionConfig;

  /** Whether the application is running in production mode. */
  readonly isProduction: boolean;

  /** Whether the application is running in development mode. */
  readonly isDevelopment: boolean;

  /** Whether the application is running in test mode. */
  readonly isTest: boolean;
}
