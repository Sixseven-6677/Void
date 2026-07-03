/**
 * @file Kernel.ts
 * @description The Application Kernel — the single lifecycle authority for Void.
 *
 * The Kernel is the heart of the application. It coordinates the startup and
 * shutdown of every registered subsystem through a uniform module interface,
 * without knowing what those subsystems do internally.
 *
 * What the Kernel KNOWS:
 *   - That modules exist and have a priority.
 *   - That modules have onBoot, onReady, and onStop lifecycle hooks.
 *   - The order in which hooks must be called.
 *   - The current phase of the application.
 *
 * What the Kernel does NOT KNOW:
 *   - Facebook API, webhooks, or messaging protocols.
 *   - Database schemas, queries, or connections.
 *   - Plugin manifests, command parsing, or event handlers.
 *   - Business logic of any kind.
 *
 * RULE: Only ONE Kernel instance may exist per process.
 *       Attempting to create a second instance throws InternalError.
 * RULE: Modules must be registered BEFORE boot() is called.
 *       Registration after BOOTING has started is rejected.
 * RULE: The Kernel is not restartable. To restart, exit and recreate the process.
 *
 * @see IKernelModule  — The extension point for all subsystems
 * @see IKernelContext — The context provided to modules during hooks
 * @see kernel.types   — KernelPhase, ModuleHealth, KernelPriority
 */

import { InternalError } from '../errors/InternalError.js';
import type { IConfig } from '../interfaces/IConfig.js';
import type { ILogger } from '../interfaces/ILogger.js';
import type { VoidContainer } from '../container/container.js';
import { TOKENS } from '../container/tokens.js';
import type { IKernelModule } from './IKernelModule.js';
import type { IKernelContext } from './IKernelContext.js';
import {
  KernelPriority,
  type KernelHealth,
  type KernelPhase,
  type ModuleHealth,
  type ModuleHealthStatus,
  type PhaseChangeEvent,
  type PhaseChangeHandler,
  type ShutdownReason,
} from './kernel.types.js';

// ─── Allowed Phase Transitions ────────────────────────────────────────────────

/**
 * The explicit state machine graph for the Kernel lifecycle.
 * Any transition not listed here is an invariant violation.
 *
 *   CREATED  → BOOTING
 *   BOOTING  → READY | CRASHED
 *   READY    → STOPPING
 *   STOPPING → STOPPED | CRASHED
 *   CRASHED  → (terminal — no transitions out)
 *   STOPPED  → (terminal — no transitions out)
 */
const ALLOWED_TRANSITIONS: Readonly<Record<KernelPhase, ReadonlyArray<KernelPhase>>> = {
  CREATED:  ['BOOTING'],
  BOOTING:  ['READY', 'CRASHED'],
  READY:    ['STOPPING'],
  STOPPING: ['STOPPED', 'CRASHED'],
  STOPPED:  [],
  CRASHED:  [],
};

// ─── Kernel Options ───────────────────────────────────────────────────────────

export interface KernelOptions {
  /**
   * The fully-configured DI container.
   * Must have ILogger, IConfig, and all required bindings registered
   * before the Kernel is created.
   */
  readonly container: VoidContainer;

  /**
   * Maximum time (ms) each module's stop hook may run before the Kernel
   * forces progress to the next module.
   * Default: 10_000 ms (10 seconds).
   */
  readonly shutdownTimeoutMs?: number;

  /**
   * Maximum time (ms) each module's boot hook may run before the Kernel
   * declares it timed out and fails the module.
   * Default: 30_000 ms (30 seconds).
   */
  readonly bootTimeoutMs?: number;
}

// ─── Registered Module Entry ──────────────────────────────────────────────────

/** Internal tracking record for a registered module. */
interface ModuleEntry {
  readonly module: IKernelModule;
  status: 'PENDING' | 'BOOTED' | 'READY' | 'STOPPED' | 'FAILED';
  bootedAt: string | null;
  stoppedAt: string | null;
  failureReason: string | null;
}

// ─── Kernel ───────────────────────────────────────────────────────────────────

export class Kernel {
  // ─── Singleton ───────────────────────────────────────────────────────────

  private static _instance: Kernel | null = null;

  /**
   * Create the application Kernel.
   *
   * May only be called ONCE per process. Throws if an instance already exists.
   * This enforces the single-Kernel constraint at the language level.
   *
   * @throws InternalError(KERNEL_ALREADY_CREATED) if called more than once.
   */
  static create(options: KernelOptions): Kernel {
    if (Kernel._instance !== null) {
      throw new InternalError(
        'KERNEL_ALREADY_CREATED',
        'A Kernel instance already exists. Only one Kernel is allowed per process. ' +
        'Use Kernel.getInstance() to access the existing instance.',
      );
    }
    Kernel._instance = new Kernel(options);
    return Kernel._instance;
  }

  /**
   * Retrieve the existing Kernel instance.
   *
   * @throws InternalError(KERNEL_NOT_INITIALIZED) if no Kernel has been created yet.
   */
  static getInstance(): Kernel {
    if (Kernel._instance === null) {
      throw new InternalError(
        'KERNEL_NOT_INITIALIZED',
        'No Kernel instance exists. Call Kernel.create(options) first.',
      );
    }
    return Kernel._instance;
  }

  /**
   * Check whether a Kernel instance currently exists.
   * Safe to call at any time — does not throw.
   */
  static exists(): boolean {
    return Kernel._instance !== null;
  }

  /**
   * Destroy the singleton instance.
   *
   * FOR TESTING ONLY. Must not be called in production code.
   * Allows test suites to create a fresh Kernel between tests.
   *
   * @throws InternalError(INVARIANT_VIOLATION) if called outside test environments.
   */
  static _destroyForTesting(): void {
    if (process.env['NODE_ENV'] !== 'test') {
      throw new InternalError(
        'INVARIANT_VIOLATION',
        'Kernel._destroyForTesting() may only be called in test environments. ' +
        'NODE_ENV must be "test".',
        { context: { nodeEnv: process.env['NODE_ENV'] } },
      );
    }
    Kernel._instance = null;
  }

  // ─── Instance Fields ─────────────────────────────────────────────────────

  private _phase: KernelPhase = 'CREATED';
  private readonly container: VoidContainer;
  private readonly shutdownTimeoutMs: number;
  private readonly bootTimeoutMs: number;

  /** Registered modules, sorted by priority (ascending) on each boot/stop. */
  private readonly modules: Map<string, ModuleEntry> = new Map();

  /** Phase-change subscribers — notified on every transition. */
  private readonly phaseHandlers: Set<PhaseChangeHandler> = new Set();

  /** Logger resolved lazily on first boot — not available during register(). */
  private logger: ILogger | null = null;

  /** Config resolved lazily on first boot. */
  private config: IConfig | null = null;

  // Private constructor — use Kernel.create()
  private constructor(options: KernelOptions) {
    this.container         = options.container;
    this.shutdownTimeoutMs = options.shutdownTimeoutMs ?? 10_000;
    this.bootTimeoutMs     = options.bootTimeoutMs     ?? 30_000;
  }

  // ─── Phase ───────────────────────────────────────────────────────────────

  /** The current lifecycle phase of the Kernel. */
  get phase(): KernelPhase {
    return this._phase;
  }

  private transitionTo(next: KernelPhase): void {
    const previous = this._phase;

    // Enforce the state machine graph — illegal transitions are programming errors.
    const allowed = ALLOWED_TRANSITIONS[previous];
    if (!allowed.includes(next)) {
      throw new InternalError(
        'KERNEL_INVALID_PHASE',
        `Illegal Kernel phase transition: "${previous}" → "${next}". ` +
        `Allowed transitions from "${previous}": [${allowed.join(', ') || 'none — terminal state'}].`,
        { context: { previousPhase: previous, nextPhase: next } },
      );
    }

    this._phase = next;

    const event: PhaseChangeEvent = {
      previousPhase: previous,
      currentPhase: next,
      timestamp: new Date().toISOString(),
    };

    // Notify subscribers — errors in handlers are caught and suppressed.
    // RULE: Handler errors must never crash the Kernel's own state machine.
    // logger?.error is used if the logger is initialized; otherwise suppressed silently.
    // Phase transitions before the logger is ready (CREATED → BOOTING) are too early
    // to log — the only recovery is to let the Kernel continue transitioning.
    for (const handler of this.phaseHandlers) {
      try {
        handler(event);
      } catch (err) {
        this.logger?.error('Phase-change handler threw an error — suppressed', {
          phase:  next,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger?.info(`Kernel transitioned to phase ${next}`, {
      previousPhase: previous,
      currentPhase: next,
    });
  }

  // ─── Registration ────────────────────────────────────────────────────────

  /**
   * Register a module with the Kernel.
   *
   * Modules must be registered before boot() is called.
   * Registration is rejected once BOOTING has begun.
   *
   * @throws InternalError(KERNEL_INVALID_PHASE) if called after boot starts.
   * @throws InternalError(KERNEL_MODULE_ALREADY_REGISTERED) if name is duplicate.
   */
  register(module: IKernelModule): this {
    if (this._phase !== 'CREATED') {
      throw new InternalError(
        'KERNEL_INVALID_PHASE',
        `Cannot register module "${module.name}" — Kernel is already in phase "${this._phase}". ` +
        'All modules must be registered before Kernel.boot() is called.',
        { context: { moduleName: module.name, kernelPhase: this._phase } },
      );
    }

    if (this.modules.has(module.name)) {
      throw new InternalError(
        'KERNEL_MODULE_ALREADY_REGISTERED',
        `A module named "${module.name}" is already registered. ` +
        'Module names must be unique across all registered modules.',
        { context: { moduleName: module.name } },
      );
    }

    this.modules.set(module.name, {
      module,
      status: 'PENDING',
      bootedAt: null,
      stoppedAt: null,
      failureReason: null,
    });

    return this;
  }

  // ─── Boot ────────────────────────────────────────────────────────────────

  /**
   * Boot the application — execute all module lifecycle hooks in priority order.
   *
   * Boot sequence:
   *   1. Resolve Logger and Config from the DI container.
   *   2. Sort all modules by priority (ascending).
   *   3. Call onBoot(ctx) on each module, in order.
   *      - If a module's onBoot throws, it is marked FAILED.
   *      - Boot continues with remaining modules (fail-partial, not fail-all).
   *   4. Call onReady(ctx) on each successfully-booted module, in order.
   *   5. Register OS signal handlers (SIGTERM, SIGINT).
   *   6. Transition to READY.
   *
   * @throws InternalError(KERNEL_INVALID_PHASE) if called outside CREATED state.
   * @throws InternalError(KERNEL_BOOT_FAILED) if a critical module fails
   *         (critical = priority < KernelPriority.CORE_SERVICES).
   */
  async boot(): Promise<void> {
    if (this._phase !== 'CREATED') {
      throw new InternalError(
        'KERNEL_INVALID_PHASE',
        `Kernel.boot() called in phase "${this._phase}". ` +
        'Boot may only be called once, from CREATED phase.',
        { context: { kernelPhase: this._phase } },
      );
    }

    this.transitionTo('BOOTING');

    // 1. Resolve infrastructure
    this.config = this.container.resolve<IConfig>(TOKENS.Config);
    this.logger = this.container.resolve<ILogger>(TOKENS.Logger).child({
      component: 'Kernel',
    });

    this.logger.info('Kernel booting', {
      moduleCount: this.modules.size,
      nodeEnv: this.config.server.nodeEnv,
    });

    const sorted = this.sortedModules();

    try {
      // 2. onBoot — ascending priority
      for (const entry of sorted) {
        await this.callBoot(entry);
      }

      // 3. onReady — ascending priority (only booted modules)
      for (const entry of sorted) {
        if (entry.status === 'BOOTED') {
          await this.callReady(entry);
        }
      }

      // 4. Register OS signal handlers
      this.registerSignalHandlers();

      this.transitionTo('READY');
      this.logger.info('Kernel is READY', {
        bootedModules:  sorted.filter((e) => e.status === 'READY').length,
        failedModules:  sorted.filter((e) => e.status === 'FAILED').length,
      });

    } catch (err) {
      this.transitionTo('CRASHED');
      this.logger.fatal('Kernel boot failed — entering CRASHED state', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Normalize to InternalError so callers always receive a typed error.
      // Preserve the original error as the cause for debugging.
      if (err instanceof InternalError) {
        throw err;
      }
      throw new InternalError(
        'KERNEL_MODULE_BOOT_FAILED',
        `Kernel boot failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  }

  // ─── Shutdown ────────────────────────────────────────────────────────────

  /**
   * Gracefully stop all modules in reverse priority order (DESCENDING).
   *
   * Shutdown sequence:
   *   1. Transition to STOPPING.
   *   2. Sort modules by priority descending (transport stops before infrastructure).
   *   3. Call onStop(ctx) on each module that was successfully booted.
   *      - Errors are caught, logged, and do NOT abort remaining teardown.
   *      - Each onStop is time-bounded by shutdownTimeoutMs.
   *   4. Transition to STOPPED.
   *
   * RULE: Shutdown must complete even when individual modules fail to stop cleanly.
   *
   * @param reason — What triggered this shutdown (for logging).
   */
  async shutdown(reason: ShutdownReason = 'EXPLICIT'): Promise<void> {
    if (this._phase !== 'READY' && this._phase !== 'BOOTING') {
      this.logger?.warn('Kernel.shutdown() called outside of stoppable phase', {
        phase: this._phase,
        reason,
      });
      return;
    }

    this.transitionTo('STOPPING');
    this.logger?.info('Kernel shutting down', {
      reason,
      timeoutMs: this.shutdownTimeoutMs,
    });

    // Top-level try/catch: shutdown must NEVER reject.
    // If something outside callStop() fails (e.g. sorting, logging),
    // we still force a terminal phase so callers can exit cleanly.
    try {
      const sorted = this.sortedModules().reverse(); // Descending priority

      for (const entry of sorted) {
        if (entry.status !== 'READY' && entry.status !== 'BOOTED') {
          continue; // Skip modules that never started or already failed
        }
        await this.callStop(entry);
      }

      this.transitionTo('STOPPED');
      this.logger?.info('Kernel stopped cleanly', { reason });

    } catch (err) {
      // Force CRASHED so the process can inspect final state before exiting.
      // Do not rethrow — shutdown must always resolve.
      this.logger?.error('Kernel shutdown encountered an unexpected error — forcing CRASHED', {
        reason,
        error: err instanceof Error ? err.message : String(err),
      });
      this._phase = 'CRASHED'; // Direct assignment — transitionTo(CRASHED) from STOPPING is valid
      // but if the transition itself threw, we must not call transitionTo again.
    }
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  /**
   * Aggregate health reports from all modules.
   *
   * Modules that do not implement healthCheck() are reported as UNKNOWN.
   * The overall status is the worst-case across all modules.
   *
   * RULE: This must resolve quickly — health checks have a 500ms timeout each.
   */
  async getHealth(): Promise<KernelHealth> {
    const moduleHealths: ModuleHealth[] = [];

    for (const entry of this.modules.values()) {
      if (typeof entry.module.healthCheck === 'function') {
        const health = await this.safeHealthCheck(entry);
        moduleHealths.push(health);
      } else {
        moduleHealths.push({
          moduleName: entry.module.name,
          status: 'UNKNOWN',
          message: 'Module does not implement healthCheck()',
          checkedAt: new Date().toISOString(),
        });
      }
    }

    const overallStatus = this.aggregateStatus(moduleHealths);

    return {
      status: overallStatus,
      phase: this._phase,
      modules: moduleHealths,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Phase Observation ────────────────────────────────────────────────────

  /**
   * Subscribe to Kernel phase-change events.
   *
   * @param handler — Called synchronously on every phase transition.
   * @returns       — An unsubscribe function.
   */
  onPhaseChange(handler: PhaseChangeHandler): () => void {
    this.phaseHandlers.add(handler);
    return () => {
      this.phaseHandlers.delete(handler);
    };
  }

  // ─── Module Introspection (diagnostics) ──────────────────────────────────

  /**
   * Returns a read-only snapshot of registered module metadata.
   * For diagnostics and testing — not for production branching logic.
   */
  listModules(): readonly {
    name: string;
    priority: number;
    status: ModuleEntry['status'];
    bootedAt: string | null;
    stoppedAt: string | null;
    failureReason: string | null;
  }[] {
    return [...this.modules.values()].map((entry) => ({
      name:          entry.module.name,
      priority:      entry.module.priority,
      status:        entry.status,
      bootedAt:      entry.bootedAt,
      stoppedAt:     entry.stoppedAt,
      failureReason: entry.failureReason,
    }));
  }

  /** Total number of registered modules. */
  get moduleCount(): number {
    return this.modules.size;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  /** Sort module entries by priority ascending. Mutates nothing — returns a new array. */
  private sortedModules(): ModuleEntry[] {
    return [...this.modules.values()].sort(
      (a, b) => a.module.priority - b.module.priority,
    );
  }

  /** Build an IKernelContext for a specific module. */
  private buildContext(entry: ModuleEntry): IKernelContext {
    return {
      logger: (this.logger ?? this.container.resolve<ILogger>(TOKENS.Logger)).child({
        module: entry.module.name,
      }),
      config:     this.config ?? this.container.resolve<IConfig>(TOKENS.Config),
      container:  this.container,
      phase:      this._phase,
      moduleName: entry.module.name,
    };
  }

  /** Call onBoot on a module — catches errors, updates entry status. */
  private async callBoot(entry: ModuleEntry): Promise<void> {
    const ctx = this.buildContext(entry);
    ctx.logger.info('Module booting');

    try {
      await this.withTimeout(
        entry.module.onBoot(ctx),
        this.bootTimeoutMs,
        entry.module.name,
        'onBoot',
      );
      entry.status   = 'BOOTED';
      entry.bootedAt = new Date().toISOString();
      ctx.logger.info('Module booted successfully');
    } catch (err) {
      entry.status        = 'FAILED';
      entry.failureReason = err instanceof Error ? err.message : String(err);
      ctx.logger.error('Module boot failed', {
        error:  entry.failureReason,
        module: entry.module.name,
      });

      // Critical modules (INFRASTRUCTURE band) failing aborts the entire boot.
      // Uses KernelPriority.CORE_SERVICES as threshold — anything below that
      // is infrastructure-level and must start successfully.
      if (entry.module.priority < KernelPriority.CORE_SERVICES) {
        throw new InternalError(
          'KERNEL_MODULE_BOOT_FAILED',
          `Critical module "${entry.module.name}" failed to boot. ` +
          'Infrastructure modules must start successfully before the system can operate.',
          {
            cause:   err,
            context: { moduleName: entry.module.name, priority: entry.module.priority },
          },
        );
      }
    }
  }

  /** Call onReady on a module — catches errors, updates entry status. */
  private async callReady(entry: ModuleEntry): Promise<void> {
    if (typeof entry.module.onReady !== 'function') return;

    const ctx = this.buildContext(entry);
    try {
      await this.withTimeout(
        entry.module.onReady(ctx),
        this.bootTimeoutMs,
        entry.module.name,
        'onReady',
      );
      entry.status = 'READY';
      ctx.logger.info('Module ready');
    } catch (err) {
      // onReady failures do not abort — they degrade the module but continue boot
      entry.status        = 'FAILED';
      entry.failureReason = err instanceof Error ? err.message : String(err);
      ctx.logger.error('Module onReady failed', {
        error:  entry.failureReason,
        module: entry.module.name,
      });
    }
  }

  /** Call onStop on a module — MUST NOT throw. Time-bounded per module. */
  private async callStop(entry: ModuleEntry): Promise<void> {
    if (typeof entry.module.onStop !== 'function') {
      entry.status    = 'STOPPED';
      entry.stoppedAt = new Date().toISOString();
      return;
    }

    const ctx = this.buildContext(entry);
    ctx.logger.info('Module stopping');

    try {
      await this.withTimeout(
        entry.module.onStop(ctx),
        this.shutdownTimeoutMs,
        entry.module.name,
        'onStop',
      );
    } catch (err) {
      // onStop errors are logged but must never abort the shutdown sequence
      ctx.logger.error('Module stop encountered an error — continuing shutdown', {
        error:  err instanceof Error ? err.message : String(err),
        module: entry.module.name,
      });
    }

    entry.status    = 'STOPPED';
    entry.stoppedAt = new Date().toISOString();
    ctx.logger.info('Module stopped');
  }

  /**
   * Wrap a hook promise with a hard timeout.
   * Throws if the promise does not resolve within the deadline.
   */
  private withTimeout(
    promise: Promise<void>,
    timeoutMs: number,
    moduleName: string,
    hookName: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new InternalError(
            'KERNEL_MODULE_BOOT_FAILED',
            `Module "${moduleName}" ${hookName}() timed out after ${timeoutMs}ms.`,
            { context: { moduleName, hookName, timeoutMs } },
          ),
        );
      }, timeoutMs);

      promise.then(
        () => { clearTimeout(timer); resolve(); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }

  /** Call a module's healthCheck() with a 500ms timeout — never throws. */
  private async safeHealthCheck(entry: ModuleEntry): Promise<ModuleHealth> {
    const HEALTH_TIMEOUT = 500;

    if (typeof entry.module.healthCheck !== 'function') {
      return {
        moduleName: entry.module.name,
        status:     'UNKNOWN',
        checkedAt:  new Date().toISOString(),
      };
    }

    try {
      const result = await Promise.race<ModuleHealth>([
        entry.module.healthCheck(),
        new Promise<ModuleHealth>((resolve) =>
          setTimeout(
            () =>
              resolve({
                moduleName: entry.module.name,
                status:     'UNKNOWN',
                message:    `healthCheck() timed out after ${HEALTH_TIMEOUT}ms`,
                checkedAt:  new Date().toISOString(),
              }),
            HEALTH_TIMEOUT,
          ),
        ),
      ]);
      return result;
    } catch (_err) {
      return {
        moduleName: entry.module.name,
        status:     'UNKNOWN',
        message:    'healthCheck() threw an unexpected error',
        checkedAt:  new Date().toISOString(),
      };
    }
  }

  /**
   * Compute the worst-case aggregate health status.
   * UNHEALTHY > DEGRADED > UNKNOWN > HEALTHY.
   */
  private aggregateStatus(healths: ModuleHealth[]): ModuleHealthStatus {
    if (healths.some((h) => h.status === 'UNHEALTHY'))  return 'UNHEALTHY';
    if (healths.some((h) => h.status === 'DEGRADED'))   return 'DEGRADED';
    if (healths.some((h) => h.status === 'UNKNOWN'))    return 'UNKNOWN';
    return 'HEALTHY';
  }

  /**
   * Register SIGTERM and SIGINT handlers for graceful shutdown.
   * Also handles uncaught exceptions and unhandled rejections.
   */
  private registerSignalHandlers(): void {
    const shutdown = async (reason: ShutdownReason): Promise<void> => {
      this.logger?.info(`Received ${reason} — initiating graceful shutdown`);
      await this.shutdown(reason);
      process.exit(reason === 'UNCAUGHT_EXCEPTION' ? 1 : 0);
    };

    process.once('SIGTERM', () => void shutdown('SIGTERM'));
    process.once('SIGINT',  () => void shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      this.logger?.error('Unhandled promise rejection detected', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
    });

    process.on('uncaughtException', (err) => {
      this.logger?.fatal('Uncaught exception — initiating emergency shutdown', {
        error: err.message,
        stack: err.stack,
      });
      void shutdown('UNCAUGHT_EXCEPTION');
    });
  }
}
