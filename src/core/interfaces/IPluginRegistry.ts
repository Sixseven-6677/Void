/**
 * @file IPluginRegistry.ts
 * @description Contract for the Plugin Registry — manages plugin lifecycle.
 *
 * RULE: Plugin errors MUST be isolated — a failing plugin must not affect Core.
 * RULE: Plugins communicate with Core through PluginContext only.
 * RULE: Plugins must be registered before they can be activated.
 * RULE: A plugin's commands are deregistered when the plugin is disabled.
 *
 * @see 12-plugin-system.md
 */

import type { IPlugin, PluginRegistryEntry, PluginStatus } from '../types/plugin.types.js';
import type { PluginId } from '../types/common.types.js';

// ─── IPluginRegistry ──────────────────────────────────────────────────────────

/**
 * Manages the registration, activation, and teardown of plugins.
 *
 * Lifecycle flow per plugin:
 *   register() → REGISTERED
 *   activate()  → LOADING → ACTIVE | FAILED
 *   disable()   → UNLOADING → DISABLED
 */
export interface IPluginRegistry {
  /**
   * Register a plugin implementation.
   * The plugin's manifest is validated — required fields and permission
   * declarations are checked.
   *
   * @throws PluginError with PLUGIN_ALREADY_REGISTERED if a plugin with
   *         the same ID has already been registered.
   * @throws PluginError with PLUGIN_INVALID_MANIFEST if the manifest
   *         fails validation.
   */
  register(plugin: IPlugin): void;

  /**
   * Activate a registered plugin by calling its `initialize()` lifecycle hook.
   * If initialization throws, the plugin enters FAILED status.
   * Plugin errors during activation are caught — they do not propagate to Core.
   *
   * @returns true if the plugin activated successfully, false if it failed.
   */
  activate(id: PluginId): Promise<boolean>;

  /**
   * Activate all registered plugins in dependency order.
   * Plugins whose dependencies failed to activate are skipped.
   *
   * @returns a map of plugin ID to activation outcome.
   */
  activateAll(): Promise<ReadonlyMap<PluginId, boolean>>;

  /**
   * Disable an active plugin by calling its `destroy()` lifecycle hook.
   * Also deregisters all commands the plugin had registered.
   *
   * @returns true if the plugin was found and disabled, false otherwise.
   */
  disable(id: PluginId): Promise<boolean>;

  /**
   * Disable all active plugins in reverse dependency order.
   * Used during graceful shutdown.
   */
  disableAll(): Promise<void>;

  /**
   * Look up a plugin's registry entry by its ID.
   * Returns null if the plugin is not registered.
   */
  get(id: PluginId): PluginRegistryEntry | null;

  /**
   * Check whether a plugin is registered.
   */
  has(id: PluginId): boolean;

  /**
   * List all registered plugin entries.
   */
  listAll(): readonly PluginRegistryEntry[];

  /**
   * List all plugins currently in a specific status.
   */
  listByStatus(status: PluginStatus): readonly PluginRegistryEntry[];

  /** Total number of registered plugins. */
  readonly size: number;
}
