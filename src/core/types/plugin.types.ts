/**
 * @file plugin.types.ts
 * @description Domain types for the Plugin System.
 *
 * RULE: Plugins are isolated — errors in a plugin MUST NOT propagate to Core.
 * RULE: Plugins communicate with Core exclusively through PluginContext.
 * RULE: Plugin events must be declared in the manifest before emission.
 * RULE: Plugin commands must use the `<pluginId>-` namespace prefix.
 *
 * @see 12-plugin-system.md
 */

import type { EventType } from './event.types.js';
import type { ISOTimestamp, PluginId } from './common.types.js';
import type { CommandName } from './common.types.js';

// ─── Plugin Status ────────────────────────────────────────────────────────────

/** Current operational state of a plugin. */
export type PluginStatus =
  | 'REGISTERED'   // declared but not yet initialized
  | 'LOADING'      // init in progress
  | 'ACTIVE'       // running normally
  | 'DISABLED'     // operator-disabled
  | 'FAILED'       // failed during load or init
  | 'UNLOADING';   // graceful teardown in progress

// ─── Plugin Permission ────────────────────────────────────────────────────────

/**
 * Capability grants a plugin must declare in its manifest.
 * Attempting to use an undeclared capability is rejected at runtime.
 */
export type PluginPermission =
  | 'events.publish.*'
  | 'events.subscribe.*'
  | 'commands.register'
  | 'session.read'
  | 'session.write'
  | 'user.read'
  | 'cache.read'
  | 'cache.write'
  | 'scheduler.enqueue';

// ─── Plugin Manifest ──────────────────────────────────────────────────────────

/**
 * Static declaration of a plugin's identity, capabilities, and dependencies.
 * Validated by the PluginRegistry at registration time.
 */
export interface PluginManifest {
  /** Unique plugin identifier — used for namespacing events and commands. */
  readonly id: PluginId;

  /** Human-readable display name. */
  readonly name: string;

  /** Semantic version string. */
  readonly version: string;

  /** Short description of what this plugin does. */
  readonly description: string;

  /** Capabilities this plugin requires. Any undeclared capability is denied. */
  readonly permissions: readonly PluginPermission[];

  /**
   * Event types this plugin may emit.
   * Must follow pattern `plugin.<pluginId>.<eventName>`.
   * Attempts to emit undeclared event types are rejected.
   */
  readonly supportedEvents: readonly EventType[];

  /**
   * Command names this plugin registers.
   * Must use `<pluginId>-` namespace prefix.
   */
  readonly commands: readonly CommandName[];

  /** IDs of other plugins this plugin depends on. */
  readonly dependencies: readonly PluginId[];
}

// ─── Plugin Lifecycle ─────────────────────────────────────────────────────────

/**
 * The interface a plugin implementation must satisfy.
 *
 * RULE: The plugin system calls these lifecycle hooks — plugins do not
 *       call each other's lifecycle methods directly.
 */
export interface IPlugin {
  /** The plugin's static manifest declaration. */
  readonly manifest: PluginManifest;

  /**
   * Called once by the PluginRegistry during plugin activation.
   * The plugin receives its restricted PluginContext here.
   * If this throws, the plugin enters FAILED state.
   */
  initialize(context: PluginContext): Promise<void>;

  /**
   * Called by the PluginRegistry during graceful shutdown or disable.
   * The plugin must release all resources and deregister subscriptions.
   */
  destroy(): Promise<void>;
}

// ─── Plugin Context ───────────────────────────────────────────────────────────

/**
 * The restricted API surface exposed to a plugin at runtime.
 * Plugins interact with the system exclusively through this context.
 *
 * RULE: PluginContext enforces the plugin's declared permissions.
 *       Calling a method the plugin does not have permission for throws.
 * RULE: No direct imports from Core, Services, or Repositories in plugin code.
 */
export interface PluginContext {
  /** The plugin's own manifest for self-reference. */
  readonly manifest: PluginManifest;

  // ─── Events ────────────────────────────────────────────────────────────

  /**
   * Emit an event through the EventDispatcher.
   * Requires `events.publish.*` permission.
   * The event type must be declared in `manifest.supportedEvents`.
   */
  emitEvent(type: EventType, payload: unknown): Promise<void>;

  /**
   * Subscribe to an event type.
   * Requires `events.subscribe.*` permission.
   * Returns a deregistration function — MUST be called in `destroy()`.
   */
  onEvent(
    type: EventType,
    handler: (payload: unknown) => Promise<void>,
  ): () => void;

  // ─── Logger ─────────────────────────────────────────────────────────────

  /**
   * Scoped logger for this plugin.
   * All log entries are automatically tagged with the plugin ID.
   */
  readonly log: PluginLogger;
}

// ─── Plugin Logger ────────────────────────────────────────────────────────────

/** Restricted logger surface exposed to plugins — mirrors ILogger shape. */
export interface PluginLogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

// ─── Plugin Registration Entry ────────────────────────────────────────────────

/** An entry in the PluginRegistry tracking a plugin and its runtime state. */
export interface PluginRegistryEntry {
  readonly plugin: IPlugin;
  readonly status: PluginStatus;
  readonly registeredAt: ISOTimestamp;
  readonly activatedAt: ISOTimestamp | null;
  readonly failureReason: string | null;
}
