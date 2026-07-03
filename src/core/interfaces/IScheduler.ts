/**
 * @file IScheduler.ts
 * @description Contract for the job scheduling system.
 *
 * RULE: Scheduled jobs are the only components that run without user interaction.
 * RULE: Every job must declare a maximum run time — runaway jobs are killed.
 * RULE: Jobs must be idempotent — retry on failure must not cause double effects.
 * RULE: Scheduler is the ONLY component that may enqueue jobs. Commands and
 *       Services request scheduling via this interface — they do not call
 *       the queue directly.
 *
 * @see 19-scheduler-policy.md
 */

import type { JobId } from '../types/common.types.js';

// ─── Job Handler ──────────────────────────────────────────────────────────────

/** The function that executes a scheduled job. Must be idempotent. */
export type JobHandler = () => Promise<void>;

// ─── Cron Expression ─────────────────────────────────────────────────────────

/** A standard 5-field cron expression string (e.g. '0 * * * *'). */
export type CronExpression = string;

// ─── One-Time Job Options ─────────────────────────────────────────────────────

/** Options for a one-time delayed job. */
export interface OneTimeJobOptions {
  /** Delay in milliseconds before the job runs. */
  readonly delayMs: number;

  /** Maximum time in milliseconds the job may run before being killed. */
  readonly timeoutMs?: number;

  /**
   * Maximum number of retry attempts on failure.
   * Defaults to 0 (no retry).
   */
  readonly maxRetries?: number;

  /**
   * Base delay between retries in milliseconds (exponential backoff applied).
   */
  readonly retryDelayMs?: number;
}

// ─── Recurring Job Options ────────────────────────────────────────────────────

/** Options for a recurring cron-scheduled job. */
export interface RecurringJobOptions {
  /** Cron expression defining the schedule. */
  readonly cron: CronExpression;

  /** Maximum time in milliseconds the job may run before being killed. */
  readonly timeoutMs?: number;

  /** Whether to immediately execute the job on registration. */
  readonly runImmediately?: boolean;
}

// ─── Job Status ───────────────────────────────────────────────────────────────

/** Current state of a scheduled job. */
export type JobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DEAD_LETTER';

// ─── Job Info ─────────────────────────────────────────────────────────────────

/** Snapshot of a job's current state — for diagnostics. */
export interface JobInfo {
  readonly id: JobId;
  readonly name: string;
  readonly status: JobStatus;
  readonly scheduledAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly attemptCount: number;
  readonly lastError: string | null;
}

// ─── IScheduler ───────────────────────────────────────────────────────────────

/**
 * Contract for scheduling and managing background jobs.
 *
 * Implementations use an internal queue. All job errors are caught
 * and logged — they never propagate to the caller.
 */
export interface IScheduler {
  /**
   * Schedule a one-time job to run after a delay.
   *
   * @param name    - Human-readable job name for diagnostics.
   * @param handler - The job function. Must be idempotent.
   * @param options - Delay, timeout, and retry configuration.
   * @returns       - The assigned job ID.
   */
  scheduleOnce(
    name: string,
    handler: JobHandler,
    options: OneTimeJobOptions,
  ): JobId;

  /**
   * Register a recurring job on a cron schedule.
   * The job runs on the given cron expression until explicitly cancelled.
   *
   * @param name    - Human-readable job name for diagnostics.
   * @param handler - The job function. Must be idempotent.
   * @param options - Cron expression and timeout configuration.
   * @returns       - The assigned job ID.
   */
  scheduleRecurring(
    name: string,
    handler: JobHandler,
    options: RecurringJobOptions,
  ): JobId;

  /**
   * Cancel a pending or recurring job by its ID.
   * No-op if the job does not exist or has already completed.
   *
   * @returns true if the job was found and cancelled, false otherwise.
   */
  cancel(id: JobId): boolean;

  /**
   * Get the current status of a job.
   * Returns null if the job ID is not found.
   */
  getJobInfo(id: JobId): JobInfo | null;

  /**
   * List all jobs currently in a given status.
   */
  listByStatus(status: JobStatus): readonly JobInfo[];

  /**
   * Gracefully stop the scheduler — wait for in-progress jobs to complete
   * (up to a timeout), then cancel all pending jobs.
   */
  shutdown(timeoutMs?: number): Promise<void>;
}
