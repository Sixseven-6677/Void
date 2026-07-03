/**
 * @file IKernelContext.ts
 * @description The context object passed to every module during its lifecycle hooks.
 *
 * IKernelContext is the minimal, read-only surface that the Kernel exposes to each
 * module during boot, ready, and stop hooks. It gives modules what they need to
 * initialize themselves without exposing Kernel internals.
 *
 * RULE: Modules receive context — they do not reach into the Kernel directly.
 * RULE: Context is read-only — modules must not cache or mutate it.
 * RULE: Context does NOT expose other modules — modules are isolated from each other.
 *       Inter-module dependencies are resolved through the DI container.
 *
 * Design rationale:
 * Passing a context object (instead of individual arguments) to lifecycle hooks
 * makes the API forward-compatible — new fields can be added to the context
 * without changing every hook signature. Modules only destructure what they need.
 */

import type { ILogger } from '../interfaces/ILogger.js';
import type { IConfig } from '../interfaces/IConfig.js';
import type { VoidContainer } from '../container/container.js';
import type { KernelPhase } from './kernel.types.js';

// ─── IKernelContext ───────────────────────────────────────────────────────────

/**
 * Context provided to a module during its lifecycle callbacks.
 *
 * Available during: onBoot, onReady, onStop.
 */
export interface IKernelContext {
  /**
   * Logger scoped to the calling module.
   * All entries automatically include the module name as a field.
   */
  readonly logger: ILogger;

  /**
   * Application configuration — read-only, fully validated at startup.
   * Modules must not attempt to mutate or re-load config.
   */
  readonly config: IConfig;

  /**
   * The DI container — for resolving dependencies declared in tokens.ts.
   *
   * Modules use this to resolve their own dependencies during boot.
   * They must not resolve other modules' private internals.
   *
   * RULE: Modules must not store a reference to the container after boot.
   *       Resolve dependencies once in onBoot() and store the resolved instances.
   */
  readonly container: VoidContainer;

  /**
   * Current Kernel phase at the time this context was created.
   * Informational — modules must not make phase-transition decisions based on this.
   */
  readonly phase: KernelPhase;

  /**
   * The name of the module receiving this context.
   * Injected automatically by the Kernel — modules do not need to provide it.
   */
  readonly moduleName: string;
}
