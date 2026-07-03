/**
 * @file ConfigValidator.ts
 * @description Transforms a raw key-value map into a fully-typed, validated IConfig.
 *
 * The validator is the second stage of the Configuration Engine pipeline:
 *
 *   [Sources] → ConfigLoader → [Raw Map] → ConfigValidator → [IConfig] → ConfigCache
 *
 * Responsibilities:
 *   - Know which keys are required vs optional.
 *   - Coerce raw strings to their correct types (number, union literal).
 *   - Apply defaults for optional fields.
 *   - Throw ConfigError immediately for missing or malformed required values.
 *
 * RULE: The validator does NOT read from any source directly — it works only
 *       on the RawConfigMap it receives from ConfigLoader.
 * RULE: Fail-fast: the first invalid or missing required key throws immediately.
 *       The application MUST NOT start with incomplete or malformed configuration.
 * RULE: Secret values (tokens, keys, passwords) must NEVER appear in error messages,
 *       log output, or error context. Only key names are safe to expose.
 * RULE: The returned IConfig is frozen — no field may be mutated after validation.
 *
 * @see IConfig        — the typed output contract
 * @see ConfigLoader   — the upstream supplier of the raw map
 * @see ConfigCache    — the downstream consumer of the validated IConfig
 * @see .constitution/07-error-handling.md
 */

import { ConfigError } from '../../errors/ConfigError.js';
import type {
  CacheConfig,
  DatabaseConfig,
  FacebookConfig,
  IConfig,
  ServerConfig,
  SessionConfig,
} from '../../interfaces/IConfig.js';
import type { RawConfigMap } from '../sources/IConfigSource.js';

// ─── ConfigValidator ──────────────────────────────────────────────────────────

/**
 * Validates a RawConfigMap and returns a fully-typed, immutable IConfig.
 *
 * Each section of IConfig has a dedicated private method that extracts,
 * coerces, and validates its own keys. The top-level validate() method
 * composes all sections and returns the frozen result.
 *
 * The validator is stateless and side-effect-free — it may be called
 * any number of times with different raw maps (e.g. during reload).
 */
export class ConfigValidator {

  /**
   * Validate the raw map and produce a typed, frozen IConfig.
   *
   * @param raw - A frozen RawConfigMap from ConfigLoader.
   * @returns   A fully-validated, frozen IConfig.
   * @throws ConfigError if any required key is missing or any value is malformed.
   */
  validate(raw: RawConfigMap): IConfig {
    const server   = this.validateServerConfig(raw);
    const facebook = this.validateFacebookConfig(raw);
    const database = this.validateDatabaseConfig(raw);
    const cache    = this.validateCacheConfig(raw);
    const session  = this.validateSessionConfig(raw);

    return Object.freeze<IConfig>({
      server,
      facebook,
      database,
      cache,
      session,
      isProduction:  server.nodeEnv === 'production',
      isDevelopment: server.nodeEnv === 'development',
      isTest:        server.nodeEnv === 'test',
    });
  }

  // ─── Section Validators ───────────────────────────────────────────────

  private validateServerConfig(raw: RawConfigMap): ServerConfig {
    return Object.freeze<ServerConfig>({
      port:             this.optionalInt(raw, 'PORT', 3_000),
      nodeEnv:          this.requireNodeEnv(raw),
      maxBodySizeBytes: this.optionalInt(raw, 'MAX_BODY_SIZE_BYTES', 1_048_576),
    });
  }

  private validateFacebookConfig(raw: RawConfigMap): FacebookConfig {
    return Object.freeze<FacebookConfig>({
      pageAccessToken: this.requireString(raw, 'FACEBOOK_PAGE_ACCESS_TOKEN', { secret: true }),
      appSecret:       this.requireString(raw, 'FACEBOOK_APP_SECRET',        { secret: true }),
      verifyToken:     this.requireString(raw, 'FACEBOOK_VERIFY_TOKEN',      { secret: true }),
      apiVersion:      this.optionalString(raw, 'FACEBOOK_API_VERSION',  'v19.0'),
      apiBaseUrl:      this.optionalString(raw, 'FACEBOOK_API_BASE_URL', 'https://graph.facebook.com'),
    });
  }

  private validateDatabaseConfig(raw: RawConfigMap): DatabaseConfig {
    return Object.freeze<DatabaseConfig>({
      connectionUrl:  this.requireString(raw, 'DATABASE_URL', { secret: true }),
      maxConnections: this.optionalInt(raw,   'DB_MAX_CONNECTIONS', 10),
      idleTimeoutMs:  this.optionalInt(raw,   'DB_IDLE_TIMEOUT_MS', 30_000),
    });
  }

  private validateCacheConfig(raw: RawConfigMap): CacheConfig {
    return Object.freeze<CacheConfig>({
      connectionUrl:     this.requireString(raw, 'REDIS_URL', { secret: true }),
      keyPrefix:         this.optionalString(raw, 'CACHE_KEY_PREFIX',          'void:'),
      defaultTtlSeconds: this.optionalInt(raw,   'CACHE_DEFAULT_TTL_SECONDS', 300),
    });
  }

  private validateSessionConfig(raw: RawConfigMap): SessionConfig {
    return Object.freeze<SessionConfig>({
      ttlSeconds:    this.optionalInt(raw,   'SESSION_TTL_SECONDS',    3_600),
      encryptionKey: this.requireString(raw, 'SESSION_ENCRYPTION_KEY', { secret: true }),
    });
  }

  // ─── Primitive Extractors ─────────────────────────────────────────────

  /**
   * Read a required string key.
   *
   * @param options.secret - When true, signals that the value is a secret.
   *   The key name is safe to include in error messages; the value is not.
   *   This flag also prevents accidental logging of the value elsewhere.
   *
   * @throws ConfigError (CONFIG_REQUIRED_VARIABLE_MISSING) if absent or blank.
   */
  private requireString(
    raw: RawConfigMap,
    key: string,
    options: { secret?: boolean } = {},
  ): string {
    const value = raw[key];

    if (value === undefined || value.trim() === '') {
      throw new ConfigError(
        'CONFIG_REQUIRED_VARIABLE_MISSING',
        `Required configuration key "${key}" is missing or empty. ` +
        `The application cannot start without it.` +
        (options.secret === true
          ? ' (This key holds a secret — its value must never be logged.)'
          : ''),
        {
          context: {
            key,
            isSecret: options.secret ?? false,
            // Never include the value itself, even if it's blank.
          },
        },
      );
    }

    return value.trim();
  }

  /**
   * Read an optional string key.
   * Returns the trimmed value if present and non-blank, or the fallback otherwise.
   */
  private optionalString(raw: RawConfigMap, key: string, fallback: string): string {
    const value = raw[key];
    return value !== undefined && value.trim() !== '' ? value.trim() : fallback;
  }

  /**
   * Read an optional integer key.
   * Returns the parsed value if present, or the fallback if absent/blank.
   *
   * @throws ConfigError (CONFIG_INVALID_VALUE) if present but not a valid integer.
   */
  private optionalInt(raw: RawConfigMap, key: string, fallback: number): number {
    const value = raw[key];
    if (value === undefined || value.trim() === '') return fallback;

    const trimmed = value.trim();
    const parsed  = parseInt(trimmed, 10);

    if (isNaN(parsed)) {
      throw new ConfigError(
        'CONFIG_INVALID_VALUE',
        `Configuration key "${key}" must be a valid integer. Received: "${trimmed}".`,
        { context: { key, received: trimmed } },
      );
    }

    return parsed;
  }

  /**
   * Read and validate NODE_ENV.
   * Defaults to 'development' if absent. Throws for unrecognised values.
   *
   * @throws ConfigError (CONFIG_INVALID_VALUE) if the value is not an accepted literal.
   */
  private requireNodeEnv(raw: RawConfigMap): 'development' | 'production' | 'test' {
    const value = this.optionalString(raw, 'NODE_ENV', 'development');

    if (value !== 'development' && value !== 'production' && value !== 'test') {
      throw new ConfigError(
        'CONFIG_INVALID_VALUE',
        `NODE_ENV must be one of: "development", "production", "test". Received: "${value}".`,
        { context: { key: 'NODE_ENV', received: value, allowed: ['development', 'production', 'test'] } },
      );
    }

    return value;
  }
}
