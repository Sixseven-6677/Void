/**
 * @file IConfigSource.ts
 * @description Contract for a single configuration source.
 *
 * A ConfigSource is any origin that can supply raw key-value pairs to the
 * Configuration Engine. Sources are composable — the ConfigLoader merges
 * multiple sources in priority order.
 *
 * RULE: Sources return raw strings ONLY — no coercion, no defaults, no validation.
 *       Validation is the exclusive responsibility of ConfigValidator.
 * RULE: Sources MUST NOT throw for absent keys — return undefined for missing values.
 * RULE: Only EnvironmentSource may read process.env. Every other source must
 *       read from its own storage medium.
 * RULE: Sources MUST NOT log secret values under any circumstances.
 *
 * Extension points (future sources):
 *   - FileSource       — reads a .env file from disk
 *   - RemoteSource     — pulls from AWS Secrets Manager / Vault / etc.
 *   - TestSource       — injects values in tests without touching process.env
 *
 * @see EnvironmentSource — the ONLY permitted reader of process.env
 * @see ConfigLoader      — orchestrates multiple sources into a merged map
 * @see .constitution/04-dependency-rules.md
 */

// ─── Raw Config Map ───────────────────────────────────────────────────────────

/**
 * The raw output type of every IConfigSource.
 *
 * Keys are environment-style strings (e.g. 'DATABASE_URL').
 * Values are raw strings as-is from the source, or undefined if absent.
 *
 * This is intentionally NOT typed — validation and coercion happen downstream
 * in ConfigValidator.
 */
export type RawConfigMap = Readonly<Record<string, string | undefined>>;

// ─── IConfigSource ────────────────────────────────────────────────────────────

/**
 * A single source of raw configuration key-value pairs.
 *
 * Sources are registered with the ConfigLoader in priority order.
 * When the same key appears in multiple sources, the LAST source wins.
 * This enables layered overrides: base defaults → .env file → process.env.
 */
export interface IConfigSource {
  /**
   * A stable, human-readable name for this source.
   * Used in diagnostic messages and error context — MUST NOT contain secrets.
   * Examples: 'environment', 'dotenv:.env.local', 'vault:prod/void'
   */
  readonly name: string;

  /**
   * Read and return all key-value pairs from this source.
   *
   * Contract:
   *   - MUST return a frozen map — callers must not mutate the result.
   *   - MUST return undefined (not omit) for keys the source cannot supply.
   *   - MUST NOT perform validation or coercion.
   *   - MUST NOT log secret values.
   *   - MAY throw ConfigError (CONFIG_LOAD_FAILED) on unrecoverable I/O errors.
   *   - MUST NOT throw for ordinary missing keys.
   *
   * @returns A frozen raw map of key → string value (or undefined if absent).
   */
  read(): Promise<RawConfigMap>;
}
