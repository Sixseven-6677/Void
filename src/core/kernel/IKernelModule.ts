/**
 * @file IKernelModule.ts
 * @description The primary extension point for the Kernel system.
 *
 * Every subsystem that participates in the application lifecycle MUST implement
 * IKernelModule and register with the Kernel via kernel.register(module).
 *
 * The Kernel calls lifecycle hooks in the correct order — modules must not
 * call each other's hooks directly.
 *
 * RULE: Modules are completely isolated from each other at the interface level.
 *       A module sees only its own IKernelContext — not other modules.
 * RULE: Modules must be idempotent — repeated calls to onBoot or onStop
 *       after a failure must not leave the system in a corrupt state.
 * RULE: A module must clean up ALL resources it acquired in onBoot, inside onStop.
 *       Resource leaks across module boundaries are architectural violations.
 * RULE: Modules must not throw from onStop — log and continue cleanup.
 *
 * Lifecycle hook call order:
 *   [Boot]  onBoot()  → called once per module in ascending priority order
 *   [Boot]  onReady() → called once per module (all booted) in ascending priority order
 *   [Stop]  onStop()  → called once per module in DESCENDING priority order
 *
 * @see kernel.types.ts  KernelPriority for recommended priority bands
 * @see IKernelContext   The context object passed to each hook
 */

import type { IKernelContext } from './IKernelContext.js';
import type { ModuleHealth } from './kernel.types.js';

// ─── IKernelModule ────────────────────────────────────────────────────────────

export interface IKernelModule {
  /**
   * Stable, unique identifier for this module.
   * Used in logs, health reports, and error messages.
   * Must be unique across all registered modules.
   * Convention: PascalCase, e.g. 'CacheModule', 'EventBusModule'.
   */
  readonly name: string;

  /**
   * Boot priority — lower values start FIRST.
   *
   * Use the KernelPriority constants as band anchors, then add small offsets
   * for ordering within a band, e.g. KernelPriority.INFRASTRUCTURE + 10.
   *
   * Modules with equal priority are booted in registration order.
   */
  readonly priority: number;

  /**
   * Called during the BOOTING phase, in ascending priority order.
   *
   * Use this hook to:
   *   - Resolve dependencies from the DI container.
   *   - Open connections (database, cache, etc.).
   *   - Initialize internal state.
   *   - Register event subscriptions.
   *
   * @throws Any error thrown here marks this module as FAILED and may abort boot.
   *         Critical modules (low priority) failing will abort the entire boot sequence.
   *
   * @param ctx — Read-only Kernel context for this module.
   */
  onBoot(ctx: IKernelContext): Promise<void>;

  /**
   * Called after ALL modules have successfully completed onBoot.
   * Guaranteed to run only when the system is fully initialized.
   *
   * Use this hook for:
   *   - Starting servers or listeners that depend on other modules being ready.
   *   - Emitting system.ready events.
   *   - Performing post-boot validation or warm-up.
   *
   * Optional — not all modules need a ready hook.
   *
   * @param ctx — Read-only Kernel context for this module.
   */
  onReady?(ctx: IKernelContext): Promise<void>;

  /**
   * Called during the STOPPING phase, in DESCENDING priority order
   * (transport stops first, infrastructure stops last).
   *
   * Use this hook to:
   *   - Stop accepting new work (close servers, stop listeners).
   *   - Drain in-flight operations.
   *   - Close connections and release resources.
   *   - Flush pending writes.
   *
   * Optional — stateless modules may not need cleanup.
   *
   * RULE: Must not throw. Log errors and continue releasing resources.
   * RULE: Must complete within the Kernel's configured shutdownTimeoutMs.
   *
   * @param ctx — Read-only Kernel context for this module.
   */
  onStop?(ctx: IKernelContext): Promise<void>;

  /**
   * Returns the current health of this module.
   *
   * Called periodically by the Kernel for health aggregation.
   * Optional — modules without health requirements may omit this.
   *
   * RULE: Must not throw. Return status UNKNOWN on internal errors.
   * RULE: Must resolve quickly (< 500ms). Long health checks block the aggregate report.
   */
  healthCheck?(): Promise<ModuleHealth>;
}
