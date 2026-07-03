/**
 * @file loader/index.ts
 * @description Barrel export for the Void Environment Loader.
 *
 * The loader package handles file-based configuration:
 *   - EnvFileDescriptor  — describes a .env file (path + required flag)
 *   - EnvFileLoader      — reads .env files from disk (IConfigSource)
 *   - EnvironmentLoader  — orchestrator: files + required-key guard (IConfigSource)
 *   - VOID_REQUIRED_KEYS — canonical list of keys required to boot Void
 *
 * EnvFileParser is intentionally NOT exported — it is an internal detail
 * of EnvFileLoader. Application code has no reason to parse .env text directly.
 *
 * ─── Typical bootstrap usage ─────────────────────────────────────────────────
 *
 * import { ConfigProvider, EnvironmentSource } from '@void/core';
 * import { EnvironmentLoader, VOID_REQUIRED_KEYS, EnvFileLoader } from '@void/core/config/loader';
 *
 * const provider = new ConfigProvider([
 *   new EnvironmentLoader({
 *     files: [
 *       { path: '.env',       required: false },  // base defaults (committed)
 *       { path: '.env.local', required: false },  // local overrides (gitignored)
 *     ],
 *     requiredKeys: VOID_REQUIRED_KEYS,
 *   }),
 *   new EnvironmentSource(),  // process.env has highest priority
 * ]);
 *
 * const { config, provider: p } = await buildConfig(); // or use provider directly
 */

// ─── File descriptor type ─────────────────────────────────────────────────────
export type { EnvFileDescriptor }             from './EnvFileLoader.js';

// ─── Sources ──────────────────────────────────────────────────────────────────
export { EnvFileLoader }                      from './EnvFileLoader.js';
export { EnvironmentLoader, type EnvironmentLoaderOptions } from './EnvironmentLoader.js';

// ─── Required keys ────────────────────────────────────────────────────────────
export { VOID_REQUIRED_KEYS, type RequiredKey } from './RequiredKeys.js';
