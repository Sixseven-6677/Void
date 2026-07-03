/**
 * @file RequiredKeys.ts
 * @description Canonical list of environment variable keys required to start Void.
 *
 * This is the single source of truth for which keys MUST be present before
 * the application is allowed to start. EnvironmentLoader uses this list to
 * perform an early existence check — before ConfigValidator does its deeper
 * type-and-format validation.
 *
 * Why two layers of required-key checking?
 *   - EnvironmentLoader checks EXISTENCE (is the key present in any source?).
 *     It fails immediately with a full list of ALL missing keys at once.
 *   - ConfigValidator checks CORRECTNESS (is the value a valid integer?
 *     Is NODE_ENV one of the accepted literals?). It fails on the first bad value.
 *
 *   Having the loader check first means operators see ALL missing keys in one
 *   error instead of fixing them one-by-one as the validator discovers each.
 *
 * RULE: Add a key here when it is required for the system to boot.
 *       Do NOT add keys that are optional or have safe defaults.
 * RULE: Keep this in sync with ConfigValidator's requireString() calls.
 * RULE: No business logic — this is a pure constant declaration.
 *
 * @see EnvironmentLoader — consumes this list for the existence guard
 * @see ConfigValidator   — performs the deeper validation of these keys
 */

// ─── VOID_REQUIRED_KEYS ───────────────────────────────────────────────────────

/**
 * The complete set of environment variable keys that MUST be defined for
 * the Void application to start successfully.
 *
 * Any key absent from all configured sources (files + process.env) will
 * cause EnvironmentLoader to throw a ConfigError listing all missing keys
 * before any other initialisation proceeds.
 */
export const VOID_REQUIRED_KEYS = [
  // Facebook integration — secrets, must not be logged
  'FACEBOOK_PAGE_ACCESS_TOKEN',
  'FACEBOOK_APP_SECRET',
  'FACEBOOK_VERIFY_TOKEN',

  // Persistence
  'DATABASE_URL',

  // Cache
  'REDIS_URL',

  // Session security
  'SESSION_ENCRYPTION_KEY',
] as const satisfies readonly string[];

/**
 * TypeScript type derived from the required-keys tuple.
 * Useful for typed exhaustiveness checks or documentation.
 */
export type RequiredKey = typeof VOID_REQUIRED_KEYS[number];
