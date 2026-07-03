/**
 * @file engine/index.ts
 * @description Barrel export for the Configuration Engine internals.
 *
 * The engine components (Loader, Validator, Cache) are intentionally
 * internal to the config package. External code should interact only
 * through IConfigProvider and ConfigProvider.
 *
 * Import pattern (for internal config package use only):
 *   import { ConfigLoader }    from './engine/index.js';
 *   import { ConfigValidator } from './engine/index.js';
 *   import { ConfigCache }     from './engine/index.js';
 */

export { ConfigCache, type CacheEntry }  from './ConfigCache.js';
export { ConfigLoader }                  from './ConfigLoader.js';
export { ConfigValidator }               from './ConfigValidator.js';
