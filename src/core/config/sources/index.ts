/**
 * @file sources/index.ts
 * @description Barrel export for configuration sources.
 *
 * Import pattern:
 *   import type { IConfigSource, RawConfigMap } from '@void/core/config/sources';
 *   import { EnvironmentSource } from '@void/core/config/sources';
 */

export type { IConfigSource, RawConfigMap } from './IConfigSource.js';
export { EnvironmentSource }               from './EnvironmentSource.js';
