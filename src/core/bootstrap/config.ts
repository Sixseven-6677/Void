/**
 * @file config.ts
 * @description Application configuration loader and validator.
 *
 * RULE: Configuration is loaded ONCE at startup and validated immediately.
 * RULE: Any missing required variable causes a ConfigError — the application
 *       MUST NOT start with incomplete configuration.
 * RULE: Config values are read-only after load.
 * RULE: This file reads process.env directly — it is the ONLY place in the
 *       application that may do so. All other code uses IConfig.
 * RULE: Secrets (tokens, keys) must NEVER appear in log output.
 *
 * @see 27-roadmap.md §3 (Phase 0 — Foundation)
 */

import { ConfigError } from '../errors/ConfigError.js';
import type {
  CacheConfig,
  DatabaseConfig,
  FacebookConfig,
  IConfig,
  ServerConfig,
  SessionConfig,
} from '../interfaces/IConfig.js';

// ─── Env Helpers ──────────────────────────────────────────────────────────────

/**
 * Read a required string environment variable.
 * Throws ConfigError immediately if the variable is absent or empty.
 */
function requireString(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new ConfigError(
      'CONFIG_REQUIRED_VARIABLE_MISSING',
      `Required environment variable "${key}" is missing or empty. ` +
      'The application cannot start without it.',
      { context: { variable: key } },
    );
  }
  return value.trim();
}

/**
 * Read an optional string environment variable with a fallback.
 */
function optionalString(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

/**
 * Read a required integer environment variable.
 * Throws ConfigError if the variable is absent, empty, or not a valid integer.
 */
function requireInt(key: string): number {
  const raw = requireString(key);
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new ConfigError(
      'CONFIG_INVALID_VALUE',
      `Environment variable "${key}" must be a valid integer, received: "${raw}".`,
      { context: { variable: key } },
    );
  }
  return parsed;
}

/**
 * Read an optional integer environment variable with a fallback.
 */
function optionalInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value || value.trim() === '') return fallback;
  const parsed = parseInt(value.trim(), 10);
  if (isNaN(parsed)) {
    throw new ConfigError(
      'CONFIG_INVALID_VALUE',
      `Environment variable "${key}" must be a valid integer, received: "${value}".`,
      { context: { variable: key } },
    );
  }
  return parsed;
}

/**
 * Validate that NODE_ENV is one of the accepted values.
 */
function requireNodeEnv(): 'development' | 'production' | 'test' {
  const raw = optionalString('NODE_ENV', 'development');
  if (raw !== 'development' && raw !== 'production' && raw !== 'test') {
    throw new ConfigError(
      'CONFIG_INVALID_VALUE',
      `NODE_ENV must be one of: development, production, test. Received: "${raw}".`,
      { context: { variable: 'NODE_ENV', received: raw } },
    );
  }
  return raw;
}

// ─── AppConfig ────────────────────────────────────────────────────────────────

/**
 * Concrete implementation of IConfig.
 * Loaded once at startup — all fields are readonly.
 */
class AppConfig implements IConfig {
  readonly server: ServerConfig;
  readonly facebook: FacebookConfig;
  readonly database: DatabaseConfig;
  readonly cache: CacheConfig;
  readonly session: SessionConfig;

  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;

  constructor() {
    const nodeEnv = requireNodeEnv();

    this.server = {
      port: optionalInt('PORT', 3000),
      nodeEnv,
      maxBodySizeBytes: optionalInt('MAX_BODY_SIZE_BYTES', 1_048_576), // 1MB
    };

    this.facebook = {
      pageAccessToken: requireString('FACEBOOK_PAGE_ACCESS_TOKEN'),
      appSecret:       requireString('FACEBOOK_APP_SECRET'),
      verifyToken:     requireString('FACEBOOK_VERIFY_TOKEN'),
      apiVersion:      optionalString('FACEBOOK_API_VERSION', 'v19.0'),
      apiBaseUrl:      optionalString('FACEBOOK_API_BASE_URL', 'https://graph.facebook.com'),
    };

    this.database = {
      connectionUrl:  requireString('DATABASE_URL'),
      maxConnections: optionalInt('DB_MAX_CONNECTIONS', 10),
      idleTimeoutMs:  optionalInt('DB_IDLE_TIMEOUT_MS', 30_000),
    };

    this.cache = {
      connectionUrl:      requireString('REDIS_URL'),
      keyPrefix:          optionalString('CACHE_KEY_PREFIX', 'void:'),
      defaultTtlSeconds:  optionalInt('CACHE_DEFAULT_TTL_SECONDS', 300),
    };

    this.session = {
      ttlSeconds:    optionalInt('SESSION_TTL_SECONDS', 3_600), // 1 hour
      encryptionKey: requireString('SESSION_ENCRYPTION_KEY'),
    };

    this.isProduction  = nodeEnv === 'production';
    this.isDevelopment = nodeEnv === 'development';
    this.isTest        = nodeEnv === 'test';
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Load and validate application configuration from environment variables.
 *
 * Called once during bootstrap. Throws ConfigError immediately if any
 * required variable is missing or malformed — the application must not
 * start with invalid configuration.
 */
export function loadConfig(): IConfig {
  return new AppConfig();
}
