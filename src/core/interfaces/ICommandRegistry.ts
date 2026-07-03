/**
 * @file ICommandRegistry.ts
 * @description Contract for the Command Registry — the authoritative catalog
 *              of all registered commands in the system.
 *
 * RULE: Every command must be registered before it can be invoked.
 * RULE: Plugin commands must use the `<pluginId>-` namespace prefix.
 * RULE: Registry lookups must be O(1) — no linear scans.
 * RULE: Plugin commands are deregistered when the plugin is disabled.
 *
 * @see 13-command-system.md
 */

import type {
  CommandHandler,
  CommandMetadata,
  RegisteredCommand,
} from '../types/command.types.js';
import type { CommandName, PluginId } from '../types/common.types.js';

// ─── ICommandRegistry ─────────────────────────────────────────────────────────

/**
 * Authoritative registry of all commands in the Void system.
 * The Command Bus queries this registry during the resolution phase.
 */
export interface ICommandRegistry {
  /**
   * Register a command with its metadata and handler.
   *
   * @throws CommandError with COMMAND_ALREADY_REGISTERED if the canonical
   *         name or any alias conflicts with an existing registration.
   */
  register(
    metadata: CommandMetadata,
    handler: CommandHandler,
  ): void;

  /**
   * Resolve a command by name or alias.
   * Returns null if no command matches the given name.
   * Lookup is O(1) — aliases are indexed at registration time.
   */
  resolve(nameOrAlias: string): RegisteredCommand | null;

  /**
   * Remove a command registration by its canonical name.
   * Also removes all alias index entries for this command.
   * Used when a plugin is disabled or uninstalled.
   *
   * @returns true if the command was found and removed, false otherwise.
   */
  deregister(name: CommandName): boolean;

  /**
   * Remove all commands registered by a specific plugin.
   * Called by the PluginRegistry when a plugin is disabled.
   *
   * @returns the number of commands deregistered.
   */
  deregisterAllForPlugin(pluginId: PluginId): number;

  /**
   * Check whether a command name or alias is already registered.
   */
  has(nameOrAlias: string): boolean;

  /**
   * List all registered commands.
   * Returns a snapshot — mutations to the registry do not affect the result.
   */
  listAll(): readonly RegisteredCommand[];

  /**
   * List all commands registered by a specific plugin.
   */
  listByPlugin(pluginId: PluginId): readonly RegisteredCommand[];

  /**
   * Total number of registered commands.
   */
  readonly size: number;
}
