/**
 * @file kernel.types.ts
 * @description Types and enums specific to the Kernel lifecycle system.
 *
 * These types define the vocabulary of the Kernel — phases, health states,
 * and the signals that flow between the Kernel and its modules.
 *
 * RULE: Kernel types must remain abstract — no Facebook, database, plugin,
 *       or command-specific vocabulary belongs here.
 */

// ─── Kernel Phase ─────────────────────────────────────────────────────────────

/**
 * The lifecycle phases the Kernel transitions through in order.
 *
 * Valid transitions:
 *   CREATED  → BOOTING
 *   BOOTING  → READY
 *   READY    → STOPPING
 *   STOPPING → STOPPED
 *   any      → CRASHED  (on unrecoverable error)
 *
 * Reverse transitions are forbidden — the Kernel is not restartable.
 * To restart, destroy the process and create a new Kernel instance.
 */
export type KernelPhase =
  | 'CREATED'   // Instance exists, modules can be registered
  | 'BOOTING'   // boot() in progress — modules starting in priority order
  | 'READY'     // All modules booted — system is fully operational
  | 'STOPPING'  // shutdown() in progress — modules stopping in reverse order
  | 'STOPPED'   // All modules stopped — process may exit
  | 'CRASHED';  // Unrecoverable error during boot or shutdown

// ─── Module Health ────────────────────────────────────────────────────────────

/** The health status of a single module as reported by its health check. */
export type ModuleHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

/** Health report returned by a single module's healthCheck() method. */
export interface ModuleHealth {
  /** The reporting module's name. */
  readonly moduleName: string;

  /** Current health status. */
  readonly status: ModuleHealthStatus;

  /**
   * Optional human-readable description of the health state.
   * Present when status is DEGRADED or UNHEALTHY.
   */
  readonly message?: string;

  /**
   * Arbitrary structured data for diagnostics (e.g. connection pool stats).
   * MUST NOT contain secrets, tokens, or PII.
   */
  readonly details?: Readonly<Record<string, unknown>>;

  /** When this health report was generated (ISO 8601). */
  readonly checkedAt: string;
}

// ─── Kernel Health ────────────────────────────────────────────────────────────

/** Aggregated health report for the entire system. */
export interface KernelHealth {
  /** Overall system health — worst-case of all module healths. */
  readonly status: ModuleHealthStatus;

  /** Current Kernel phase. */
  readonly phase: KernelPhase;

  /** Individual module health reports. */
  readonly modules: readonly ModuleHealth[];

  /** When this aggregate report was generated (ISO 8601). */
  readonly generatedAt: string;
}

// ─── Shutdown Reason ─────────────────────────────────────────────────────────

/** The trigger that initiated a graceful shutdown. */
export type ShutdownReason =
  | 'SIGTERM'            // Container orchestrator signal
  | 'SIGINT'             // Ctrl+C or manual interrupt
  | 'UNCAUGHT_EXCEPTION' // Unrecoverable runtime error
  | 'EXPLICIT'           // Programmatic kernel.shutdown() call
  | 'TEST';              // Test teardown

// ─── Phase Change Event ───────────────────────────────────────────────────────

/** Payload delivered to phase-change subscribers. */
export interface PhaseChangeEvent {
  readonly previousPhase: KernelPhase;
  readonly currentPhase: KernelPhase;
  readonly timestamp: string;
}

/** Handler called when the Kernel transitions between phases. */
export type PhaseChangeHandler = (event: PhaseChangeEvent) => void;

// ─── Module Priority — documented conventions ─────────────────────────────────

/**
 * Recommended priority bands for module registration.
 *
 * Lower priority values boot FIRST (infrastructure before application).
 * Higher priority values boot LAST (transport layer starts when everything is ready).
 *
 * These are conventions, not enforced ranges.
 * Modules may use any numeric priority — these bands prevent conflicts.
 */
export const KernelPriority = {
  /** Infrastructure: cache connections, DB pools, health endpoints. */
  INFRASTRUCTURE: 100,

  /** Core services: session manager, user service, event bus. */
  CORE_SERVICES: 200,

  /** Application services: command registry, plugin registry. */
  APP_SERVICES: 300,

  /** Transport: HTTP server, webhook listener. */
  TRANSPORT: 400,
} as const;

export type KernelPriorityBand = (typeof KernelPriority)[keyof typeof KernelPriority];
