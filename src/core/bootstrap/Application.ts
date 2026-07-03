/**
 * @file Application.ts
 * @description The Application class — root orchestrator of the Void lifecycle.
 *
 * Responsibilities:
 *   - Startup: initialize the DI container, load config, wire all components.
 *   - Running: maintain the RUNNING lifecycle state.
 *   - Graceful Shutdown: drain events, disable plugins, close connections.
 *
 * RULE: Application does NOT implement business logic.
 * RULE: Application does NOT know about Facebook API details.
 * RULE: Application coordinates lifecycle — decisions live in Services.
 * RULE: One Application instance per process.
 *
 * @see 27-roadmap.md §3 (Phase 1 — Core Framework)
 */

import type { IConfig } from '../interfaces/IConfig.js';
import type { ILogger } from '../interfaces/ILogger.js';
import type { IEventBus } from '../interfaces/IEventBus.js';
import type { IPluginRegistry } from '../interfaces/IPluginRegistry.js';
import type { IScheduler } from '../interfaces/IScheduler.js';
import type { LifecycleState } from '../types/common.types.js';
import { VoidContainer } from '../container/container.js';
import { TOKENS } from '../container/tokens.js';

// ─── Application Options ──────────────────────────────────────────────────────

export interface ApplicationOptions {
  /**
   * Pre-configured DI container.
   * Callers must register all bindings before passing the container in.
   */
  readonly container: VoidContainer;

  /**
   * Time in milliseconds the Application waits for in-flight work
   * to complete during graceful shutdown before forcing exit.
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
    this.container        = options.container;
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
   * @throws any error that occurs during initialization —
   *         the caller (index.ts) is responsible for catching and exiting.
   */
  async start(): Promise<void> {
    if (this._state !== 'IDLE') {
      throw new Error(
        `Application.start() called in invalid state: ${this._state}. ` +
        'Application can only be started from IDLE state.',
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
   * Order of operations:
   *   1. Stop accepting new work (signal state change).
   *   2. Drain the event bus — process all in-flight events.
   *   3. Shut down the scheduler — wait for running jobs.
   *   4. Disable all plugins — in reverse dependency order.
   *   5. Transition to STOPPED.
   *
   * Each step is time-bounded by shutdownTimeoutMs.
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
      // 2. Drain the event bus
      await this.withTimeout(
        this.container.resolve<IEventBus>(TOKENS.EventBus).drain(),
        'EventBus drain',
      );

      // 3. Shut down the scheduler
      await this.withTimeout(
        this.container.resolve<IScheduler>(TOKENS.Scheduler).shutdown(this.shutdownTimeoutMs),
        'Scheduler shutdown',
      );

      // 4. Disable all plugins
      await this.withTimeout(
        this.container.resolve<IPluginRegistry>(TOKENS.PluginRegistry).disableAll(),
        'PluginRegistry disableAll',
      );

      this.transitionTo('STOPPED');
      this.logger.info('Application stopped cleanly');

    } catch (error) {
      this.transitionTo('FAILED');
      this.logger.error('Application encountered an error during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Do not rethrow — shutdown must complete even on error
    }
  }

  // ─── Signal Handlers ────────────────────────────────────────────────────

  /**
   * Register process signal handlers for graceful shutdown.
   * SIGTERM and SIGINT trigger stop().
   */
  private registerShutdownHandlers(): void {
    const shutdown = async (signal: string): Promise<void> => {
      this.logger.info(`Received signal ${signal} — initiating graceful shutdown`);
      await this.stop();
      process.exit(0);
    };

    process.once('SIGTERM', () => void shutdown('SIGTERM'));
    process.once('SIGINT',  () => void shutdown('SIGINT'));

    // Log unhandled promise rejections — do not crash silently
    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled promise rejection detected', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
    });

    // Log uncaught exceptions — then shut down
    process.on('uncaughtException', (error) => {
      this.logger.fatal('Uncaught exception — initiating emergency shutdown', {
        error: error.message,
      });
      void shutdown('uncaughtException');
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /**
   * Wrap a promise with a timeout. Logs a warning if the operation exceeds
   * shutdownTimeoutMs but does not reject — shutdown must continue.
   */
  private async withTimeout(promise: Promise<void>, label: string): Promise<void> {
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(() => {
        this.logger.warn(`${label} did not complete within timeout — continuing shutdown`, {
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
    for (const [, ok] of results) {
      if (ok) succeeded++; else failed++;
    }
    this.logger.info('Plugin activation complete', { succeeded, failed, total: results.size });
    if (failed > 0) {
      this.logger.warn('Some plugins failed to activate — system continues with reduced capability', {
        failedCount: failed,
      });
    }
  }
}
