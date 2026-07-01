# 08 — Logging Policy

> **Status:** Official  
> **Scope:** All layers of Void — API, Domain, Infrastructure, Plugins, Commands, Schedulers, Cache, Facebook Integration, Session Management  
> **Authority:** This document is the single source of truth for all logging decisions across the entire Void project. No layer, module, or subsystem is exempt.

---

## Table of Contents

1. [Logging Philosophy](#1-logging-philosophy)
2. [Logging Goals](#2-logging-goals)
3. [Log Levels](#3-log-levels)
4. [Log Categories](#4-log-categories)
5. [Structured Logging](#5-structured-logging)
6. [Log Format](#6-log-format)
7. [Log Context](#7-log-context)
8. [Log Metadata](#8-log-metadata)
9. [Correlation IDs](#9-correlation-ids)
10. [Request Tracing](#10-request-tracing)
11. [Performance Logging](#11-performance-logging)
12. [Startup Logging](#12-startup-logging)
13. [Shutdown Logging](#13-shutdown-logging)
14. [Facebook Logging](#14-facebook-logging)
15. [Session Logging](#15-session-logging)
16. [Authentication Logging](#16-authentication-logging)
17. [Database Logging](#17-database-logging)
18. [Cache Logging](#18-cache-logging)
19. [Scheduler Logging](#19-scheduler-logging)
20. [Plugin Logging](#20-plugin-logging)
21. [Command Logging](#21-command-logging)
22. [Middleware Logging](#22-middleware-logging)
23. [Error Logging](#23-error-logging)
24. [Security Logging](#24-security-logging)
25. [Audit Logging](#25-audit-logging)
26. [Sensitive Data Policy](#26-sensitive-data-policy)
27. [Log Retention Policy](#27-log-retention-policy)
28. [Log Rotation Strategy](#28-log-rotation-strategy)
29. [Debug Logging](#29-debug-logging)
30. [Production Logging](#30-production-logging)
31. [Development Logging](#31-development-logging)
32. [Monitoring Integration](#32-monitoring-integration)
33. [Forbidden Logging Practices](#33-forbidden-logging-practices)
34. [Common Mistakes](#34-common-mistakes)
35. [Anti-Patterns](#35-anti-patterns)
36. [AI Logging Rules](#36-ai-logging-rules)
37. [Review Checklist](#37-review-checklist)

---

## 1. Logging Philosophy

Logging is not debugging output left behind by accident — it is a deliberate, engineered discipline that makes a system observable, diagnosable, and trustworthy over time.

In Void, every log entry is a first-class artifact of the system. It exists to serve a purpose: enabling an engineer or operator to understand what the system did, when, in what context, and why. A log that does not serve this purpose has no place in the codebase.

### Core Axioms

1. **Every log entry must earn its place.** If a log line cannot answer a concrete diagnostic question, it should not exist. Volume without signal is noise — and noise makes real problems harder to find.

2. **Logs are for humans under pressure.** They are read during incidents, debugging sessions, and post-mortems — often at odd hours by people who did not write the code. Clarity, completeness, and searchability are non-negotiable.

3. **Logs must never be the source of a breach.** A log is only as safe as its least careful entry. Sensitive data in a log file can remain there for months or years, accessible to anyone with log access.

4. **Structure enables analysis.** Free-text logs are human-readable but machine-hostile. Structured logs are both — and they scale to monitoring, alerting, and dashboards. Every log entry in Void is structured.

5. **Consistency is a prerequisite for trust.** A system that logs inconsistently — different formats, missing fields, varying levels — cannot be reliably monitored. Void uses a single logger, a single format, and a single set of conventions across all layers.

6. **Logging must not impact correctness.** A log write that fails must never cause the business operation to fail. Logging is a side effect — not part of the critical path.

7. **Context makes a log entry useful; its absence makes it worthless.** "Request failed" is not a log — it is a placeholder. "Request failed: POST /api/posts/publish, postId=abc123, accountId=xyz, duration=1240ms, error=FacebookTokenExpired" is a log.

---

## 2. Logging Goals

The logging system in Void is designed to achieve the following concrete goals:

### 2.1 Diagnosability

When something goes wrong, logs must provide a complete picture of the system's behavior leading up to, during, and after the failure. An engineer must be able to reconstruct the sequence of events from logs alone — without access to the live system.

### 2.2 Observability

Logs feed into the broader observability stack. They must be structured and consistent enough to support dashboards, alerts, and automated analysis. Every log entry must be queryable by any of its fields.

### 2.3 Auditability

Certain categories of events — user actions, authentication events, data mutations, permission changes — must be logged in a way that creates a durable, tamper-evident audit trail. Audit logs serve compliance, security investigations, and forensic analysis.

### 2.4 Performance Monitoring

Logs must capture timing and throughput data for critical operations — request durations, database query times, external API call durations, job execution times — so that performance regressions can be identified before they impact users.

### 2.5 Security Visibility

Security-relevant events — failed authentication attempts, authorization denials, suspicious access patterns, token operations — must be logged with sufficient detail to enable threat detection and incident response.

### 2.6 Development Feedback

In development environments, logs provide immediate feedback on system behavior during active development. Development logs are more verbose, human-formatted, and include debug-level detail not appropriate for production.

---

## 3. Log Levels

Void uses six log levels, ordered from most to least severe. Every log entry must be assigned exactly one level. The choice of level is not stylistic — it is a semantic declaration about the nature of the event.

### 3.1 `fatal`

**Definition:** The system — or a critical subsystem — is in a state from which it cannot recover without intervention. The process may exit imminently or must exit to prevent data corruption.

**When to use:**
- A required environment variable is missing at startup
- A critical database migration has failed
- An unhandled exception has reached the process-level handler
- A core invariant has been violated in a way that makes continued operation unsafe

**Response required:** Immediate operator attention. Alert must fire. Process may exit.

**Volume:** Extremely rare. A single `fatal` in production is a critical incident.

---

### 3.2 `error`

**Definition:** A specific operation has failed in a way that requires investigation. The system continues operating, but the affected operation did not complete successfully.

**When to use:**
- An unhandled exception reaches the global error handler
- All retry attempts for a recoverable operation are exhausted
- A scheduled job fails after all retries
- An external API call fails with a non-retryable error
- A database operation fails with a non-constraint error

**Response required:** Should be reviewed. May require a fix or infrastructure intervention. Alert may fire depending on rate.

**Volume:** Low. Elevated `error` rates are a health signal and must be monitored.

---

### 3.3 `warn`

**Definition:** Something unexpected happened, but the system recovered or degraded gracefully. The operation completed, possibly through a fallback, but the situation is worth attention.

**When to use:**
- A retry attempt is made (before final failure)
- A cache miss triggers a fallback to the database
- A fallback strategy is applied
- A deprecated code path is used
- A configuration value is missing but a default is applied
- A rate limit warning threshold is approaching
- A plugin failed to load and was disabled

**Response required:** No immediate action required, but should be reviewed periodically. Elevated `warn` rates may indicate a systemic problem.

**Volume:** Moderate. Too many warnings are a signal that the system is under stress.

---

### 3.4 `info`

**Definition:** A significant, expected business or system event has occurred. This is the standard level for normal operational logging.

**When to use:**
- A server starts or shuts down
- A user authenticates successfully
- A scheduled job starts or completes
- A Facebook post is published
- A campaign is created or modified
- A plugin initializes successfully
- A command executes successfully
- An API request is received and responded to (summary — not every field)

**Response required:** None. Info logs are the operational heartbeat of the system.

**Volume:** Moderate. Info logs should tell the story of the system's normal operation without overwhelming storage.

---

### 3.5 `debug`

**Definition:** Detailed diagnostic information useful during development or targeted investigation of a specific problem. Not appropriate for production by default.

**When to use:**
- Intermediate state during a complex operation
- Input and output of a non-trivial function
- Decision points in branching logic
- Database query parameters (sanitized)
- Cache hit/miss details
- Internal state transitions

**Response required:** None. Debug logs are consumed by engineers during active investigation.

**Volume:** High. Debug logging must be disabled in production by default and enabled only during targeted troubleshooting with a defined time window.

---

### 3.6 `trace`

**Definition:** The most granular level — step-by-step execution detail for deep diagnostics. Intended for development environments and temporary investigation only.

**When to use:**
- Function entry and exit
- Every iteration of a loop processing large datasets
- Raw HTTP request/response bodies (sanitized)
- Detailed plugin lifecycle steps

**Response required:** None. Trace logs are transient and must never be enabled in production.

**Volume:** Very high. Trace logging in production would generate enormous, unusable output and impact performance.

---

### 3.7 Level Selection Decision Guide

```
Is the system unable to continue safely?                         → fatal
Did an operation fail and require investigation?                 → error
Did something unexpected happen but the system recovered?        → warn
Did a significant expected event occur (business / lifecycle)?   → info
Is this detail useful for diagnosing a specific problem?         → debug
Is this step-by-step execution detail for deep investigation?    → trace
```

---

## 4. Log Categories

Beyond levels, log entries belong to named categories that enable filtering and routing. Every log entry must declare its category.

| Category | Description |
|---|---|
| `http` | Incoming HTTP requests and responses |
| `auth` | Authentication and session events |
| `authz` | Authorization checks and decisions |
| `database` | Database queries, connections, transactions |
| `cache` | Cache reads, writes, misses, evictions |
| `facebook` | All Facebook Graph API interactions |
| `scheduler` | Job scheduling, execution, completion, failure |
| `plugin` | Plugin lifecycle and execution |
| `command` | Command bus dispatch and execution |
| `middleware` | Middleware execution events |
| `security` | Security-relevant events (threats, anomalies) |
| `audit` | User-initiated mutations and access events |
| `performance` | Timing and throughput measurements |
| `startup` | Process startup sequence |
| `shutdown` | Process shutdown sequence |
| `system` | Internal system events not fitting other categories |

---

## 5. Structured Logging

All log entries in Void are structured — emitted as JSON objects, not free-text strings.

### 5.1 Why Structured Logging

Structured logs are:
- **Queryable:** Every field can be searched, filtered, and aggregated independently
- **Machine-parseable:** Log aggregation tools (Datadog, Loki, CloudWatch, Elasticsearch) consume them natively
- **Consistent:** Structure enforces completeness — a missing required field is a bug, not just a formatting choice
- **Safe:** Sensitive values are easier to detect and redact in structured fields than in concatenated strings

### 5.2 The Void Logger

Every module, service, layer, and subsystem in Void uses a single shared logger instance — never `console.log`, `console.error`, or any other direct output mechanism. The logger is the only sanctioned logging interface.

In request handlers, logging is performed via `req.log` — the per-request logger child that automatically includes request context (request ID, user ID, method, path). Outside of request context (jobs, startup, background processes), the singleton `logger` is used directly.

### 5.3 Creating Child Loggers

For subsystems with consistent contextual fields, a child logger is created from the root logger with those fields bound:

```
// Conceptual — not implementation code
const pluginLogger = logger.child({ category: 'plugin', pluginName: 'my-plugin', pluginVersion: '1.2.0' });
```

Child loggers inherit all parent fields and add their own. This prevents repetitive field inclusion on every log call within the subsystem.

---

## 6. Log Format

### 6.1 Production Format (JSON)

In production, every log entry is a single-line JSON object:

```json
{
  "timestamp": "2026-07-01T10:23:45.123Z",
  "level": "info",
  "category": "http",
  "message": "Request completed",
  "requestId": "req_8f3a2b1c",
  "method": "POST",
  "path": "/api/posts/publish",
  "statusCode": 200,
  "duration": 342,
  "userId": "usr_abc123",
  "accountId": "acc_xyz789"
}
```

Rules:
- One JSON object per line — no multi-line JSON in production
- `timestamp` is always ISO 8601 UTC
- All field names are `camelCase`
- No trailing whitespace or formatting
- No ANSI color codes

### 6.2 Development Format (Pretty)

In development, logs are formatted for human readability with color, indentation, and aligned columns. The underlying data model is identical — only the presentation differs.

```
10:23:45.123 INFO  [http] Request completed | requestId=req_8f3a2b1c method=POST path=/api/posts/publish status=200 duration=342ms userId=usr_abc123
```

### 6.3 Required Fields on Every Entry

These fields must be present on every log entry regardless of level or category:

| Field | Type | Description |
|---|---|---|
| `timestamp` | `string` | ISO 8601 UTC datetime with milliseconds |
| `level` | `string` | One of: `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `category` | `string` | One of the defined categories from Section 4 |
| `message` | `string` | A clear, specific, human-readable description of the event |

---

## 7. Log Context

Context is the set of fields that tell the story around a log entry — who did what, where, and in what state.

### 7.1 Request Context

Every log entry made within the lifecycle of an HTTP request must include:

| Field | Description |
|---|---|
| `requestId` | The unique trace ID for this request (see Section 9) |
| `method` | HTTP method: GET, POST, PUT, DELETE, etc. |
| `path` | The request path (without query string by default) |
| `userId` | The authenticated user's ID (if authenticated) |
| `accountId` | The active account ID (if applicable) |
| `ip` | The client IP address (for security logs only — not routine logs) |

### 7.2 Job Context

Every log entry made within a scheduled job or background task must include:

| Field | Description |
|---|---|
| `jobId` | Unique identifier for this job execution |
| `jobName` | The registered name of the job |
| `scheduledAt` | When the job was scheduled to run |
| `startedAt` | When execution actually began |
| `attemptNumber` | Which attempt this is (1 for first run) |

### 7.3 Error Context

Every log entry at `error` or `fatal` level must include the fields defined in `07-error-handling.md` Section 9.2 in addition to the standard context fields.

### 7.4 Domain Context

Log entries for domain operations must include the identifiers of the entities involved:

```json
{
  "postId": "post_abc123",
  "accountId": "acc_xyz789",
  "campaignId": "camp_def456",
  "operation": "publishPost"
}
```

---

## 8. Log Metadata

Metadata is system-level information attached to log entries that enables infrastructure-level filtering and routing — distinct from business context.

### 8.1 Standard Metadata Fields

| Field | Description | Source |
|---|---|---|
| `service` | The name of the service emitting the log | Configured at logger initialization |
| `version` | The deployed version of the service | Injected at build time |
| `environment` | `development`, `staging`, `production` | `NODE_ENV` |
| `hostname` | The machine or container identifier | `os.hostname()` |
| `pid` | The process ID | `process.pid` |

### 8.2 Metadata Is Set Once

Metadata fields are configured at logger initialization and automatically included in every log entry. They must not be manually repeated in individual log calls.

---

## 9. Correlation IDs

A correlation ID (also called a request ID or trace ID) is a unique identifier assigned to each incoming request and propagated through every log entry generated during that request's lifecycle.

### 9.1 Purpose

Correlation IDs enable reconstructing the complete execution path of a single request across:
- Multiple log entries from the same request
- Multiple services (if Void expands to a multi-service architecture)
- Asynchronous operations spawned by the request

### 9.2 Assignment

A correlation ID is assigned at the earliest possible point in the request lifecycle — at the ingress middleware, before any other processing occurs.

Assignment rules:
- If the incoming request includes an `X-Request-ID` header with a valid UUID, use it (enables end-to-end tracing from clients or upstream services)
- Otherwise, generate a new UUID (v4) for this request
- The assigned ID is attached to `req.log` and to the response via `X-Request-ID` header

### 9.3 Format

Correlation IDs must be:
- UUID v4 format (or a prefixed variant: `req_<uuid>`)
- Globally unique across the system
- Opaque to users — they carry no encoded business meaning

### 9.4 Propagation

The correlation ID must be:
- Included in every log entry made during the request lifecycle via `req.log`
- Included in every outbound HTTP request made on behalf of the original request (via `X-Request-ID` header)
- Included in the error response returned to the client (so users can report it to support)
- Never logged after the request completes — it is scoped to the request

---

## 10. Request Tracing

Request tracing captures the lifecycle of every HTTP request processed by the system.

### 10.1 What to Log Per Request

**On request received** (`debug` level):
- Method, full path (including query string — sanitized), content type
- Correlation ID
- Authenticated user ID (if already resolved)

**On request completed** (`info` level):
- Method, path (without query string)
- HTTP status code
- Response duration in milliseconds
- Authenticated user ID
- Correlation ID

**On request error** (`error` level):
- All fields from the completion log
- Error code, error type, error message (sanitized)
- Full error context per `07-error-handling.md`

### 10.2 What Not to Log Per Request

- Request body contents (may contain sensitive data — sanitize first if needed)
- Response body contents (may be large — never log in production)
- Authorization headers or token values
- Cookie values
- Query string parameters that may contain tokens or credentials

### 10.3 Slow Request Detection

Requests exceeding a defined duration threshold must be logged at `warn` level with a `slowRequest: true` flag, regardless of outcome.

Default threshold: `2000ms`. Critical endpoints may have lower thresholds.

---

## 11. Performance Logging

Performance logs capture timing and throughput data for operations that are critical to system health and user experience.

### 11.1 What to Measure and Log

| Operation | Log Level | Fields to Include |
|---|---|---|
| HTTP request total duration | `info` | `duration`, `method`, `path`, `statusCode` |
| Database query duration | `debug` | `duration`, `queryType`, `table`, `rowsAffected` |
| Cache operation duration | `debug` | `duration`, `operation`, `hit` |
| Facebook API call duration | `info` | `duration`, `endpoint`, `method`, `statusCode` |
| Scheduled job execution time | `info` | `duration`, `jobName`, `outcome` |
| Plugin execution time | `debug` | `duration`, `pluginName`, `hook` |
| Command execution time | `info` | `duration`, `commandName`, `outcome` |

### 11.2 Threshold-Based Alerting

Define warning thresholds for each operation type. When an operation exceeds its threshold, log at `warn` with a `performanceAlert: true` flag:

| Operation | Warning Threshold |
|---|---|
| HTTP request | 2,000ms |
| Database query | 500ms |
| Cache operation | 50ms |
| Facebook API call | 3,000ms |
| Scheduled job | Per-job configuration |

### 11.3 Never Log Sensitive Data in Performance Logs

Performance logs must include timing data and operation identifiers — never request payloads, response bodies, or user-specific data beyond IDs.

---

## 12. Startup Logging

Startup logs capture the initialization sequence of the Void process.

### 12.1 Required Startup Log Entries

Every startup sequence must log, in order:

1. **Process start** (`info`): Service name, version, environment, Node.js version, PID
2. **Configuration loaded** (`info`): Indication that configuration was read successfully — never log configuration values
3. **Database connection established** (`info`): Connection pool size, host (no credentials)
4. **Cache connection established** (`info`): Host, connection mode (no credentials)
5. **Migrations checked** (`info`): Number of pending migrations, whether they were applied
6. **Plugins loaded** (`info`): Number of plugins loaded, plugin names and versions
7. **Routes registered** (`info`): Number of routes registered (summary, not each route)
8. **Scheduler initialized** (`info`): Number of jobs registered
9. **Server listening** (`info`): Port, host, environment

### 12.2 Startup Failures

If any startup step fails:
- Log at `fatal` level with full error detail
- Do not continue the startup sequence
- Exit the process with a non-zero code

### 12.3 What Not to Log at Startup

- Environment variable values (any of them)
- Database connection strings
- Secret keys or tokens used for initialization
- File system paths that reveal server structure (if security-sensitive)

---

## 13. Shutdown Logging

Shutdown logs capture the graceful termination sequence.

### 13.1 Required Shutdown Log Entries

1. **Shutdown signal received** (`info`): Signal type (SIGTERM, SIGINT), PID
2. **Accepting no new requests** (`info`): HTTP server has stopped accepting connections
3. **Draining in-flight requests** (`info`): Number of active requests being waited on
4. **Scheduler stopped** (`info`): Number of running jobs that were waited for
5. **Database connections closed** (`info`): Pool drained
6. **Cache connection closed** (`info`)
7. **Plugins torn down** (`info`): Number of plugins cleanly shut down
8. **Process exiting** (`info`): Exit code

### 13.2 Ungraceful Shutdown

If the shutdown sequence exceeds the timeout and a forced exit occurs:
- Log at `error` the list of operations that did not complete cleanly
- Log at `info` that a forced exit is occurring with the timeout duration

---

## 14. Facebook Logging

All interactions with the Facebook Graph API must be logged according to this section.

### 14.1 What to Log for Every Facebook API Call

**Before the call** (`debug`):
- Endpoint (method + path)
- Request parameters (sanitized — see Section 26)
- Account ID or Page ID being acted upon

**After a successful call** (`info`):
- Endpoint
- HTTP status code
- Duration in milliseconds
- Summary of result (post ID published, number of insights returned — not the full payload)

**After a failed call** (`error` or `warn` per error type):
- Endpoint
- HTTP status code
- Facebook error code and error type
- Duration
- Whether a retry will be attempted

### 14.2 What Never to Log for Facebook Calls

- Access tokens (user tokens, page tokens, app tokens)
- App secrets
- Full API response payloads (may contain user data)
- User personal information returned by the API

### 14.3 Rate Limit Logging

When a Facebook rate limit response is received:
- Log at `warn` with the rate limit type, retry-after duration, and affected account/page
- Log each retry attempt at `debug`
- Log final exhaustion at `error`

### 14.4 Token Event Logging

Token-related events (expiry detected, refresh attempted, refresh failed) must be logged at `warn` or `error` respectively with the account ID — never with the token value itself.

---

## 15. Session Logging

Session logs track the creation, use, and termination of user sessions.

### 15.1 What to Log

- **Session created** (`info`): User ID, session creation timestamp, IP (for security logs), client type
- **Session validated** (`debug`): User ID, session age — only if debug is enabled
- **Session expired** (`info`): User ID, session age, reason (timeout, forced logout)
- **Session destroyed** (`info`): User ID, reason (user logout, admin action, security revocation)
- **Session validation failure** (`warn`): Reason (expired, not found, malformed) — no session data

### 15.2 What Never to Log

- Session tokens or session IDs (they are credentials)
- Session secret keys
- Cookie values
- The full session store payload
- Any data stored inside the session object

---

## 16. Authentication Logging

Authentication logs track identity verification events.

### 16.1 What to Log

- **Authentication attempt** (`info`): Method (password, OAuth, token), source IP (security context only)
- **Authentication success** (`info`): User ID, method, IP (security context)
- **Authentication failure** (`warn`): Method, failure reason category (invalid credentials, account locked, token expired), IP — no credential values
- **Password reset requested** (`info`): User ID or email domain only — not full email unless required
- **Multi-factor event** (`info`): User ID, MFA method, outcome
- **Account lockout triggered** (`warn`): User ID, reason, lockout duration

### 16.2 Enumeration Attack Prevention

Authentication failure logs must never indicate whether the user account exists. Use generic failure reasons: "Invalid credentials" rather than "User not found" or "Incorrect password."

### 16.3 What Never to Log

- Passwords (plaintext or hashed)
- Authentication tokens
- OTP codes or MFA secrets
- Security questions or answers
- The specific reason that distinguishes "wrong password" from "no account" (prevents enumeration)

---

## 17. Database Logging

Database logs track all interactions with PostgreSQL.

### 17.1 What to Log

- **Connection established** (`info`): Pool size, host (no credentials)
- **Connection lost and recovered** (`warn`): Duration of outage, number of reconnect attempts
- **Query executed** (`debug`): Query type (SELECT, INSERT, UPDATE, DELETE), table name, duration, rows affected — never the full SQL with parameters
- **Slow query detected** (`warn`): Table, query type, duration, a sanitized description — never raw SQL
- **Transaction started and committed** (`debug`): Transaction ID, duration
- **Transaction rolled back** (`warn`): Transaction ID, rollback reason
- **Connection pool exhausted** (`error`): Pool size, wait duration, pending requests
- **Migration applied** (`info`): Migration name, duration
- **Constraint violation** (`info`): Constraint name, table — no row data

### 17.2 What Never to Log

- Full SQL queries with bound parameters (may contain user data or reveal schema)
- Raw database error messages with table/column names in production
- Row data from query results
- Connection strings or credentials
- Schema details beyond what is necessary for diagnosis

---

## 18. Cache Logging

Cache logs track all interactions with the caching layer (Redis).

### 18.1 What to Log

- **Cache hit** (`debug`): Cache key pattern (anonymized — see below), operation type
- **Cache miss** (`debug`): Cache key pattern, fallback triggered
- **Cache write** (`debug`): Cache key pattern, TTL set, value size in bytes
- **Cache eviction or expiry** (`debug`): Key pattern (when observable)
- **Cache read failure** (`warn`): Key pattern, error type, fallback applied
- **Cache write failure** (`warn`): Key pattern, error type, operation result (continued without cache)
- **Cache connection lost** (`error`): Duration, reconnect attempt count
- **Cache connection restored** (`info`)
- **Cache flush** (`warn`): Scope of flush (full, pattern), reason

### 18.2 Cache Key Anonymization

Cache keys often contain entity IDs (user IDs, account IDs, post IDs). Log the key pattern — not the full key with sensitive ID values — unless the ID is necessary for diagnosis:

```
// Pattern (safe to log):  user:sessions:*
// Full key (log only ID): user:sessions:usr_abc123
// Never log:              user:sessions:usr_abc123:token_xyz789
```

### 18.3 What Never to Log

- Cached values (may contain sensitive user data)
- Authentication tokens stored in cache
- Session data stored in cache
- Full cache key strings that contain embedded tokens or secrets

---

## 19. Scheduler Logging

Scheduler logs track the lifecycle of every scheduled job.

### 19.1 What to Log Per Job Execution

- **Job enqueued** (`info`): Job name, job ID, scheduled time, parameters (sanitized)
- **Job started** (`info`): Job name, job ID, actual start time, attempt number
- **Job completed successfully** (`info`): Job name, job ID, duration, outcome summary
- **Job failed** (`error`): Job name, job ID, duration, error type and code, attempt number, whether retry is scheduled
- **Job retry scheduled** (`warn`): Job name, job ID, next attempt time, attempt number, delay duration
- **Job max retries exhausted** (`error`): Job name, job ID, total attempts, final error
- **Job timeout** (`error`): Job name, job ID, configured timeout, elapsed time
- **Scheduler started** (`info`): Number of registered jobs
- **Scheduler paused / resumed** (`warn`): Reason, affected jobs

### 19.2 What Never to Log in Scheduler

- Full job payload if it contains user data (log a sanitized summary or field names only)
- Credentials or tokens used within the job
- Output data from the job execution

---

## 20. Plugin Logging

Plugin logs track the lifecycle and execution of all plugins.

### 20.1 What to Log

- **Plugin discovered** (`debug`): Plugin name, version, path
- **Plugin initialized** (`info`): Plugin name, version, registered hooks
- **Plugin initialization failed** (`error`): Plugin name, version, error — plugin is disabled
- **Plugin hook executed** (`debug`): Plugin name, hook name, duration
- **Plugin hook failed** (`error`): Plugin name, hook name, error type — host system continues
- **Plugin disabled** (`warn`): Plugin name, reason
- **Plugin torn down** (`info`): Plugin name, version

### 20.2 Plugin Identity in Every Entry

Every log entry originating from or related to a plugin must include:
- `pluginName`: The plugin's registered name
- `pluginVersion`: The plugin's declared version

This enables filtering all logs for a specific plugin during investigation.

### 20.3 What Never to Log for Plugins

- Plugin-managed credentials or tokens
- Full plugin input/output payloads without sanitization
- File system paths to plugin installation directories (if security-sensitive)

---

## 21. Command Logging

Command logs track the dispatch and execution of commands through the command bus.

### 21.1 What to Log

- **Command dispatched** (`debug`): Command name, command ID, caller context (user ID, request ID)
- **Command handler started** (`debug`): Command name, command ID
- **Command succeeded** (`info`): Command name, command ID, duration, outcome summary
- **Command failed** (`error`): Command name, command ID, duration, error type and code
- **Command validation failed** (`info`): Command name, validation error summary (field names, not values)

### 21.2 Command Input Logging

Command input parameters may be logged at `debug` level — but only after sanitization. Fields that contain user-provided free text, file contents, or any potentially sensitive values must be omitted or replaced with `[REDACTED]`.

---

## 22. Middleware Logging

Middleware logs track the execution of request-processing middleware.

### 22.1 What to Log

- **Authentication middleware:** Log at `debug` when a request is authenticated; log at `info`/`warn` for authentication failures (per Section 16)
- **Authorization middleware:** Log at `debug` on permission grant; log at `info` on permission denial with the required permission and the user's current permissions
- **Rate limiting middleware:** Log at `debug` for allowed requests; log at `warn` when a rate limit threshold is reached; log at `info` when a request is rejected for rate limiting
- **CORS middleware:** Log at `warn` when a request is rejected for CORS violation, including origin
- **Request parsing middleware:** Log at `debug` for successful parsing; log at `warn` for malformed requests

### 22.2 Middleware Performance

If a middleware component takes unexpectedly long (above its defined threshold), log at `warn` with the middleware name and duration.

---

## 23. Error Logging

Error logging in Void is defined authoritatively in `07-error-handling.md` Section 9. This section adds logging-specific rules.

### 23.1 Error Log Must Be Self-Contained

An error log entry must provide enough information to understand the failure without referencing other log entries. It must include:
- What operation was being performed
- What entity was involved
- What error occurred (type and code)
- The full stack trace (in the structured `stack` field)
- The full error chain (original cause preserved)

### 23.2 Error Logging Must Not Duplicate

Do not log the same error at multiple points in the call stack. The rule is: **the layer that handles the error logs it. Layers that catch and re-throw do not log — they add context and propagate.**

Duplicate error logs for the same request create confusion about where the failure actually originated.

### 23.3 Stack Traces

Stack traces must always be included in `error` and `fatal` level logs. They must be placed in a dedicated structured field (`stack`), not embedded in the message string.

---

## 24. Security Logging

Security logs capture events that are relevant to threat detection, incident response, and compliance.

### 24.1 Events That Must Be Security-Logged

All security log entries are written at `warn` or `error` level and tagged with `category: 'security'`:

- Multiple consecutive authentication failures from the same IP or for the same account
- Authentication from an unusual geography (if baseline is established)
- Authorization denial (especially repeated denials from the same user)
- Account lockout triggered
- Password reset initiated
- Session invalidated by administrative action
- Unusual API access patterns (very high request rates, access to many accounts)
- Requests with malformed or suspicious headers
- Requests that fail input validation on security-sensitive fields (e.g., SQL injection patterns detected by WAF)
- Facebook token revocation events

### 24.2 Security Log Retention

Security logs must be retained longer than standard operational logs (see Section 27). They must be stored in a separate, access-controlled log stream.

### 24.3 Security Logs Must Be Tamper-Resistant

Security logs must be written to a destination that cannot be modified by the application process itself. The application can write — it must not be able to delete or modify past entries.

---

## 25. Audit Logging

Audit logs create a durable, attributable record of user-initiated actions that mutate system state.

### 25.1 Events That Require Audit Logs

- Creating, updating, or deleting any entity (post, campaign, account, user, plugin)
- Publishing or scheduling content to Facebook
- Modifying permissions or roles
- Connecting or disconnecting a Facebook account or Page
- Exporting data
- Administrative actions (account suspension, forced logout, manual override)

### 25.2 Required Fields for Every Audit Log Entry

| Field | Description |
|---|---|
| `auditEvent` | A specific, named event type (e.g., `post.published`, `account.disconnected`) |
| `actorId` | The user ID who performed the action |
| `actorType` | `user`, `admin`, `system`, `plugin` |
| `resourceType` | The type of entity affected (e.g., `post`, `campaign`, `account`) |
| `resourceId` | The ID of the entity affected |
| `before` | Sanitized snapshot of state before the change (for updates and deletes) |
| `after` | Sanitized snapshot of state after the change (for creates and updates) |
| `requestId` | The correlation ID of the originating request |
| `timestamp` | ISO 8601 UTC |
| `ip` | Client IP (for security-relevant audit events) |

### 25.3 Audit Logs Must Be Immutable

Once written, an audit log entry must not be modified or deleted by any application process. Audit log integrity is a compliance requirement.

### 25.4 Sanitizing Audit Log Data

The `before` and `after` snapshots must be sanitized:
- Remove password hashes
- Remove token values
- Remove any field defined as sensitive in Section 26
- Large text fields (post content, descriptions) may be truncated with a `[truncated]` marker

---

## 26. Sensitive Data Policy

This section defines what may never appear in any log entry under any circumstances.

### 26.1 Absolutely Forbidden in All Logs

The following values must never appear in any log entry at any level, in any environment:

| Category | Examples |
|---|---|
| Passwords | Plaintext passwords, password hashes, temporary passwords |
| Authentication tokens | JWTs, session tokens, OAuth access tokens, refresh tokens |
| Facebook tokens | User access tokens, page access tokens, app access tokens, app secret |
| API keys and secrets | Any `*_SECRET`, `*_KEY`, `*_TOKEN` environment variable value |
| Session data | Session IDs, session store contents, cookie values |
| Cookies | Any cookie name/value pair |
| Environment variables | The values of any environment variable (names may be logged) |
| Private keys | RSA keys, TLS private keys, signing keys |
| Financial data | Payment card numbers, bank account numbers, CVV codes |
| Government IDs | Passport numbers, national ID numbers, tax IDs |
| Full PII sets | Full name + email + address combined (individual IDs are acceptable) |

### 26.2 Conditionally Sensitive Data

The following may appear in logs only under specific conditions:

| Data | Condition for Logging |
|---|---|
| Email addresses | Audit logs and security logs only; not in routine operational logs |
| User IDs | Always acceptable — they are opaque identifiers |
| IP addresses | Security logs and audit logs only; not in routine operational logs |
| Phone numbers | Never in operational logs; audit logs only with legal basis |
| Post content | Never in operational logs; debug only in development; truncated in audit |

### 26.3 Sanitization Rules

When an operation's context includes potentially sensitive data, apply sanitization before logging:

- Replace token-like strings (long alphanumeric strings, JWTs) with `[REDACTED]`
- Replace password fields with `[REDACTED]`
- Hash or truncate email addresses in operational logs if required
- When logging request parameters, use an allowlist of safe fields rather than logging all fields

### 26.4 Sanitization Must Happen Before the Logger Call

Sanitization is the responsibility of the code calling the logger — not the logger itself. The logger must never silently drop or modify fields. If a field contains sensitive data, it must be sanitized or excluded before the log call is made.

---

## 27. Log Retention Policy

Log retention defines how long different categories of logs are kept before deletion.

| Log Category | Minimum Retention | Maximum Retention | Notes |
|---|---|---|---|
| `debug` / `trace` | Not stored in production | — | Enabled only temporarily |
| Standard operational (`info`) | 30 days | 90 days | Routine request and event logs |
| `warn` | 60 days | 180 days | |
| `error` / `fatal` | 90 days | 365 days | Required for post-incident analysis |
| Security logs | 180 days | 2 years | Regulatory and forensic requirement |
| Audit logs | 1 year | 7 years | Compliance requirement — consult legal |
| Performance logs | 30 days | 90 days | |

### 27.1 Retention Must Be Enforced Automatically

Log retention must be enforced by the log storage system — not manually. Automatic deletion after the retention period is the default. Logs required beyond the maximum must be explicitly archived with documented justification.

### 27.2 Legal Hold

Logs subject to a legal hold must be preserved regardless of retention policy. A legal hold must be documented and tracked outside the log storage system.

---

## 28. Log Rotation Strategy

Log rotation prevents log files from growing unboundedly and consuming disk space.

### 28.1 Rotation Triggers

Logs must be rotated when any of the following conditions is met:
- The log file reaches a maximum size (default: 100MB per file)
- A time interval elapses (default: daily rotation at midnight UTC)
- The process restarts (new log file per process start)

### 28.2 Retention of Rotated Files

Rotated log files on disk must be compressed immediately after rotation and retained for a minimum of 7 days locally before being archived or deleted, subject to the retention policy in Section 27.

### 28.3 Remote Log Shipping

In production, logs must be shipped to a centralized log storage system in real time — not batch-uploaded from rotated files. Local files serve only as a buffer for the shipper. If the shipper fails, the local buffer must not block the application.

---

## 29. Debug Logging

Debug logging provides diagnostic detail during development or targeted production investigation.

### 29.1 Debug Logging Is Off by Default in Production

The effective log level in production is `info`. Debug and trace logs are not written unless the level is explicitly overridden — for a defined time window, for a specific component, for a specific purpose.

### 29.2 Debug Log Hygiene

Debug log entries must:
- Be specific and targeted — not generic "entered function X" spam
- Include the diagnostic value they provide (what decision or state they reveal)
- Be removable without affecting system behavior
- Not contain sensitive data — the sensitive data policy applies at all levels

### 29.3 Temporary Debug Sessions

When debug logging is enabled in production for investigation:
- The override must be time-bounded (maximum 1 hour without renewal)
- The scope must be as narrow as possible (specific module or request path)
- All debug output must be reviewed for sensitive data before the session begins
- The level must be restored to `info` after the investigation is complete

---

## 30. Production Logging

### 30.1 Production Log Level

Effective level: `info`. Logs at `debug` and `trace` are suppressed.

### 30.2 Production Log Format

JSON only. No ANSI colors. No pretty printing. One JSON object per line.

### 30.3 Production Sampling

For extremely high-volume low-value log entries (e.g., health check requests), sampling may be applied — logging 1 in N entries rather than every occurrence. Sampling must:
- Be documented and configured explicitly
- Not be applied to `error`, `warn`, or any security/audit category
- Include a `sampled: true` flag on every sampled entry

### 30.4 Production Alerting Thresholds

The following conditions must trigger automated alerts in production:

| Condition | Alert Severity |
|---|---|
| Any `fatal` log entry | Critical |
| `error` rate exceeds baseline by 10x | High |
| `warn` rate exceeds baseline by 5x | Medium |
| No logs received for 5 minutes | High (possible process crash) |
| Security log: >10 auth failures in 1 minute from same IP | High |

---

## 31. Development Logging

### 31.1 Development Log Level

Effective level: `debug`. Trace may be enabled per-component when needed.

### 31.2 Development Log Format

Human-readable pretty format with color, aligned columns, and expanded context. The underlying JSON model is identical to production — the format is a presentation layer only.

### 31.3 Development Flexibility

In development:
- Verbose context may be included without performance concern
- Stack traces are always printed in full
- Sampling is never applied
- All events are logged without suppression

### 31.4 Development Must Not Use console.log

Even in development, `console.log` is forbidden. Developers must use the shared logger. This ensures that development habits match production discipline, and that log entries are consistently formatted and include required context even during development.

---

## 32. Monitoring Integration

The logging system is the foundation of the observability stack. Logs are the raw material from which metrics, alerts, and dashboards are derived.

### 32.1 Log-to-Metric Pipeline

The following log events must be counted as metrics by the monitoring system:

| Event | Metric Name | Dimensions |
|---|---|---|
| HTTP request completed | `http.request.duration` | method, path, statusCode |
| Database query completed | `db.query.duration` | table, queryType |
| Cache operation | `cache.operation.duration` | operation, hit |
| Facebook API call | `facebook.api.duration` | endpoint, statusCode |
| Job completed | `scheduler.job.duration` | jobName, outcome |
| Error logged | `error.count` | category, errorCode |
| Auth failure | `auth.failure.count` | method, reason |

### 32.2 Structured Fields Enable Queries

Every structured field in a log entry is a potential query dimension. This means field names must be:
- Stable across versions (renaming a field breaks historical queries)
- Consistent across all log entries of the same type
- Documented when introduced

### 32.3 Log-Based Alerting

Monitoring rules that trigger alerts based on log content must reference specific structured fields — not regex patterns on the message string. Message strings may change; structured field names are contracts.

---

## 33. Forbidden Logging Practices

The following practices are strictly prohibited in Void. Code review must reject any instance of these patterns.

### 33.1 Using `console.log` (or any `console.*`) in Production Code

```typescript
// FORBIDDEN in any file that runs in production
console.log('User authenticated:', userId);
console.error('Something failed');
console.warn('Watch out');
```

`console.*` methods bypass the structured logger entirely. They produce unformatted, unstructured output that:
- Cannot be queried or parsed reliably
- Does not include required fields (timestamp, level, category, requestId)
- Cannot be filtered by level
- Cannot be routed to the monitoring system

The only sanctioned logging interface is the shared logger or `req.log`.

### 33.2 Logging Sensitive Data

```typescript
// FORBIDDEN — logs a password
logger.info('Login attempt', { username, password });

// FORBIDDEN — logs an access token
logger.debug('Facebook call', { accessToken, endpoint });

// FORBIDDEN — logs cookie content
logger.debug('Request received', { cookies: req.cookies });

// FORBIDDEN — logs a session
logger.debug('Session state', { session: req.session });

// FORBIDDEN — logs environment variables
logger.info('Config loaded', { env: process.env });
```

Any log entry that includes a value from the forbidden list in Section 26.1 is a security violation. It must be caught in code review and corrected before merge.

### 33.3 Logging Vague or Context-Free Messages

```typescript
// FORBIDDEN — no context
logger.error('Error occurred');
logger.warn('Something went wrong');
logger.info('Done');
logger.debug('Here');
```

A log entry with no context cannot be used for diagnosis. Every message must describe the specific event, the entity involved, and the relevant state.

### 33.4 Logging Excessive Data Without Purpose

```typescript
// FORBIDDEN — logs entire response payload
logger.debug('API response', { response: fullApiResponse });

// FORBIDDEN — logs entire database result set
logger.debug('Query result', { rows: allRows });

// FORBIDDEN — logs full request body without sanitization
logger.debug('Request received', { body: req.body });
```

Logging large payloads consumes storage, slows the logger, and risks exposing sensitive data. Log summaries, counts, and specific fields — not full objects.

### 33.5 Using Incorrect Log Levels

```typescript
// FORBIDDEN — using info for an error
logger.info('Database connection failed');

// FORBIDDEN — using error for a routine event
logger.error('User requested their profile');

// FORBIDDEN — using warn for a security violation
logger.warn('Authentication token was forged');
```

Incorrect levels break monitoring and alerting. An error logged at `info` will never trigger an alert. A routine event logged at `error` will cause alert fatigue.

### 33.6 Logging the Same Event Multiple Times

```typescript
// FORBIDDEN — logging at every layer for the same event
// In repository:    logger.error('DB query failed', { error });
// In service:       logger.error('Service operation failed', { error }); // duplicate
// In controller:    logger.error('Request handler failed', { error }); // duplicate
```

Duplicate logs for the same failure event create confusion about where the error originated and inflate error counts in monitoring. The rule from Section 23.2 applies: log at the layer that handles the error — not at every layer that sees it.

### 33.7 Logging Without Category

```typescript
// FORBIDDEN — no category field
logger.info('Post published', { postId });
```

Every log entry must declare its category. Without it, logs cannot be filtered by subsystem.

### 33.8 Log Messages as Concatenated Strings

```typescript
// FORBIDDEN
logger.info('User ' + userId + ' published post ' + postId + ' to account ' + accountId);

// CORRECT
logger.info('Post published', { userId, postId, accountId });
```

String concatenation produces unstructured, unsearchable log messages. Contextual data must always be placed in structured fields.

---

## 34. Common Mistakes

These mistakes appear frequently in codebases of this type. Void engineers must actively guard against them.

1. **Using `req.log` outside a request context.** `req.log` is only valid within a request lifecycle. In background jobs, startup code, and event handlers, use the root `logger`.

2. **Forgetting to pass the error object to the logger.** `logger.error('Something failed')` with no error field loses the stack trace entirely. Always include `{ error }` in error log calls.

3. **Logging before sanitizing.** Calling the logger with unsanitized input (request body, API response) risks logging sensitive data. Sanitize first.

4. **Creating a new logger instance per module.** There is one logger with child loggers per subsystem — not one instance per file. Creating new instances disconnects logs from the global configuration and correlation context.

5. **Logging in a tight loop.** Logging inside a loop that iterates over large datasets generates enormous log volume and degrades performance. Log a summary after the loop — not each iteration.

6. **Using `debug` for events that are always useful.** If a log entry is useful in production for monitoring and diagnosis, it should be `info`. Reserve `debug` for development-only detail.

7. **Treating log write failures as fatal.** If the logger itself fails to write (network issue with remote log sink, disk full), the application must continue operating. Log failures must not crash the application.

8. **Including stack traces in the message field.** Stack traces belong in the `stack` structured field — not in the human-readable `message`. Embedded stack traces in messages break structured parsing.

---

## 35. Anti-Patterns

These are structural patterns that must be rejected at code review.

### 35.1 The Log-and-Rethrow Pattern

```typescript
// ANTI-PATTERN
try {
  await operation();
} catch (error) {
  logger.error('Operation failed', { error }); // logs here
  throw error; // then propagates — will be logged again at the handler
}
```

Logging an error and then re-throwing it causes duplicate log entries. Either log it (and handle it) or re-throw it — not both. See Section 23.2.

### 35.2 The Conditional Logger

```typescript
// ANTI-PATTERN
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data);
}
```

Environment-conditional logging done inline bypasses the logger entirely. Use log levels — the logger handles environment-appropriate suppression automatically.

### 35.3 The Chatterbug Logger

A module that logs every function entry, every variable assignment, and every branch taken produces noise that drowns out real signal. Logs must be placed at decision points and significant state transitions — not mechanically at every line.

### 35.4 The Monolithic Context Object

```typescript
// ANTI-PATTERN
logger.info('Operation complete', { everything: { user, account, post, request, response, config } });
```

Dumping a large context object into every log entry bloats storage and often captures sensitive data accidentally. Log only the specific fields needed for diagnosis.

### 35.5 Log Level Inflation

Teams under pressure to "log more" sometimes elevate all log entries to `warn` or `error` to ensure they are not missed. This destroys the semantic meaning of log levels and causes alert fatigue. Log level discipline must be enforced in code review.

---

## 36. AI Logging Rules

This section defines how an AI system (such as a code generation assistant) must reason about logging decisions when developing within the Void project.

### 36.1 Before Adding a Log Entry

The AI must ask:
1. **Is this event worth logging?** Would an engineer find this entry useful during an incident, investigation, or routine review?
2. **What level does this event deserve?** Apply the decision guide from Section 3.7.
3. **What category does this event belong to?** Select from Section 4.
4. **What context is needed?** Identify the minimum set of fields that make this entry self-contained and useful.
5. **Does this context contain sensitive data?** Apply the sanitization rules from Section 26.

If the AI cannot answer all five questions clearly, it must not add the log entry without requesting clarification.

### 36.2 When to Log

Log when:
- A significant state transition occurs in the system
- A user-initiated action completes (success or failure)
- An external system interaction completes
- A recoverable failure is detected and handled
- A security-relevant event occurs
- A performance threshold is exceeded

### 36.3 When Not to Log

Do not log when:
- The event is routine and expected with no diagnostic value (e.g., "function entered", "loop iteration N")
- The event duplicates a log that will be written by the caller or callee
- The data needed for context contains sensitive values that cannot be sanitized without losing all value
- The log would be at `debug` or `trace` and the code is in a production-critical hot path

### 36.4 Level Selection by the AI

The AI must follow Section 3.7's decision guide without exception. It must not:
- Use `warn` to make a log entry "more visible" when `info` is correct
- Use `info` to soften an error that should be `error`
- Use `debug` for events that operators need to see in production

### 36.5 Sensitive Data Enforcement

The AI must proactively identify any variable or field being passed to the logger that could contain sensitive data. When in doubt, the AI must:
- Replace the value with `[REDACTED]` in the log call
- Or exclude the field entirely
- Never log the value and rely on a downstream filter to catch it

### 36.6 The AI Must Use the Shared Logger

The AI must never generate `console.log`, `console.error`, `console.warn`, or any `console.*` call in non-test code. All log calls must use the shared logger or `req.log` in request context.

### 36.7 The AI Must Include Category

Every log call generated by the AI must include a `category` field matching one of the defined categories in Section 4. Omitting the category field is not acceptable.

### 36.8 The AI Must Not Generate Log-and-Rethrow

If the AI generates a `try/catch` block, it must decide: either log the error and handle it, or add context and re-throw. Generating both a `logger.error()` call and a `throw` for the same error in the same catch block is the log-and-rethrow anti-pattern and must not appear in AI-generated code.

---

## 37. Review Checklist

Use this checklist during every code review that introduces or modifies logging.

### Logger Usage
- [ ] No `console.log`, `console.error`, `console.warn`, or `console.*` calls in non-test code
- [ ] The shared logger or `req.log` is used for all log calls
- [ ] Child loggers are used for subsystems with shared context fields
- [ ] No new logger instances are created per-file or per-function

### Log Level
- [ ] Each log entry uses the correct level per the decision guide in Section 3.7
- [ ] `error` is not used for expected, non-exceptional outcomes
- [ ] `warn` is not used as a substitute for `info` to increase visibility
- [ ] `debug` entries do not contain information required in production

### Log Content
- [ ] Every log entry includes `timestamp`, `level`, `category`, `message`
- [ ] Every log entry includes relevant context fields (requestId, userId, operation, entity IDs)
- [ ] Messages are specific, descriptive, and self-contained
- [ ] No message uses vague language ("something failed", "error occurred", "done")
- [ ] Context uses structured fields — not concatenated strings in the message

### Sensitive Data
- [ ] No passwords, tokens, API keys, or secrets appear in any log field
- [ ] No cookie values or session data appear in any log field
- [ ] No environment variable values appear in any log field
- [ ] No full request or response bodies are logged without sanitization
- [ ] Email addresses and IP addresses appear only in security and audit logs

### Error Logging
- [ ] Error log entries include the error object (`{ error }` field)
- [ ] Stack traces are in the `stack` field — not embedded in the message
- [ ] The same error is not logged at multiple layers (log-and-rethrow anti-pattern)

### Audit and Security
- [ ] All user-initiated mutations are captured in audit logs
- [ ] Audit log entries include all required fields from Section 25.2
- [ ] Security-relevant events use `category: 'security'`

### Performance
- [ ] Logging is not performed inside tight loops over large datasets
- [ ] Debug logging in hot paths is conditional on log level check
- [ ] No synchronous blocking log writes in production-critical paths

### AI-Generated Code
- [ ] AI-generated log calls include the `category` field
- [ ] AI-generated code uses the shared logger — not `console.*`
- [ ] AI-generated catch blocks do not log-and-rethrow

---

*This document is the official and sole logging reference for the Void project. All layers, subsystems, contributors, and AI systems operating on this codebase are bound by the policies defined here. Any conflict between this document and other documents is resolved in favor of this document for logging concerns. Changes to this policy require explicit review and approval.*
