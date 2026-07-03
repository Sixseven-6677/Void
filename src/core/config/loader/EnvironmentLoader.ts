/**
 * @file EnvironmentLoader.ts
 * @description Orchestrates .env file loading, existence checks, and required-key validation.
 *
 * EnvironmentLoader is the top-level entry point for file-based configuration.
 * It composes EnvFileLoader (I/O) and an existence guard (required key check)
 * into a single IConfigSource that fails loudly and early when the environment
 * is not ready for the application to start.
 *
 * Pipeline executed inside read():
 *
 *   EnvFileDescriptor[]
 *        ↓
 *   EnvFileLoader.read()          — check file existence, parse content, merge
 *        ↓  RawConfigMap
 *   _assertRequiredKeysPresent()  — scan for missing required keys, throw with full list
 *        ↓  RawConfigMap (validated for presence only)
 *   return to ConfigLoader         — downstream ConfigValidator handles type checking
 *
 * RULE: No business logic — this class only knows about configuration structure,
 *       not about what the application does with the values.
 * RULE: Required-key failures list ALL missing keys at once, not one at a time.
 *       Operators must not fix keys one-by-one; they get the complete picture.
 * RULE: No process.env access — add EnvironmentSource alongside this in ConfigProvider
 *       if process.env values should also be considered.
 * RULE: No type coercion or format validation — ConfigValidator handles that.
 *
 * Standard usage inside a bootstrap entry point:
 * ```ts
 * import { buildConfig }         from '@void/core';
 * import { EnvironmentLoader }   from '@void/core/config/loader';
 * import { VOID_REQUIRED_KEYS }  from '@void/core/config/loader';
 * import { EnvironmentSource }   from '@void/core';
 *
 * const provider = new ConfigProvider([
 *   new EnvironmentLoader({
 *     files: [
 *       { path: '.env',       required: false },  // base defaults (committed)
 *       { path: '.env.local', required: false },  // local overrides (gitignored)
 *     ],
 *     requiredKeys: VOID_REQUIRED_KEYS,
 *   }),
 *   new EnvironmentSource(),  // process.env overrides everything
 * ]);
 * ```
 *
 * @see EnvFileLoader    — handles the file I/O and per-file existence checks
 * @see VOID_REQUIRED_KEYS — the canonical list of required keys for Void
 * @see IConfigSource    — the interface this class implements
 * @see ConfigProvider   — the consumer that calls read() via ConfigLoader
 */

import { ConfigError }            from '../../errors/ConfigError.js';
import type { IConfigSource, RawConfigMap } from '../sources/IConfigSource.js';
import { EnvFileLoader }          from './EnvFileLoader.js';
import type { EnvFileDescriptor } from './EnvFileLoader.js';

// ─── EnvironmentLoaderOptions ─────────────────────────────────────────────────

/**
 * Configuration for EnvironmentLoader.
 */
export interface EnvironmentLoaderOptions {
  /**
   * Ordered list of .env files to load.
   * Files are merged left-to-right — later files override earlier ones.
   * Must contain at least one entry.
   */
  readonly files: readonly EnvFileDescriptor[];

  /**
   * Keys that MUST be present in the merged result.
   *
   * If any key in this list is absent or blank after merging all files,
   * EnvironmentLoader throws a ConfigError that lists ALL missing keys.
   *
   * Use VOID_REQUIRED_KEYS for the canonical set, or pass a subset
   * for environments where only some keys are mandatory.
   *
   * Default: [] (no required-key check performed).
   */
  readonly requiredKeys?: readonly string[];
}

// ─── EnvironmentLoader ────────────────────────────────────────────────────────

/**
 * Loads .env files, checks their existence, and guards against missing required keys.
 *
 * This is the recommended source for file-based configuration in production
 * and local development. Compose it with EnvironmentSource to give process.env
 * the highest priority:
 *
 *   [EnvironmentLoader] → [EnvironmentSource] → ConfigLoader → ConfigValidator
 */
export class EnvironmentLoader implements IConfigSource {
  readonly name: string;

  private readonly fileLoader:   EnvFileLoader;
  private readonly requiredKeys: readonly string[];

  constructor(options: EnvironmentLoaderOptions) {
    this.fileLoader   = new EnvFileLoader(options.files);
    this.requiredKeys = options.requiredKeys ?? [];

    // Derive a descriptive name from the file list for diagnostic output.
    const filePaths = options.files.map((f) => f.path).join(', ');
    this.name = `environment-loader:[${filePaths}]`;
  }

  // ─── IConfigSource ─────────────────────────────────────────────────────

  /**
   * Load all configured .env files, merge them, then assert required keys.
   *
   * Steps:
   *   1. EnvFileLoader reads each file (required → throw, optional → skip).
   *   2. Parsed values are merged in file priority order.
   *   3. All configured requiredKeys are checked for presence.
   *      If any are missing, throw ONE ConfigError listing all of them.
   *   4. Return the merged, frozen RawConfigMap.
   *
   * @throws ConfigError (CONFIG_LOAD_FAILED)              — file is required and missing.
   * @throws ConfigError (CONFIG_REQUIRED_VARIABLE_MISSING) — one or more required keys absent.
   */
  async read(): Promise<RawConfigMap> {
    // Step 1 + 2: I/O + merge.
    const raw = await this.fileLoader.read();

    // Step 3: required-key existence guard.
    this.assertRequiredKeysPresent(raw);

    // Step 4: return.
    return raw;
  }

  // ─── Private ───────────────────────────────────────────────────────────

  /**
   * Scan the merged map for absent or blank required keys.
   *
   * All missing keys are collected before throwing — the operator sees the
   * complete list in one error, not a sequence of one-at-a-time failures.
   *
   * @throws ConfigError (CONFIG_REQUIRED_VARIABLE_MISSING) if any key is missing.
   */
  private assertRequiredKeysPresent(raw: RawConfigMap): void {
    if (this.requiredKeys.length === 0) return;

    const missing: string[] = [];

    for (const key of this.requiredKeys) {
      const value = raw[key];
      if (value === undefined || value.trim() === '') {
        missing.push(key);
      }
    }

    if (missing.length === 0) return;

    throw new ConfigError(
      'CONFIG_REQUIRED_VARIABLE_MISSING',
      `The application cannot start. The following required environment ` +
      `variable${missing.length === 1 ? ' is' : 's are'} missing or empty:\n` +
      missing.map((k) => `  • ${k}`).join('\n') + '\n' +
      'Set the missing variables in your .env file or in the process environment.',
      {
        context: {
          missingKeys:  missing,
          totalMissing: missing.length,
          // Key names are safe to expose; values are never logged here.
        },
      },
    );
  }
}
