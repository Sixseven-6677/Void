/**
 * @file Application.ts
 * @description The Application class — root orchestrator of the Void lifecycle.
 *
 * Responsibilities:
 *   - Startup: initialize the DI container, load config, wire all components.
 *   - Running: maintain the RUNNING lifecycle state.
 *   - Graceful Shutdown: drain events, disable plugins, close all connections.
 *
 * RULE: Application does NOT implement business logic.
 * RULE: Application does NOT know about Facebook API details.
 * RULE: Application coordinates lifecycle — decisions live in Services.
 * RULE: One Application instance per process.
 *
 * @see .constitution/27-roadmap.md §3 (Phase 1 — Core Framework)
 */

import type { IConfig } from '../interfaces/IConfig.js';
import type { ILogger } from '../interfaces/ILogger.js';
import type { IEventBus } from '../interfaces/IEventBus.js';
import type { IPluginRegistry } from '../interfaces/IPluginRegistry.js';
import type { IScheduler } from '../interfaces/IScheduler.js';
import type { ICacheClient } from '../interfaces/ICacheClient.js';
import type { LifecycleState } from '../types/common.types.js';
import { VoidContainer } from '../container/container.js';
import { TOKENS } from '../container/tokens.js';
import { InternalError } from '../errors/InternalError.js';

// ─── Application Options ──────────────────────────────────────────────────────

export interface ApplicationOptions {
  /**
   * Pre-configured DI container.
   * Callers must register all bindings before passing the container in.
   */
  readonly container: VoidContainer;

  /**
   * Time in milliseconds the Application waits for in-flight work
   * to complete during graceful shutdown before forcing the next step.
   * Default: 10_000 ms (10 seconds).
   */
  readonly shutdownTimeoutMs?: number;
}

// ─── Application ──────────────────────────────────────────────────────────────

/**
 * The root lifecycle manager for the Void system.
 *
 * Start sequence:
 *   IDLE → STARTING → RUNNING
 *
 * Shutdown sequence:
 *   RUNNING → STOPPING → STOPPED
 *
 * On unrecoverable error:
 *   * → FAILED
 */
export class Application {
  private _state: LifecycleState = 'IDLE';
  private readonly container: VoidContainer;
  private readonly shutdownTimeoutMs: number;

  // Resolved during start() — typed for use within Application only
  private logger!: ILogger;
  private config!: IConfig;

  constructor(options: ApplicationOptions) {
    this.container         = options.container;
    this.shutdownTimeoutMs = options.shutdownTimeoutMs ?? 10_000;
  }

  // ─── Lifecycle State ────────────────────────────────────────────────────

  /** Current lifecycle state of the Application. */
  get state(): LifecycleState {
    return this._state;
  }

  private transitionTo(newState: LifecycleState): void {
    this._state = newState;
  }

  // ─── Start ──────────────────────────────────────────────────────────────

  /**
   * Initialize all subsystems and transition to RUNNING.
   *
   * Order of operations:
   *   1. Resolve logger and config (required for all subsequent steps).
   *   2. Activate all registered plugins (in dependency order).
   *   3. Register OS signal handlers for graceful shutdown.
   *   4. Transition to RUNNING.
   *
   * @throws InternalError if called in a non-IDLE state.
   * @throws any error that occurs during initialization —
   *         the caller (index.ts) is responsible for catching and exiting.
   */
  async start(): Promise<void> {
    if (this._state !== 'IDLE') {
      throw new InternalError(
        'APP_INVALID_STATE_TRANSITION',
        `Application.start() called in invalid state: "${this._state}". ` +
        'Application can only be started from IDLE state.',
        { context: { currentState: this._state } },
      );
    }

    this.transitionTo('STARTING');

    // 1. Resolve infrastructure — these are required before anything else
    this.config = this.container.resolve<IConfig>(TOKENS.Config);
    this.logger = this.container.resolve<ILogger>(TOKENS.Logger).child({
      component: 'Application',
    });

    this.logger.info('Application starting', {
      nodeEnv: this.config.server.nodeEnv,
      port:    this.config.server.port,
    });

    try {
      // 2. Activate plugins in dependency order
      const pluginRegistry = this.container.resolve<IPluginRegistry>(TOKENS.PluginRegistry);
      const activationResults = await pluginRegistry.activateAll();
      this.logPluginActivation(activationResults);

      // 3. Register OS signal handlers for graceful shutdown
      this.registerShutdownHandlers();

      // 4. Transition to RUNNING
      this.transitionTo('RUNNING');
      this.logger.info('Application is RUNNING');

    } catch (error) {
      this.transitionTo('FAILED');
      this.logger.fatal('Application failed to start', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ─── Stop ───────────────────────────────────────────────────────────────

  /**
   * Gracefully shut down the application.
   *
   * Shutdown order (each step is time-bounded by shutdownTimeoutMs):
   *   1. Drain the event bus — process all in-flight events.
   *   2. Shut down the scheduler — wait for running jobs to complete.
   *   3. Disable all plugins — in reverse dependency order.
   *   4. Disconnect the cache client — release cache connections.
   *   5. Transition to STOPPED.
   *
   * RULE: Every registered infrastructure component with a teardown path
   *       must be explicitly closed here. Silent resource leaks are forbidden.
   */
  async stop(): Promise<void> {
    if (this._state !== 'RUNNING' && this._state !== 'STARTING') {
      this.logger?.warn('Application.stop() called in non-running state', {
        state: this._state,
      });
      return;
    }

    this.transitionTo('STOPPING');
    this.logger.info('Application shutting down gracefully', {
      timeoutMs: this.shutdownTimeoutMs,
    });

    try {
      // 1. Drain the event bus — process all in-flight events before teardown
      await this.withTimeout(
        this.container.resolve<IEventBus>(TOKENS.EventBus).drain(),
        'EventBus.drain',
      );

      // 2. Shut down the scheduler — wait for in-progress jobs, cancel pending
      await this.withTimeout(
        this.container.resolve<IScheduler>(TOKENS.Scheduler).shutdown(this.shutdownTimeoutMs),
        'Scheduler.shutdown',
      );

      // 3. Disable all plugins — calls plugin.destroy() in reverse dependency order
      await this.withTimeout(
        this.container.resolve<IPluginRegistry>(TOKENS.PluginRegistry).disableAll(),
        'PluginRegistry.disableAll',
      );

      // 4. Disconnect cache — release connection pool before process exit
      await this.withTimeout(
        this.container.resolve<ICacheClient>(TOKENS.CacheClient).disconnect(),
        'CacheClient.disconnect',
      );

      this.transitionTo('STOPPED');
      this.logger.info('Application stopped cleanly');

    } catch (error) {
      this.transitionTo('FAILED');
      this.logger.error('Application encountered an error during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Do not rethrow — shutdown must complete even on error.
      // Connections are closed on a best-effort basis.
    }
  }

  // ─── Signal Handlers ────────────────────────────────────────────────────

  /**
   * Register process signal handlers for graceful shutdown.
   * SIGTERM (container orchestrators) and SIGINT (Ctrl+C) trigger stop().
   */
  private registerShutdownHandlers(): void {
    const shutdown = async (signal: string): Promise<void> => {
      this.logger.info(`Received ${signal} — initiating graceful shutdown`);
      await this.stop();
      process.exit(0);
    };

    process.once('SIGTERM', () => void shutdown('SIGTERM'));
    process.once('SIGINT',  () => void shutdown('SIGINT'));

    // Log unhandled promise rejections — do not crash silently
    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
    });

    // Log uncaught exceptions then shut down — process is in unknown state
    process.on('uncaughtException', (error) => {
      this.logger.fatal('Uncaught exception — initiating emergency shutdown', {
        error: error.message,
        stack: error.stack,
      });
      void shutdown('uncaughtException').finally(() => process.exit(1));
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /**
   * Wrap a promise with a soft timeout.
   * Logs a warning if the step exceeds the limit but allows shutdown to continue —
   * a hung subsystem must not block the rest of the teardown sequence.
   */
  private async withTimeout(promise: Promise<void>, label: string): Promise<void> {
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(() => {
        this.logger.warn(`${label} did not complete within shutdown timeout — continuing`, {
          timeoutMs: this.shutdownTimeoutMs,
        });
        resolve();
      }, this.shutdownTimeoutMs),
    );
    await Promise.race([promise, timeoutPromise]);
  }

  /**
   * Log the outcome of plugin activation during startup.
   */
  private logPluginActivation(results: ReadonlyMap<string, boolean>): void {
    let succeeded = 0;
    let failed    = 0;
    for (const [, activated] of results) {
      if (activated) succeeded++; else failed++;
    }
    this.logger.info('Plugin activation complete', {
      succeeded,
      failed,
      total: results.size,
    });
    if (failed > 0) {
      this.logger.warn(
        'Some plugins failed to activate — system continues with reduced capability',
        { failedCount: failed },
      );
    }
  }
}
