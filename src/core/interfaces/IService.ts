/**
 * @file IService.ts
 * @description Base contract for all Service components in the Void system.
 *
 * Services are the sole authority for business logic in Void. Every Service
 * MUST satisfy this base contract in addition to its own domain-specific interface.
 *
 * RULE: Services contain ALL business logic — no exceptions.
 * RULE: Services are the ONLY layer that may make business decisions.
 * RULE: Services depend on Repositories and other Services through DI — never
 *       directly instantiate dependencies.
 * RULE: Services MUST NOT know about HTTP, Facebook API, or transport details.
 * RULE: Services are stateless — all state lives in the database or cache.
 *
 * @see .constitution/15-service-rules.md
 */

// ─── IService ─────────────────────────────────────────────────────────────────

/**
 * Base contract that every Service in the Void system must satisfy.
 *
 * Provides a common surface for health checking and graceful teardown,
 * enabling the Application to manage all services uniformly during
 * the shutdown sequence.
 */
export interface IService {
  /**
   * A stable identifier for this service — used for logging and diagnostics.
   * Typically the class name, e.g. 'SessionService', 'UserService'.
   */
  readonly serviceName: string;

  /**
   * Called by the Application during graceful shutdown.
   * Services must release any held resources (e.g. background timers,
   * open streams, pending writes) before this resolves.
   *
   * RULE: This must resolve within the application's shutdownTimeoutMs.
   * RULE: Must never throw — log errors and continue cleanup.
   */
  dispose(): Promise<void>;
}
