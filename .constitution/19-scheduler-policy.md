# 19 — Scheduler Policy

> **Status:** Official  
> **Scope:** All scheduled and deferred job design decisions in Void — job philosophy, lifecycle, cron scheduling, delayed execution, retry policy, failure recovery, priority, performance, and monitoring  
> **Authority:** This document is the single source of truth for scheduled task design in Void. The Scheduler is responsible exclusively for managing the timing and execution of jobs. It does not own business logic, does not manage domain state, and does not communicate with the Facebook Layer directly. Every job that requires domain behavior delegates immediately to a Service.

---

## Table of Contents

1. [Scheduler Philosophy](#1-scheduler-philosophy)
2. [Scheduler Boundaries](#2-scheduler-boundaries)
3. [Job Lifecycle](#3-job-lifecycle)
4. [Cron Jobs](#4-cron-jobs)
5. [Delayed Jobs](#5-delayed-jobs)
6. [Retry Policy](#6-retry-policy)
7. [Failure Recovery](#7-failure-recovery)
8. [Priority](#8-priority)
9. [Concurrency and Isolation](#9-concurrency-and-isolation)
10. [Performance](#10-performance)
11. [Monitoring](#11-monitoring)
12. [Best Practices](#12-best-practices)
13. [Anti-Patterns](#13-anti-patterns)
14. [Forbidden Scheduler Practices](#14-forbidden-scheduler-practices)
15. [AI Scheduler Rules](#15-ai-scheduler-rules)
16. [Review Checklist](#16-review-checklist)

---

## 1. Scheduler Philosophy

### 1.1 The Scheduler Is a Timer, Not a Logic Engine

The Scheduler's single responsibility is timing. It knows when to run a job. It does not know what the job means, what business outcome it produces, or what rules govern its execution. Those questions are answered by Services. The Scheduler fires the trigger; Services perform the work.

This separation is not incidental — it is the design principle that makes the Scheduler testable, replaceable, and observable independently of the business domain. A Scheduler that contains business logic is a Scheduler that cannot be swapped without losing domain behavior, cannot be tested without bootstrapping the entire application, and cannot be understood without reading both scheduling and business code simultaneously.

### 1.2 Jobs Are Entry Points

A scheduled job is structurally identical to a Command handler or an API controller: it is an entry point. It wakes up, reads context (the time, the trigger parameters), calls the appropriate Service, and exits. The job handler contains no business logic of its own — it is a thin bridge between the Scheduler's timing mechanism and the Service layer's domain capability.

The rule from `15-service-rules.md` applies without modification: entry points do not contain business logic. Scheduled jobs are entry points.

### 1.3 Every Job Has a Single Owner

Every scheduled job belongs to exactly one component — the Service whose capability it triggers. The ownership is expressed in the job's name, its handler file location, and its registration. Two jobs that trigger the same Service operation are not two owners of that operation — the operation has one owner (the Service), and both jobs are entry points to it.

### 1.4 Scheduling Is Deterministic and Auditable

The complete set of scheduled jobs — every cron schedule, every delayed job pattern, every retry configuration — is defined in code, version-controlled, and auditable. No job is scheduled through a database record that is invisible in the codebase, no job is scheduled through a manual process that leaves no trace, and no job is added without a code review.

---

## 2. Scheduler Boundaries

### 2.1 What the Scheduler Owns

The Scheduler owns:
- The timing configuration for each job (cron expression, delay, interval)
- The job queue — the ordered set of jobs waiting to be executed
- The execution mechanism — pulling jobs from the queue and invoking job handlers
- The retry queue — jobs that failed and are waiting for their next attempt
- Job state tracking — pending, running, completed, failed, retrying
- Concurrency enforcement — ensuring jobs run within their concurrency limits

### 2.2 What the Scheduler Does Not Own

The Scheduler does not own:
- **Business logic:** What to do with data, what rules to apply, what decisions to make — all Services
- **Domain state:** The state of accounts, sessions, messages, contacts — all database/Services
- **External platform access:** Facebook sessions, message delivery, connection management — all through Services and the Facebook Layer
- **Notification delivery:** Alerting humans or systems about job outcomes — the job handler notifies after the Service returns; the Scheduler itself does not notify
- **Authorization:** Whether a job is allowed to run — Services enforce this when called

### 2.3 The Scheduler Does Not Call the Database Directly

The Scheduler infrastructure (queue persistence, job state tracking) may use a database internally to store job records. This is the Scheduler's own database usage for its own operational state — not business data access. Job handlers must not issue business database queries. Any data a job handler needs from the business domain is obtained by calling a Service.

### 2.4 The Scheduler Does Not Call the Facebook Layer Directly

A job handler must never import or call Facebook Layer components — `SessionManager`, `ConnectionController`, `MessageGateway`, `FacebookTransport`. If a scheduled job needs to send a message, reconnect a session, or interact with the Facebook platform, it calls the Service that provides that capability. The Service handles the Facebook Layer interaction.

---

## 3. Job Lifecycle

### 3.1 Job States

Every job passes through a defined set of states. Each state represents a distinct phase of the job's existence. No state may be skipped — transitions must follow the defined sequence.

```
SCHEDULED
    │
    ▼
PENDING ──── (delayed: waiting for execution time)
    │
    ▼
RUNNING ──── (handler executing)
    │
    ├──── SUCCESS ──► COMPLETED
    │
    └──── FAILURE
               │
               ├──── (retryable + attempts remaining) ──► RETRYING ──► PENDING
               │
               └──── (not retryable or no attempts remaining) ──► DEAD
```

| State | Description |
|---|---|
| `SCHEDULED` | The job definition exists; execution is configured but has not yet been triggered |
| `PENDING` | The job has been enqueued and is waiting for an available worker |
| `RUNNING` | A worker has claimed the job and is executing the handler |
| `COMPLETED` | The handler returned successfully; the job is done |
| `RETRYING` | The handler failed; the job is waiting for the next retry interval |
| `DEAD` | The handler failed and no further retries will be attempted |

### 3.2 State Transitions Are Owned by the Scheduler

Only the Scheduler changes a job's state. Job handlers do not set their own state. A handler returns a result; the Scheduler reads the result and transitions the state accordingly. Handlers do not have access to the job state machine — they only know they were called.

### 3.3 Job Execution Is Claimed Exclusively

When a worker claims a job for execution, the job is locked to that worker. No other worker may claim the same job while it is in the `RUNNING` state. This exclusive claim prevents duplicate execution of the same job instance — a critical correctness property for jobs that produce side effects.

The claim mechanism must be atomic. If two workers simultaneously attempt to claim the same job, exactly one must succeed and the other must be rejected. A non-atomic claim mechanism produces duplicate executions.

### 3.4 Claim Expiry for Stuck Jobs

A claimed job that does not complete — because the worker crashed, because the process was killed — must eventually be reclaimed. The Scheduler monitors claim expiry: if a job has been in the `RUNNING` state for longer than its configured execution timeout, the claim is released and the job is returned to `PENDING` for re-execution.

Claim expiry is not the same as job timeout. Claim expiry handles infrastructure failures (worker crashes). Job timeout handles logic failures (handler runs too long).

### 3.5 Completed and Dead Jobs Are Retained for Audit

Completed and dead jobs are retained in the job history for a defined retention period. This history is the operational audit log of the Scheduler — it shows what ran, when it ran, what it returned, and why it failed. Jobs are not deleted immediately on completion. Dead jobs are never silently discarded.

---

## 4. Cron Jobs

### 4.1 Cron Jobs Are Defined in Code

Every cron job is defined in code — its schedule, its handler, its configuration, and its documentation. Cron jobs are not configured through a database, a configuration file that is not version-controlled, or a manual system process. The codebase is the complete and authoritative record of all scheduled recurring jobs.

### 4.2 Cron Expressions Are Documented

Every cron expression is accompanied by a human-readable description of its schedule in a comment:

```typescript
// Runs every day at 02:00 UTC — nightly session health check
schedule: '0 2 * * *'
```

A cron expression without a comment requires the reader to parse the expression mentally. This is an unnecessary cognitive burden and a source of errors during modification.

### 4.3 Cron Job Names Are Globally Unique and Descriptive

Each cron job has a unique name that describes what it does — not when it runs or which system runs it. `nightly-session-health-check` is a good name. `cron-job-1` is not. `run-at-2am` is not. The name must be meaningful to an operator reading it in a monitoring dashboard at 3 AM during an incident.

### 4.4 All Times Are UTC

All cron schedules are expressed in UTC. No cron job schedule may use local time, system time, or any timezone that is not UTC. Cron jobs scheduled in non-UTC timezones drift relative to clock changes and produce different behavior across deployment environments.

### 4.5 Cron Job Overlap Is Managed

A cron job that has not finished when its next scheduled execution arrives creates an overlap condition. Overlapping execution of the same job may produce incorrect results (duplicate side effects) or resource contention. Every cron job defines its overlap behavior:

- **Skip:** If the previous run is still active, skip this scheduled execution and log the skip
- **Queue:** Enqueue the new execution to run after the previous finishes
- **Terminate:** Kill the previous run and start the new one (only for jobs designed to handle interruption)

The default is **Skip**. An explanation is required for any job that uses Queue or Terminate.

### 4.6 Cron Jobs Are Lightweight Triggers

A cron job handler is a thin trigger. It resolves context (what accounts, what time window, what parameters), calls the Service, and exits. A cron job handler that does significant work — iterating through records, making decisions, issuing multiple Service calls with conditional logic — has absorbed business logic that belongs in the Service.

The correct pattern for a cron job that processes many records: the cron handler calls a Service that performs the bulk operation. The Service applies the logic. The cron handler reports the result.

---

## 5. Delayed Jobs

### 5.1 Delayed Jobs Execute Once at a Future Time

A delayed job is scheduled to execute once, at a specific future point in time. It is not recurring. After execution (success or final failure), the delayed job is archived — not rescheduled.

### 5.2 Delay Is Measured from Schedule Time, Not Enqueue Time

When a delayed job is created with a delay of "30 minutes," the 30 minutes begins from the moment the job is enqueued — not from when the worker picks it up, not from when the previous job completes. The target execution time is computed at enqueue time and stored with the job record.

### 5.3 Delayed Jobs Are Idempotent by Design

A delayed job may be re-executed — due to a retry after failure, due to claim expiry recovery. Every delayed job must be designed to be safe to re-execute with the same inputs. The second execution must produce the same outcome as the first, or must detect that the work was already done and exit without side effects.

Idempotency is not a nice-to-have for delayed jobs — it is a correctness requirement. Infrastructure failures that produce duplicate executions are expected. A delayed job that is not idempotent will produce duplicate side effects whenever it is retried.

### 5.4 Delayed Jobs Are Created Through Services

A Service that needs to schedule a delayed job uses a `JobScheduler` interface — a dependency injected into the Service. The Service calls `jobScheduler.schedule(jobDefinition, delay)`. The Service does not interact with the job queue directly. The `JobScheduler` interface is the boundary between the Service layer and the Scheduler infrastructure.

### 5.5 Delayed Job Payloads Are Minimal and Stable

The payload stored with a delayed job — the data passed to the handler at execution time — must be:
- **Minimal:** Only the identifiers and parameters needed to execute the job. Not a serialized copy of a domain object.
- **Stable:** The payload format must remain deserializable even if the job sits in the queue for hours or days while a deployment is released. Payload formats that change between application versions must be versioned.

A payload that embeds a full account object snapshot will be stale by the time the job executes. A payload that embeds only `accountId` is always valid — the handler reads the current account state at execution time.

---

## 6. Retry Policy

### 6.1 Every Job Has an Explicit Retry Policy

Every registered job — cron or delayed — has an explicitly defined retry policy. There is no implicit "retry forever" or "no retry by default." The policy is part of the job's definition, visible in code alongside the handler.

A retry policy defines:
- **Maximum attempts:** The total number of execution attempts including the first
- **Backoff strategy:** How the delay between attempts grows
- **Retryable error types:** Which failure types are eligible for retry

### 6.2 Backoff Strategies

| Strategy | Description | When to Use |
|---|---|---|
| **Fixed** | Every retry waits the same interval | Simple, predictable; for short intervals |
| **Linear** | Interval grows by a fixed amount per attempt (N, 2N, 3N...) | Moderate growth; resource pressure is mild |
| **Exponential** | Interval doubles per attempt (N, 2N, 4N, 8N...) | Dependent services need recovery time |
| **Exponential with jitter** | Exponential + random offset | Multi-job thundering herd prevention |

The default backoff strategy for all jobs in Void is **exponential with jitter**. This protects dependent services from synchronized retry storms when many jobs fail simultaneously.

### 6.3 Maximum Attempts Are Bounded

No job has an unlimited retry count. The maximum attempt count for any job is finite and documented. Common retry limits:

| Job Criticality | Maximum Attempts | Rationale |
|---|---|---|
| Low-criticality, best-effort | 3 | Fast failure acknowledgment |
| Standard | 5 | Allows for transient failures with recovery time |
| High-criticality, critical path | 10 | Persistent retry for important work |
| Infinite-attempt (special) | Forbidden — see Section 14 | |

### 6.4 Not All Failures Are Retryable

A job that fails because the input data is invalid — a referenced entity does not exist, a required parameter is null, a validation constraint was violated — must not be retried. Retrying a job against a permanent failure condition wastes resources and delays the job reaching its `DEAD` state where operators can investigate.

The job handler classifies its failure as retryable or permanent before exiting. The Scheduler reads the classification and applies the retry policy only to retryable failures.

| Failure Type | Retryable? |
|---|---|
| External service temporarily unavailable | Yes |
| Database connection timeout | Yes |
| Rate limit hit — need to wait | Yes |
| Job payload references a deleted entity | No |
| Service returned a validation error | No |
| Handler threw an unrecoverable exception | No (requires investigation) |
| Deadline exceeded — job ran too long | Depends on job design |

### 6.5 Retry Intervals Respect Dependent Service Limits

When a job retries because a dependent service was rate-limited or overloaded, the retry interval must be long enough for the dependent service to recover. A 100ms retry interval against a service that needs 30 seconds to recover produces 300 wasted retries before a successful one. Retry intervals for rate-limit failures must use the `Retry-After` header if available, or a configured minimum interval appropriate to the dependent service.

---

## 7. Failure Recovery

### 7.1 Dead Jobs Are Visible and Actionable

When a job exhausts its retry attempts and moves to `DEAD`, it becomes immediately visible in the monitoring system. Dead jobs are not silently archived. A dead job represents a failure that the system could not automatically recover from — it requires human investigation and often intervention.

The monitoring alert for dead jobs fires within one minute of the job reaching `DEAD` state. Alerts include: job name, job ID, failure count, last error, last execution time, and job payload (with sensitive fields redacted).

### 7.2 Dead Jobs Support Manual Requeue

An operator investigating a dead job must be able to requeue it — schedule it for a new execution attempt — without modifying code. The Scheduler provides an administrative interface (protected by appropriate access controls) that allows dead jobs to be requeued after the underlying problem has been resolved.

Manual requeue creates a new job instance with a fresh attempt count. The original dead job record is preserved for audit.

### 7.3 Dead Jobs Are Not Automatically Re-Queued

A dead job that is automatically re-queued by the system without human intervention is a job that is bypassing its retry limit. The retry limit is a safety valve — when it is reached, the system has determined that automatic recovery is not working and human judgment is needed. Automatic re-queue after death circumvents this safety valve.

### 7.4 Failure Root Causes Are Classified

When a job fails, the failure is classified before it is stored. Classification enables meaningful monitoring and routing:

| Root Cause Class | Description |
|---|---|
| `transient_infrastructure` | Database timeout, network blip, cache miss |
| `dependent_service_unavailable` | A Service the job calls returned unavailable |
| `rate_limited` | The job or its dependencies are rate-limited |
| `bad_payload` | The job payload is invalid or references missing data |
| `business_rule_violation` | A Service rejected the operation for a business reason |
| `timeout` | The job exceeded its execution time limit |
| `unhandled_exception` | An unexpected error — likely a bug |

### 7.5 Mass Failure Is Treated as an Incident

When a large fraction of jobs of the same type fail within a short window — more than a threshold fraction within a rolling period — this is a mass failure event and is treated as an incident. Mass failures indicate a systemic problem: a dependency is down, a deployment introduced a bug, a configuration change broke job execution.

Mass failure monitoring must be configured per job type with thresholds appropriate to the job's expected failure rate.

---

## 8. Priority

### 8.1 Jobs Have an Explicit Priority Level

Every job is assigned a priority level at registration. The Scheduler processes higher-priority jobs before lower-priority ones when multiple jobs are waiting for execution. Priority is not inferred from job type or scheduling time — it is explicit in the job definition.

| Priority Level | Value | Description |
|---|---|---|
| `CRITICAL` | 1 | Must execute immediately; delays are service-impacting |
| `HIGH` | 2 | Important; execute before standard work |
| `STANDARD` | 3 | Normal business operations (default) |
| `LOW` | 4 | Background work; execute when workers are available |
| `BATCH` | 5 | Bulk operations; execute in idle periods |

### 8.2 Priority Is Set at the Job Level, Not the Queue Level

Priority is a property of the individual job — not of the queue it enters. Two jobs of different priority that enter the same queue are executed in priority order within that queue. A separate queue per priority level is an implementation detail of the Scheduler infrastructure — the job definition declares its priority level regardless of how the Scheduler implements queue separation.

### 8.3 Priority Starvation Is Prevented

A high-priority job stream that continuously arrives must not starve low-priority jobs indefinitely. The Scheduler implements aging — a mechanism by which a job that has been waiting in `PENDING` for longer than a configured period has its effective priority elevated. Aging ensures that every job eventually executes, regardless of the priority of jobs that arrive after it.

### 8.4 Critical Priority Is Reserved for Service-Impacting Work

`CRITICAL` priority is not a convenience label — it is reserved for jobs whose delay directly impacts users or operational status. Over-using `CRITICAL` defeats the priority system by making all critical jobs equal. A job labeled `CRITICAL` that handles a non-urgent background task is incorrectly labeled.

---

## 9. Concurrency and Isolation

### 9.1 Concurrency Limits Are Per Job Type

Every job type defines its maximum concurrent execution count — the number of instances of that job type that may run simultaneously. A job type with a concurrency limit of 1 ensures that at most one instance runs at any moment, regardless of how many are waiting. This prevents the same job type from generating excessive load on its dependencies when a backlog exists.

### 9.2 Global Concurrency Is Also Bounded

Beyond per-type limits, the Scheduler enforces a global concurrency limit — the total number of jobs across all types that may run simultaneously. The global limit prevents the Scheduler from saturating the system's resources when many job types simultaneously have backlogs.

### 9.3 Long-Running Jobs Are Isolated

A job that is expected to run for minutes rather than seconds must be isolated from the general execution pool. Long-running jobs occupy worker slots for extended periods, reducing throughput for shorter jobs. Long-running jobs are:
- Assigned to a dedicated worker pool (separate from the short-job pool)
- Given explicit execution timeout limits appropriate to their expected duration
- Monitored separately, with distinct alerting thresholds

### 9.4 Jobs Do Not Share State

Two concurrent executions of the same job type — or of different job types — must not share mutable state through global variables, module-level objects, or shared caches that are written to during job execution. Shared mutable state between concurrent jobs produces race conditions that are difficult to reproduce and diagnose.

### 9.5 Job Handlers Are Stateless

A job handler is stateless. It receives the job payload, calls Services with the payload's data, and exits. It does not accumulate state between invocations. Any state that must persist between invocations of the same job — progress tracking for a multi-step job, intermediate results — is stored through Services, which persist it to the database.

---

## 10. Performance

### 10.1 Job Execution Time Is Budgeted

Every job has a defined maximum execution time — a timeout after which the job is considered to have failed (with a `timeout` root cause). Execution time budgets are documented in the job definition and enforced by the Scheduler.

Typical execution time budgets by job category:

| Job Category | Execution Budget |
|---|---|
| Health checks, status polls | 10–30 seconds |
| Single-entity operations | 30–120 seconds |
| Small batch operations | 2–10 minutes |
| Large batch operations | 10–60 minutes |
| Bulk data processing | Set individually; must be justified |

Any job requiring more than 60 minutes must be decomposed into smaller units that can be checkpointed and resumed.

### 10.2 Batch Jobs Process Records in Pages

A batch job that processes all records in a table must not load the entire table into memory. It processes records in pages — fetching a bounded number of records, processing them, writing results, then fetching the next page. Page size is configured and appropriate to the job's memory budget and the table's row size.

### 10.3 Batch Jobs Record Progress

A batch job processing thousands of records must record its progress — how many records it has processed, what checkpoint it is at — so that if the job is interrupted, it can resume from the checkpoint rather than starting over. Progress is stored through a Service, which persists it to the database. A batch job that restarts from the beginning after every failure is not a resumable batch job.

### 10.4 Queue Depth Is Monitored

The number of jobs waiting in each queue (`PENDING` count per job type) is monitored and alerted on. A growing queue depth indicates that job enqueue rate exceeds execution rate — the Scheduler is falling behind. Early detection allows scaling the worker pool before the backlog becomes critically large.

### 10.5 Jobs Do Not Compete With Real-Time Traffic

Batch and low-priority jobs must be scheduled to minimize competition with real-time user-serving traffic. Large batch jobs that consume significant database or CPU resources must be scheduled during low-traffic periods and must implement rate limiting on their own resource consumption to avoid degrading real-time service performance.

---

## 11. Monitoring

### 11.1 Every Job Emits Standard Metrics

Every job execution, regardless of outcome, emits the following metrics to the monitoring system:

| Metric | Description |
|---|---|
| `job.started` | Job began execution; labeled with job name and attempt number |
| `job.completed` | Job completed successfully; labeled with job name and execution duration |
| `job.failed` | Job failed; labeled with job name, attempt number, and failure root cause class |
| `job.dead` | Job reached `DEAD` state; labeled with job name and total attempts |
| `job.queued` | Job was enqueued; labeled with job name and priority |
| `job.queue_depth` | Current pending count per job type (gauge, reported periodically) |
| `job.execution_duration` | Histogram of job execution durations per job type |

### 11.2 Alerts Are Defined for Each Job Type

Every registered job type has defined alert thresholds:
- **Dead job alert:** Fires within N minutes of a job reaching `DEAD` state
- **Failure rate alert:** Fires when failure rate exceeds X% over a rolling Y-minute window
- **Queue depth alert:** Fires when pending count exceeds Z for more than W minutes
- **Execution duration alert:** Fires when P95 execution duration exceeds the budget

Alert thresholds are defined at job registration and are reviewed when job behavior changes.

### 11.3 Job History Is Queryable

The job execution history — every completed, failed, and dead job record — is queryable by: job name, execution time, outcome, failure class, payload content (indexed fields only). An operator investigating an incident must be able to find all executions of a specific job type within a time window without writing custom database queries.

### 11.4 Dead Job Dashboard

A dedicated operational dashboard displays all jobs currently in `DEAD` state, sorted by failure time. The dashboard is the first stop for operators during an on-call shift. It provides: job name, payload summary, error summary, failure count, and the requeue action. A dead job dashboard that is routinely empty is a healthy Scheduler.

### 11.5 Scheduler Health Is Reported

The Scheduler itself — not just the individual jobs — reports its health: worker pool utilization, queue processing lag (time between enqueue and execution start), infrastructure error rate (failures to enqueue, failures to claim). A Scheduler that is healthy but whose jobs are failing is a different problem from a Scheduler that is itself degraded.

---

## 12. Best Practices

1. **Keep job handlers thin.** The job handler resolves context and calls a Service. If the handler is more than 20–30 lines, it has absorbed logic that belongs in a Service. Thin handlers are readable, testable, and correct by inspection.

2. **Name jobs for what they do, not when they run.** `send-daily-summary-digest` is better than `daily-8am-job`. The name must be meaningful to someone reading the dead job dashboard at 3 AM who has never seen the job before.

3. **Design for idempotency from the first line.** Every delayed job must be idempotent. Design idempotency into the job's first implementation — retrofitting idempotency to an existing job is significantly more difficult. The idempotency key is typically the job's payload identifier (account ID, message ID) and the operation type.

4. **Test job handlers with a real Service mock.** Job handlers are entry points. Their tests verify that the right Service is called with the right parameters for a given payload, that Service failures are handled correctly, and that the handler returns the correct result classification (success, retryable failure, permanent failure).

5. **Set conservative timeouts.** Start with a shorter timeout than you think you need. A job that occasionally times out reveals that it is too slow — prompting optimization. A job with a very long timeout can run indefinitely without being detected.

6. **Separate job registration from job execution.** Job registration (defining what jobs exist, their schedules, and their configurations) must be separable from job execution (running the handler). This allows the complete list of registered jobs to be inspected without running the application.

7. **Log job context at start and finish.** At handler entry: log the job ID, job name, and a summary of the payload. At handler exit: log the outcome, duration, and any significant metrics (records processed, Services called). These logs are the job's execution trace for incident investigation.

---

## 13. Anti-Patterns

### 13.1 The Business Logic Job

A job handler that contains domain conditionals, applies business rules, transforms domain objects, or coordinates multiple Services with branching logic. The job handler has absorbed Service responsibility. The symptom: the handler contains `if (account.status === 'premium')` or `if (deliveryCount > threshold)`. These conditions belong in the Service the handler should be calling.

### 13.2 The Polling Job That Should Be an Event

A job that polls the database every N seconds to check whether a condition has changed — "has a new message arrived?", "has the session been invalidated?" — when the condition change could be captured as an event. Polling jobs consume resources continuously; event handlers consume resources only when something changes. Polling is appropriate when events are not available. When events are available, they are preferred.

### 13.3 The Infinite Retry Job

A job configured with `retryAttempts: Infinity` or effectively unlimited retries, on the grounds that "this job must eventually succeed." A job that never reaches `DEAD` state never requires human attention. A job that is silently retrying thousands of times against an unresolvable failure condition is consuming resources invisibly. Every job has a finite retry limit. When the limit is reached, a human looks at it.

### 13.4 The Monolithic Batch Job

A single batch job that processes every type of record in the system — accounts, messages, sessions, contacts — in a single handler. When this job fails, the failure is ambiguous. When this job is slow, the slowness is ambiguous. When this job needs to change, the change touches everything. Batch jobs are specific: one job per record type per operation.

### 13.5 The Scheduled Service Workaround

A cron job that exists because a Service has a known bug — "we run this job every hour to fix the bad data that the Service creates." The job is a workaround, not a feature. The job hides the Service bug from discovery. The correct response to a Service bug is fixing the Service — not scheduling a cleanup job that permanently masks it.

### 13.6 The Silent Failure Job

A job handler that catches all exceptions, logs them, and returns success. The job never fails from the Scheduler's perspective — it always completes. But the work was not done. The Scheduler's `DEAD` state and retry mechanism exist precisely to handle failures visibly. A job that swallows its failures is invisible to operators and produces incorrect system state silently.

### 13.7 The Cross-Environment Job

A job that is defined in one environment (production) but not in another (staging, development) — because someone created it manually or through a one-off script. When the job fails in production, it cannot be reproduced or debugged in staging. All job definitions exist in code, in all environments.

---

## 14. Forbidden Scheduler Practices

### 14.1 Business Logic in Job Handlers

A job handler that contains domain decisions, business rule enforcement, or domain object transformations. Business logic lives in Services. Handlers call Services.

### 14.2 Direct Database Access from Job Handlers

A job handler that imports a database client or ORM and issues queries directly. Data access goes through Services, which call Repositories. A handler that bypasses this chain violates the access boundary defined in `17-database-policy.md`.

### 14.3 Direct Facebook Layer Access from Job Handlers

A job handler that imports Facebook Layer components — `SessionManager`, `MessageGateway`, `FacebookTransport` — and calls them directly. Any Facebook Layer interaction from a scheduled job goes through a Service that abstracts the Facebook Layer.

### 14.4 Infinite Retry Configuration

Configuring any job with unlimited or extremely high (> 20) retry attempts is forbidden. Infinite retry jobs never die, never alert, and never require human investigation. Every job has a finite retry limit.

### 14.5 Unclassified Failure Returns

A job handler that exits on failure without classifying the failure as retryable or permanent is forbidden. The Scheduler cannot apply the correct retry policy to an unclassified failure. Every failure exit path from a job handler carries an explicit classification.

### 14.6 Job Handlers That Modify Other Jobs

A job handler that enqueues, cancels, or modifies other jobs directly — as part of its business logic — is forbidden. The only exception: a job that is designed as a dispatcher (a job whose sole purpose is to enqueue other jobs based on current system state) is permitted, but must be explicitly labeled as a dispatcher job and must contain only dispatching logic with no business logic.

### 14.7 Jobs Scheduled Through the Database Directly

Creating a job by inserting a record into the job queue table directly — bypassing the Scheduler's API — is forbidden. The Scheduler's job registration API is the only valid channel for creating jobs. Direct database insertion bypasses validation, event emission, and any initialization the Scheduler performs when registering a job.

---

## 15. AI Scheduler Rules

This section defines how an AI system must reason about the Scheduler when developing within Void.

### 15.1 The AI Must Generate Thin Handlers

When the AI generates a job handler, it must generate a thin handler: resolve context → call Service → return result. If the AI finds itself writing conditional logic or multi-step workflows inside the handler body, it must stop and move that logic to a Service. The AI must not deliver a job handler that contains business logic.

### 15.2 The AI Must Identify the Correct Service Before Writing the Handler

Before generating a job handler, the AI must identify which existing Service provides the required capability. If no Service exists, the AI must define and generate the Service first. A job handler that calls a Service that does not exist is incomplete.

### 15.3 The AI Must Generate Idempotency for Every Delayed Job

When the AI generates a delayed job, it must simultaneously generate the idempotency mechanism — typically: read the target entity's current state; if the operation has already been applied, exit with success; otherwise proceed. The AI must not deliver a delayed job handler without idempotency.

### 15.4 The AI Must Define a Retry Policy at Job Registration

Every job the AI generates must include an explicit retry policy in the job definition: maximum attempts, backoff strategy, and which failure types are retryable. A job definition without a retry policy is incomplete.

### 15.5 The AI Must Generate Monitoring Metrics

When the AI generates a job handler, it must generate the metric emission code: `job.started` at entry, `job.completed` or `job.failed` at exit, and execution duration. A job handler without monitoring instrumentation is incomplete.

### 15.6 The AI Must Not Generate Polling Jobs Where Events Exist

When the AI is asked to implement behavior that reacts to a state change, it must first determine whether that state change is captured as an event in the Event System. If it is, the AI must implement an Event Handler — not a polling job. The AI must document why a polling job was chosen if an event-based approach was not viable.

### 15.7 The AI Must Classify All Failure Exits

When the AI generates error handling in a job handler, every `catch` block and every error return must include an explicit retryability classification. The AI must not generate a `catch (error) { return failure }` without `{ retryable: false }` or `{ retryable: true, reason: '...' }`.

### 15.8 The AI Must Design Resumable Batch Jobs

When the AI generates a batch job that processes a large number of records, it must generate:
- Pagination (fetch N records at a time)
- Progress checkpointing (store progress through a Service)
- Checkpoint-aware startup (read the checkpoint before starting; skip already-processed records)

A batch job that is not resumable must not be delivered for large datasets.

### 15.9 The AI Must Set Execution Timeouts

Every job the AI generates must have an execution timeout set in the job definition. The AI must not generate a job with no timeout. The timeout value must be justified by the job's expected execution profile — not set to a large default to avoid dealing with timeouts.

### 15.10 When a New Job Type Is Needed

When the AI determines that a new job type is needed, it must:
1. Define the job's name and purpose
2. Identify the Service it will call
3. Define the execution budget (timeout)
4. Define the retry policy
5. Define the priority level
6. Define the concurrency limit
7. Generate the handler, registration, and tests together as a single unit

A partial job implementation — a handler without a registration, or a registration without a retry policy — must not be delivered.

---

## 16. Review Checklist

Use this checklist for every code review that introduces or modifies a scheduled job.

### Handler Design
- [ ] The handler is thin — context resolution, Service call, result return only
- [ ] No business logic is present in the handler — no domain conditionals, no domain transformations
- [ ] No direct database access in the handler — data access goes through Services
- [ ] No direct Facebook Layer access in the handler — platform interaction goes through Services
- [ ] The handler emits `job.started`, `job.completed` or `job.failed`, and execution duration metrics

### Job Definition
- [ ] The job has a globally unique, descriptive name
- [ ] The job has an explicit priority level with justification
- [ ] The job has an execution timeout with justification
- [ ] The job has an explicit retry policy: maximum attempts, backoff strategy, retryable error types
- [ ] The job's overlap behavior is defined (for cron jobs): Skip, Queue, or Terminate
- [ ] Cron expressions are in UTC and have human-readable comments
- [ ] The concurrency limit is defined

### Idempotency
- [ ] Delayed jobs have explicit idempotency logic
- [ ] The idempotency key is defined and documented
- [ ] Re-execution with the same payload produces the same outcome

### Failure Handling
- [ ] Every failure exit path carries an explicit retryability classification
- [ ] Permanent failures (bad payload, business rule violation) are classified as non-retryable
- [ ] Transient failures (infrastructure unavailability) are classified as retryable
- [ ] The handler never swallows exceptions silently and returns success

### Batch Jobs (if applicable)
- [ ] Records are processed in pages — no full-table loading
- [ ] Progress is checkpointed through a Service
- [ ] Job startup reads the checkpoint and skips already-processed records
- [ ] Page size is configured and appropriate to the job's memory budget

### Monitoring
- [ ] Dead job alerts are configured for this job type
- [ ] Failure rate alerts are configured with appropriate thresholds
- [ ] Queue depth alerts are configured
- [ ] Execution duration alerts are configured against the defined budget

### Testing
- [ ] The handler is tested in isolation with a mocked Service
- [ ] Tests cover the success path
- [ ] Tests cover retryable failure (Service returns unavailable)
- [ ] Tests cover permanent failure (Service returns validation error)
- [ ] Tests verify that the correct failure classification is returned
- [ ] For delayed jobs: tests verify idempotency (second execution produces same outcome)

---

*This document is the official and sole reference for Scheduler design in Void. The Scheduler is a timing mechanism. It wakes jobs up — it does not make decisions, access the database, or talk to Facebook. Every job is a thin entry point that delegates immediately to a Service. Every job has a retry limit, a timeout, and a monitoring configuration. A Scheduler that is invisible in the monitoring dashboard — no dead jobs, no queue depth alerts, no failure rate spikes — is a healthy Scheduler.*
