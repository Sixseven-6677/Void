/**
 * @file command.types.ts
 * @description Domain types for the Command System.
 *
 * RULE: Command handlers are entry points only — they read context,
 *       call one Service, and return. No business logic in handlers.
 * RULE: Plugin commands MUST use the `<pluginId>-` namespace prefix.
 *
 * @see 13-command-system.md
 */

import type { CommandName, CorrelationId, PluginId, SessionId, UserId } from './common.types.js';
import type { User } from './user.types.js';
import type { Session } from './session.types.js';

// ─── Permission Level ─────────────────────────────────────────────────────────

/** Minimum permission tier required to invoke a command. */
export type CommandPermissionLevel =
  | 'PUBLIC'      // anyone may invoke
  | 'USER'        // registered users only
  | 'MODERATOR'   // moderators and above
  | 'ADMIN'       // admins and above
  | 'OWNER';      // bot owner only

// ─── Command Source ───────────────────────────────────────────────────────────

/** Whether the command is built-in or contributed by a plugin. */
export type CommandSource = 'CORE' | 'PLUGIN';

// ─── Argument Type ────────────────────────────────────────────────────────────

/** The expected type of a command argument after parsing. */
export type ArgumentType = 'string' | 'number' | 'boolean' | 'user' | 'duration';

// ─── Argument Descriptor ─────────────────────────────────────────────────────

/** Declares one argument accepted by a command. */
export interface ArgumentDescriptor {
  readonly name: string;
  readonly description: string;
  readonly type: ArgumentType;
  readonly required: boolean;
  readonly default?: unknown;
}

// ─── Command Metadata ─────────────────────────────────────────────────────────

/**
 * Static metadata registered with the CommandRegistry for each command.
 * Must be declared before the handler is registered.
 */
export interface CommandMetadata {
  /** Canonical command name — unique across all commands. */
  readonly name: CommandName;

  /** Human-readable description shown in help output. */
  readonly description: string;

  /** Alternative names that invoke this command. */
  readonly aliases: readonly string[];

  /** Minimum permission level required to invoke. */
  readonly permissionLevel: CommandPermissionLevel;

  /** Whether this command is built-in or from a plugin. */
  readonly source: CommandSource;

  /**
   * Plugin ID that registered this command.
   * Present only when source is 'PLUGIN'.
   * Command name must use `<pluginId>-` namespace prefix.
   */
  readonly pluginId?: PluginId;

  /** Whether the command appears in public help output. */
  readonly hidden: boolean;

  /** Whether the command is functional but scheduled for removal. */
  readonly deprecated: boolean;

  /** Warning shown when a deprecated command is invoked. */
  readonly deprecationMessage?: string;

  /** Example invocations shown in help output. */
  readonly examples: readonly string[];

  /** List of accepted arguments in declaration order. */
  readonly arguments: readonly ArgumentDescriptor[];
}

// ─── Command Context ──────────────────────────────────────────────────────────

/**
 * Context passed to a command handler at invocation time.
 * Built by the command pipeline after middleware processing.
 *
 * RULE: Handlers must treat this as read-only.
 */
export interface CommandContext {
  /** The resolved command name (canonical, after alias resolution). */
  readonly commandName: CommandName;

  /** Parsed and type-coerced arguments, keyed by argument name. */
  readonly args: Readonly<Record<string, unknown>>;

  /** Raw argument tokens before parsing — for diagnostic use only. */
  readonly rawArgs: readonly string[];

  /** The user who invoked the command. */
  readonly user: User;

  /** The active session for this conversation. */
  readonly session: Session;

  /** IDs for tracing. */
  readonly userId: UserId;
  readonly sessionId: SessionId;
  readonly correlationId: CorrelationId;
}

// ─── Command Result ───────────────────────────────────────────────────────────

/**
 * The return value of a command handler.
 * Handlers return structured results — they do not format response strings.
 * The Response Builder translates this into a Facebook-deliverable message.
 */
export type CommandResult =
  | { readonly status: 'SUCCESS'; readonly data?: unknown }
  | { readonly status: 'ERROR'; readonly code: string; readonly message: string }
  | { readonly status: 'PERMISSION_DENIED'; readonly requiredLevel: CommandPermissionLevel }
  | { readonly status: 'NOT_FOUND'; readonly resource: string }
  | { readonly status: 'COOLDOWN_ACTIVE'; readonly retryAfterMs: number };

// ─── Command Handler ──────────────────────────────────────────────────────────

/**
 * The implementation function for a command.
 *
 * RULE: Handlers MUST be stateless.
 * RULE: Handlers MUST NOT contain business logic.
 * RULE: Handlers MUST NOT query the database directly.
 * RULE: Handlers MUST NOT call Facebook API directly.
 * RULE: Handlers call one Service and return the result.
 */
export type CommandHandler = (context: CommandContext) => Promise<CommandResult>;

// ─── Registered Command ───────────────────────────────────────────────────────

/** A fully-registered command: metadata + handler together. */
export interface RegisteredCommand {
  readonly metadata: CommandMetadata;
  readonly handler: CommandHandler;
}
