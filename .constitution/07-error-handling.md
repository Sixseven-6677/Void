# 07 — Error Handling Policy

> **Status:** Official  
> **Scope:** All layers of Void — API, Domain, Infrastructure, Plugins, Commands, Schedulers, Cache, Facebook Integration  
> **Authority:** This document is the single source of truth for error handling across the entire Void project. No layer, module, or subsystem is exempt.

---

## Table of Contents

1. [Error Handling Philosophy](#1-error-handling-philosophy)
2. [Error Classification](#2-error-classification)
   - 2.1 [Recoverable Errors](#21-recoverable-errors)
   - 2.2 [Non-Recoverable Errors](#22-non-recoverable-errors)
   - 2.3 [Domain Errors](#23-domain-errors)
   - 2.4 [Infrastructure Errors](#24-infrastructure-errors)
   - 2.5 [Validation Errors](#25-validation-errors)
   - 2.6 [Authentication Errors](#26-authentication-errors)
   - 2.7 [Authorization Errors](#27-authorization-errors)
   - 2.8 [Network Errors](#28-network-errors)
   - 2.9 [Database Errors](#29-database-errors)
   - 2.10 [Facebook API Errors](#210-facebook-api-errors)
   - 2.11 [Cache Errors](#211-cache-errors)
   - 2.12 [Scheduler Errors](#212-scheduler-errors)
   - 2.13 [Plugin Errors](#213-plugin-errors)
   - 2.14 [Command Errors](#214-command-errors)
3. [Error Propagation Rules](#3-error-propagation-rules)
4. [Exception Handling Rules](#4-exception-handling-rules)
5. [Retry Strategy](#5-retry-strategy)
6. [Fallback Strategy](#6-fallback-strategy)
7. [User-Friendly Errors](#7-user-friendly-errors)
8. [Internal Error Messages](#8-internal-error-messages)
9. [Logging Integration](#9-logging-integration)
10. [Error Context](#10-error-context)
11. [Error Metadata](#11-error-metadata)
12. [Custom Error Classes](#12-custom-error-classes)
13. [Global Error Handler](#13-global-error-handler)
14. [Async Error Handling](#14-async-error-handling)
15. [Promise Rejection Policy](#15-promise-rejection-policy)
16. [Graceful Degradation](#16-graceful-degradation)
17. [Failure Recovery](#17-failure-recovery)
18. [Forbidden Error Handling Practices](#18-forbidden-error-handling-practices)
19. [Common Mistakes](#19-common-mistakes)
20. [Anti-Patterns](#20-anti-patterns)
21. [AI Error Handling Rules](#21-ai-error-handling-rules)
22. [Review Checklist](#22-review-checklist)

---

## 1. Error Handling Philosophy

Error handling is not an afterthought — it is a first-class architectural concern in Void. Every error that occurs inside the system must be:

- **Discoverable:** The system must detect that something went wrong.
- **Classified:** Every error belongs to a known category with defined behavior.
- **Contextualized:** An error must carry enough information to understand where it happened, why it happened, and what state the system was in.
- **Actionable:** Errors must guide the developer or operator toward resolution.
- **Separated:** User-facing messages must never leak internal details. Developer-facing messages must never be vague.

The guiding principle is: **no error should be silent, generic, or opaque.** A system that swallows errors is a system that lies about its own health.

### Core Axioms

1. **Errors are information.** Every error is a signal about system behavior. Suppressing it destroys that signal forever.
2. **Fail loudly in development, gracefully in production.** Development environments must surface every error with full detail. Production environments must handle errors without crashing the system — but must still log full internal detail.
3. **Errors must travel upward with context.** As an error propagates through layers, it must accumulate context, not lose it.
4. **Handling an error means doing something about it.** Catching an error and doing nothing is not handling — it is concealment.
5. **User safety and developer clarity are both non-negotiable.** The user sees a safe, comprehensible message. The developer sees the full technical truth.
6. **Retrying a non-retryable error is a bug.** Retry logic must be deliberate and bounded.

---

## 2. Error Classification

All errors in Void are classified before they are handled. Classification determines:
- Whether to retry
- Whether to fallback
- Whether to alert an operator
- What to show the user
- How to log the error

### 2.1 Recoverable Errors

**Definition:** Errors from which the system can recover automatically or with user intervention, without data loss or system instability.

**Characteristics:**
- Transient in nature (network timeout, temporary unavailability)
- Do not indicate a bug in the codebase
- The operation that failed may be safely retried under the right conditions
- Recovery does not require system restart

**Examples:**
- A network request times out after 5 seconds
- A cache miss requiring a fallback to the database
- A third-party API returns a 503 temporarily
- A database connection from the pool is momentarily unavailable

**Handling Rule:** Recoverable errors must define an explicit recovery path. Either: retry with backoff, fallback to an alternative source, degrade gracefully, or return a structured error response to the caller. They must never be silently swallowed.

---

### 2.2 Non-Recoverable Errors

**Definition:** Errors that indicate a fundamental failure — a bug, a missing configuration, a corrupted state, or a violated invariant. The system cannot safely continue the affected operation.

**Characteristics:**
- Retrying will produce the same failure
- Continuing may produce incorrect behavior or data corruption
- Operator or developer intervention is required

**Examples:**
- A required environment variable is missing at startup
- A database schema migration has failed
- A critical service dependency is completely unavailable
- An internal invariant has been violated (e.g., an entity that must exist is absent)
- Memory exhaustion or process-level crash

**Handling Rule:** Non-recoverable errors must be logged at the `fatal` or `error` level with full stack trace and context. The affected operation must be aborted. Depending on severity, the process may need to exit. They must never be suppressed or retried blindly.

---

### 2.3 Domain Errors

**Definition:** Errors that arise from violations of business rules, invalid domain state, or operations that are not permitted given the current domain context.

**Characteristics:**
- Represent expected failure scenarios in business logic
- Are not bugs — they are legitimate outcomes of user or system actions
- Must be modeled explicitly, not thrown as generic exceptions
- Carry semantic meaning for the calling layer

**Examples:**
- Attempting to publish a post that has already been published
- Creating a campaign whose budget exceeds the account limit
- Scheduling a post with a date in the past
- Modifying a locked resource

**Structure:**
```
code:    A machine-readable identifier (e.g., POST_ALREADY_PUBLISHED)
message: A developer-readable explanation
context: Relevant domain state that caused the error
userMessage: (optional) A safe, user-readable version
```

**Handling Rule:** Domain errors must be caught at the application/use-case layer. They must be translated into appropriate HTTP responses (typically 400, 409, or 422). They must never propagate to the global error handler as unhandled exceptions.

---

### 2.4 Infrastructure Errors

**Definition:** Errors caused by failures in the underlying infrastructure — databases, caches, message queues, file systems, external services, and network layers.

**Characteristics:**
- Often transient and retryable
- External to the domain — they represent environmental failures, not logic failures
- May require circuit breaking or fallback strategies

**Examples:**
- PostgreSQL connection refused
- Redis timeout on a write operation
- S3 bucket unreachable
- DNS resolution failure for a third-party API

**Handling Rule:** Infrastructure errors must be caught at the infrastructure layer and wrapped in a typed infrastructure error before propagating upward. The original error must be preserved as `cause`. Retry and fallback policies defined in Section 5 and 6 apply.

---

### 2.5 Validation Errors

**Definition:** Errors that arise when input data does not conform to the expected schema, type, format, or business constraint.

**Characteristics:**
- Always caused by invalid input — from the user, a client, or an external system
- Fully deterministic: the same invalid input will always produce the same validation error
- Must never be retried
- Must produce a structured list of field-level violations

**Examples:**
- A required field is missing from a request body
- An email field contains an invalid format
- A numeric field contains a string value
- A date range where `end` is before `start`

**Structure:**
```
field:   The name of the field that failed validation
rule:    The validation rule that was violated (e.g., required, minLength, pattern)
value:   The actual value received (must be sanitized — never log sensitive values)
message: A human-readable description of the violation
```

**Handling Rule:** Validation errors must be caught as early as possible — at the boundary of the system (HTTP layer or command input parsing). All violations in a single request must be collected and returned together — never one at a time. HTTP status code: `400 Bad Request` or `422 Unprocessable Entity`.

---

### 2.6 Authentication Errors

**Definition:** Errors that occur when a request cannot be attributed to a verified identity — the caller is unknown or their credentials are invalid.

**Characteristics:**
- Indicate that the system cannot determine who is making the request
- Must not reveal whether an account exists (prevents enumeration attacks)
- Must not include internal session or token details in the response

**Examples:**
- Missing or malformed Authorization header
- Expired JWT or session token
- Invalid API key
- Facebook access token has been revoked

**Handling Rule:** Authentication errors must return HTTP `401 Unauthorized`. The user-facing message must be generic: "Authentication required." or "Your session has expired. Please log in again." No internal token details, user IDs, or session data must appear in the response. Full details are logged internally.

---

### 2.7 Authorization Errors

**Definition:** Errors that occur when a verified identity attempts an action they are not permitted to perform.

**Characteristics:**
- The caller is known — but their permissions are insufficient
- Must not leak information about the existence of resources the caller cannot access
- Distinct from authentication errors — the identity is established, but access is denied

**Examples:**
- A user attempting to modify another user's account
- A plugin attempting to access a restricted API
- A command being executed without the required role
- Attempting to delete a resource owned by a different organization

**Handling Rule:** Authorization errors must return HTTP `403 Forbidden`. If the resource's existence itself is sensitive, return `404 Not Found` instead to prevent information leakage. User-facing message: "You do not have permission to perform this action." Full permission context is logged internally.

---

### 2.8 Network Errors

**Definition:** Errors caused by failures in network communication — connection refusals, timeouts, DNS failures, TLS errors, and unreachable endpoints.

**Characteristics:**
- Often transient — a retry after a delay may succeed
- May indicate infrastructure degradation
- Must be distinguished from application-level errors (e.g., a 404 from a reachable server is not a network error)

**Examples:**
- `ECONNREFUSED` — the target server is not accepting connections
- `ETIMEDOUT` — the connection or request timed out
- `ENOTFOUND` — DNS resolution failed
- TLS certificate validation failed

**Handling Rule:** Network errors must be caught at the infrastructure/HTTP client layer. Apply the retry strategy defined in Section 5. Log the target host, request method, timeout duration, and attempt count. Never expose raw network error messages to end users.

---

### 2.9 Database Errors

**Definition:** Errors arising from interactions with PostgreSQL — connection failures, query errors, constraint violations, deadlocks, and migration failures.

**Characteristics:**
- Constraint violations may represent domain-level conflicts (e.g., duplicate unique key) — these must be translated to domain errors
- Connection pool exhaustion is a recoverable infrastructure error
- Deadlocks may be retried with backoff
- Migration failures are non-recoverable — they require operator intervention

**Examples:**
- Unique constraint violation on a user email column
- Connection pool timeout
- Deadlock detected on concurrent writes
- Query syntax error (indicates a bug — must not be retried)
- Foreign key constraint violation

**Handling Rule:** All database operations must be wrapped in try/catch at the repository layer. Constraint violations must be mapped to specific domain errors. Query errors that indicate a bug (syntax errors, missing columns) are non-recoverable and must be escalated immediately. Never expose raw SQL or database error messages to users.

---

### 2.10 Facebook API Errors

**Definition:** Errors returned by the Facebook Graph API or any Facebook platform integration within Void.

**Characteristics:**
- Facebook errors follow a structured format with `error.code`, `error.type`, `error.message`, and `error.error_subcode`
- Some errors are transient (rate limits, temporary unavailability)
- Some errors require user action (expired token, revoked permissions)
- Some errors indicate a permanent failure (invalid account, policy violation)

**Facebook Error Categories:**

| Category | Facebook Codes | Behavior |
|---|---|---|
| Token expired / invalid | 190, 102 | Prompt user to re-authenticate |
| Rate limited | 4, 17, 32, 613 | Retry with exponential backoff |
| Permission denied | 10, 200–299 | Surface permission error to user |
| Temporary unavailability | 1, 2 | Retry with backoff |
| Invalid request | 100 | Non-retryable — indicates a bug |
| Policy violation | 368 | Non-retryable — requires operator review |

**Handling Rule:** All Facebook API calls must check the response for error structures — a `200 OK` response may still contain a Facebook error object. Map every Facebook error code to a typed `FacebookApiError`. Log the full Facebook error payload internally. Never expose `error.message` from Facebook directly to users — translate to a safe user message.

---

### 2.11 Cache Errors

**Definition:** Errors arising from interactions with the caching layer (Redis or equivalent).

**Characteristics:**
- Cache errors are almost always recoverable — the system can fall back to the source of truth
- A cache error must never prevent the system from serving a request if the underlying data source is available
- Cache write failures are non-critical — log and continue
- Cache read failures must trigger a fallback to the database or primary data source

**Examples:**
- Redis connection timeout on read
- Redis memory exhausted — write rejected
- Deserialization error on a cached value (indicates stale or corrupted cache format)

**Handling Rule:** Cache errors must be caught at the cache adapter layer. Read failures must trigger the fallback strategy (Section 6). Write failures must be logged at `warn` level but must not cause the originating operation to fail. Never propagate a cache error to the domain layer as an unhandled exception.

---

### 2.12 Scheduler Errors

**Definition:** Errors that occur during the execution of scheduled jobs, recurring tasks, or time-based triggers.

**Characteristics:**
- Scheduler errors must not crash the scheduler process
- A single job failure must not prevent other jobs from running
- Failed jobs must be logged with full context including job name, scheduled time, and execution duration
- Depending on the job's criticality, a failed job may need to alert an operator

**Examples:**
- A scheduled post fails to publish due to a Facebook API error
- A cleanup job fails due to a database timeout
- A job takes longer than its allowed execution window (timeout)
- A job throws an unhandled exception

**Handling Rule:** Every scheduled job must be wrapped in a top-level try/catch. Errors must be logged with job metadata. The scheduler must mark the job as failed in the persistence layer. Retry eligibility is determined by the job's declared retry policy. Jobs must have a maximum retry count — infinite retry is forbidden.

---

### 2.13 Plugin Errors

**Definition:** Errors originating from plugins — user-installed or system-registered extensions that extend Void's functionality.

**Characteristics:**
- Plugin code runs in a sandboxed or supervised context
- Plugin errors must never crash the host system
- A plugin error affects only the feature surface provided by that plugin
- Plugin errors must be attributed clearly to the plugin in logs

**Examples:**
- A plugin throws an unhandled exception during initialization
- A plugin returns malformed data from a hook
- A plugin attempts to access a forbidden API
- A plugin's dependency fails to load

**Handling Rule:** The plugin runtime must wrap all plugin lifecycle calls (init, execute, teardown) in try/catch. Plugin errors must be caught, logged with full plugin identity (name, version, author), and the plugin must be marked as failed or disabled. The host system continues operating. Plugin errors must never propagate to the global error handler as unhandled exceptions.

---

### 2.14 Command Errors

**Definition:** Errors that occur during the execution of commands in the command system.

**Characteristics:**
- Commands are discrete, intentional operations — their failure must be explicitly handled
- Command errors may be domain errors (invalid state), validation errors (bad input), or infrastructure errors (service unavailable)
- Failed commands must produce a structured result — not throw unhandled exceptions to the caller

**Examples:**
- A command receives invalid arguments
- A command attempts an operation not permitted by the current domain state
- A command depends on an external service that is unavailable

**Handling Rule:** Every command handler must return a result object indicating success or failure — not throw exceptions for expected failures. Only unexpected, non-domain errors should surface as exceptions, caught by the command bus's global error handler. All command failures must be logged with the command name, input parameters (sanitized), and error details.

---

## 3. Error Propagation Rules

These rules govern how errors travel through Void's layer architecture.

### 3.1 Errors Must Accumulate Context, Not Lose It

When an error is caught and re-thrown (or wrapped), it must carry the original error as its `cause`. Context must be added — never stripped.

```
// Correct: wrapping with cause and context
throw new DatabaseError('Failed to fetch user by ID', {
  cause: originalError,
  context: { userId, operation: 'findById' }
});

// Forbidden: rethrowing without adding value
throw originalError; // loses layer context
throw new Error('Something went wrong'); // loses all information
```

### 3.2 Layers Must Not Expose Internal Errors Upward Naked

Infrastructure errors (database, cache, network) must be caught at the infrastructure layer and converted to typed errors before traveling to the domain or application layer. The domain layer must never see a raw `pg` error or a raw `ioredis` error.

### 3.3 The Domain Layer Must Not Know About Infrastructure

Domain errors must not contain infrastructure details. If a database failure causes a domain operation to fail, the domain layer receives a typed `InfrastructureError` — not a PostgreSQL error object.

### 3.4 The HTTP Layer Is the Terminal Error Boundary

All errors that reach the HTTP layer must be caught by the global error handler (Section 13). No error must ever reach Express's default error handler unless the global handler itself has failed.

### 3.5 Errors Must Not Cross Asynchronous Boundaries Silently

An error thrown inside a `Promise`, `async` function, or event handler that is not awaited by a supervised caller must be caught explicitly. Unsupervised async operations that can throw are forbidden.

---

## 4. Exception Handling Rules

### 4.1 Catch Must Always Do Something Meaningful

A `catch` block must perform at least one of:
- Log the error
- Wrap and re-throw with added context
- Return a structured error result
- Execute a fallback

A `catch` block that does none of these is forbidden.

### 4.2 Never Catch What You Cannot Handle

If a layer cannot meaningfully handle an error, it must re-throw it (with added context) rather than pretend the error did not occur.

### 4.3 Catch the Narrowest Possible Scope

`try/catch` blocks must wrap the minimum amount of code necessary — not entire functions or modules. Wide catch scopes hide the true origin of errors.

### 4.4 Preserve the Stack Trace

When wrapping an error, always pass the original as `cause`. Modern JavaScript `Error` objects support `{ cause }` natively. Never create a new error that loses the original stack trace.

### 4.5 Never Use Errors for Control Flow

Errors must not be thrown as a substitute for conditional logic. If an outcome is an expected, non-exceptional result (e.g., a user not found), return `null` or a `Result` type — not a thrown exception.

### 4.6 Never Re-throw Without Adding Value

Re-throwing an error unchanged is only acceptable when the current layer genuinely has no context to add. In all other cases, wrap it with relevant context before re-throwing.

---

## 5. Retry Strategy

Retrying is a deliberate, bounded operation — not a default behavior.

### 5.1 Retry Eligibility

An operation may be retried only if:
- The error is classified as transient (network timeout, rate limit, temporary service unavailability)
- The operation is idempotent — repeating it does not produce duplicate side effects
- The retry attempt count has not exceeded the configured maximum

**Operations that must never be retried:**
- Validation errors
- Authentication or authorization errors
- Domain errors (business rule violations)
- Non-idempotent operations without explicit idempotency guarantees
- Errors that indicate a bug (query syntax errors, missing configuration)

### 5.2 Retry Configuration

Every retry policy must declare:

| Parameter | Description | Default |
|---|---|---|
| `maxAttempts` | Maximum number of total attempts (including the first) | 3 |
| `initialDelay` | Delay before the first retry (ms) | 500 |
| `backoffFactor` | Multiplier applied to delay on each attempt | 2 |
| `maxDelay` | Maximum delay between retries (ms) | 10,000 |
| `jitter` | Whether to add randomness to avoid thundering herd | true |

### 5.3 Exponential Backoff with Jitter

The delay for attempt `n` is calculated as:

```
delay = min(initialDelay * backoffFactor^(n-1), maxDelay) + random(0, jitter_range)
```

Jitter prevents multiple clients from retrying in lockstep after a shared failure.

### 5.4 Retry Logging

Every retry attempt must be logged at `warn` level with:
- Operation name
- Attempt number and maximum attempts
- Delay before next attempt
- Error that caused the retry

When all retries are exhausted, the final error must be logged at `error` level with full context.

### 5.5 Circuit Breaker Integration

For high-frequency operations against external services (Facebook API, cache, database), a circuit breaker must be applied on top of retry logic. When the circuit is open, retries are skipped and the fallback is applied immediately.

---

## 6. Fallback Strategy

A fallback is an alternative behavior that maintains system functionality when the primary path fails.

### 6.1 When to Apply a Fallback

Apply a fallback when:
- A recoverable infrastructure error occurs and retries are exhausted
- A non-critical feature is unavailable (cache miss, analytics service down)
- Degraded but correct behavior is preferable to an error response

### 6.2 When Not to Apply a Fallback

Do not apply a fallback when:
- The fallback would produce incorrect or stale data that could cause harm
- The operation is part of a critical write path (data integrity must not be compromised)
- The domain requires the primary data source — there is no safe alternative

### 6.3 Fallback Hierarchy

For each critical operation, define an explicit fallback hierarchy:

```
Primary:   Redis cache
Fallback1: PostgreSQL database
Fallback2: Return empty/default response with degraded indicator
Fallback3: Fail the request with a clear error
```

### 6.4 Fallback Transparency

When a fallback is used, it must be:
- Logged at `warn` level with the reason the primary path failed
- Tracked in metrics (fallback invocation rate is a health signal)
- Optionally indicated in the response if the caller needs to know (e.g., `X-Served-From: fallback`)

### 6.5 Fallback Must Not Mask Errors

Using a fallback does not mean the original error is suppressed. The original error must still be logged with full context. The fallback is a recovery mechanism, not an error suppressor.

---

## 7. User-Friendly Errors

Every error that reaches an end user must be:

### 7.1 Safe

- Contains no internal technical details
- Contains no stack traces
- Contains no database query fragments
- Contains no file paths or server identifiers
- Contains no other users' data

### 7.2 Comprehensible

- Written in plain language the user can understand
- Explains what went wrong from the user's perspective
- Does not use error codes or technical jargon as the primary message

### 7.3 Actionable

- Tells the user what they can do next
- Provides a recovery path when one exists ("Please try again", "Contact support", "Re-authenticate")

### 7.4 Honest

- Does not pretend success when there was a failure
- Does not hide permanent failures behind "try again" messages when retry will not help

### 7.5 Standard User Error Messages

| Scenario | User Message |
|---|---|
| Server error | "Something went wrong on our end. Please try again in a moment." |
| Authentication required | "Your session has expired. Please log in again." |
| Permission denied | "You don't have permission to do that." |
| Validation failure | "[Field-specific message describing what is wrong]" |
| Resource not found | "The requested item could not be found." |
| Rate limited | "You're doing that too quickly. Please wait a moment." |
| Service unavailable | "This feature is temporarily unavailable. Please try again later." |

---

## 8. Internal Error Messages

Internal error messages are written for developers and operators. They must be:

### 8.1 Precise

- Name the exact operation that failed
- Name the component or module where the failure occurred
- Include relevant identifiers (entity IDs, operation names, query parameters — sanitized)

### 8.2 Complete

- Include the full error chain (original cause + all wrapping errors)
- Include the stack trace
- Include request/job context (request ID, user ID, job name)

### 8.3 Honest

- Never soften language to hide the severity
- Never use vague phrases like "something went wrong" in internal messages

### 8.4 Sanitized

- Must not include passwords, tokens, API keys, or sensitive PII
- Identifiers (user IDs, account IDs) are acceptable in internal logs
- Raw request payloads must be sanitized before logging

---

## 9. Logging Integration

All error handling integrates with the logging system defined in `08-logging-policy.md`.

### 9.1 Log Levels for Errors

| Error Type | Log Level |
|---|---|
| Non-recoverable / process-threatening | `fatal` |
| Unexpected error / unhandled exception | `error` |
| Recoverable error / retry exhausted | `error` |
| Retry attempt in progress | `warn` |
| Fallback applied | `warn` |
| Expected domain error surfaced to user | `info` |
| Validation error | `info` |
| Authentication / authorization failure | `info` |

### 9.2 Required Log Fields for Every Error

Every logged error must include:

```
timestamp:    ISO 8601 UTC
level:        fatal | error | warn | info
errorCode:    Machine-readable error code
errorType:    Class name of the error
message:      Internal developer message
cause:        Original error message and type (if wrapped)
stack:        Full stack trace
requestId:    Trace ID for the originating request (if applicable)
userId:       Authenticated user ID (if applicable and not sensitive context)
operation:    The operation being performed when the error occurred
context:      Additional structured key-value metadata
```

### 9.3 Never Log Sensitive Values

The following must never appear in logs:
- Passwords (hashed or plaintext)
- API tokens or secret keys
- Facebook access tokens
- Session tokens or JWTs
- Credit card numbers or financial data
- Personal identification numbers

---

## 10. Error Context

Context is the structured information attached to an error that enables diagnosis without reproducing the failure.

### 10.1 What Belongs in Context

- The operation being performed: `{ operation: 'publishPost' }`
- The entity involved: `{ postId: '...', accountId: '...' }`
- The state at the time of failure: `{ postStatus: 'draft', scheduledAt: '...' }`
- The layer where the error originated: `{ layer: 'infrastructure', module: 'FacebookApiAdapter' }`
- Timing information: `{ attemptDuration: 1240, attemptNumber: 2 }`

### 10.2 What Does Not Belong in Context

- Passwords, tokens, or secrets
- Full request bodies without sanitization
- Binary data or large payloads
- Redundant information already in the error message

### 10.3 Context Must Be Propagated

When an error is caught and re-thrown, the new error must include:
- Its own context (what this layer was doing)
- The original error as `cause` (which carries its own context)

This creates an error chain that can be fully traced from the point of failure up to the surface.

---

## 11. Error Metadata

Error metadata is a structured set of fields attached to every error class instance. It enables programmatic handling, routing, and monitoring.

### 11.1 Standard Metadata Fields

| Field | Type | Description |
|---|---|---|
| `code` | `string` | Machine-readable error code (e.g., `POST_ALREADY_PUBLISHED`) |
| `httpStatus` | `number` | The HTTP status code to return (e.g., 400, 403, 500) |
| `retryable` | `boolean` | Whether this error class is eligible for retry |
| `category` | `ErrorCategory` | Classification: `domain`, `infrastructure`, `validation`, etc. |
| `severity` | `ErrorSeverity` | `fatal`, `error`, `warn`, `info` |
| `userMessage` | `string \| null` | Safe user-facing message (null if not user-facing) |
| `context` | `Record<string, unknown>` | Structured diagnostic context |
| `cause` | `Error \| null` | The original error that caused this one |
| `timestamp` | `Date` | When the error was instantiated |

---

## 12. Custom Error Classes

All errors in Void must be instances of typed custom error classes — never raw `Error` objects.

### 12.1 Base Error Class

Every custom error extends `VoidError`, which extends the native `Error`:

```typescript
// Illustrative structure — not implementation code
class VoidError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly userMessage: string | null;
  readonly context: Record<string, unknown>;
  readonly timestamp: Date;
  // cause is inherited from native Error (ES2022)
}
```

### 12.2 Error Hierarchy

```
VoidError
├── DomainError
│   ├── BusinessRuleViolationError
│   ├── EntityNotFoundError
│   ├── EntityConflictError
│   └── InvalidOperationError
├── ValidationError
│   └── InputValidationError (carries field-level violations)
├── AuthenticationError
├── AuthorizationError
├── InfrastructureError
│   ├── DatabaseError
│   │   ├── ConnectionError
│   │   ├── QueryError
│   │   └── ConstraintViolationError
│   ├── CacheError
│   │   ├── CacheReadError
│   │   └── CacheWriteError
│   ├── NetworkError
│   │   ├── TimeoutError
│   │   └── ConnectionRefusedError
│   └── FacebookApiError
│       ├── FacebookTokenError
│       ├── FacebookRateLimitError
│       ├── FacebookPermissionError
│       └── FacebookUnavailableError
├── SchedulerError
├── PluginError
└── CommandError
```

### 12.3 Error Code Convention

Error codes must be:
- `SCREAMING_SNAKE_CASE`
- Prefixed with the domain or subsystem: `POST_`, `ACCOUNT_`, `FB_`, `DB_`, `CACHE_`, `AUTH_`
- Descriptive of the specific failure: `POST_ALREADY_PUBLISHED`, `FB_TOKEN_EXPIRED`, `DB_CONNECTION_REFUSED`

### 12.4 When to Create a New Error Class vs. Use an Existing One

- Create a new class when the error has distinct handling requirements (different retry policy, different HTTP status, different user message pattern)
- Use an existing class when the error fits an established category and its metadata is parameterized through `code` and `context`
- Never create a new class just to name a one-off failure — parameterize it instead

---

## 13. Global Error Handler

The global error handler is the last line of defense at the HTTP boundary.

### 13.1 Responsibilities

- Catch all errors that were not handled at a lower layer
- Map typed `VoidError` instances to structured HTTP responses
- Map unknown errors (programming mistakes, unexpected failures) to `500` responses
- Ensure the error is logged with full context
- Ensure the user-facing response contains no sensitive information

### 13.2 Response Structure

All error responses from the API must follow this structure:

```json
{
  "error": {
    "code": "POST_ALREADY_PUBLISHED",
    "message": "This post has already been published and cannot be modified.",
    "details": [
      { "field": "status", "message": "Cannot transition from 'published' to 'draft'" }
    ]
  },
  "requestId": "req_abc123"
}
```

- `code`: The machine-readable error code (always present)
- `message`: The user-safe message (always present)
- `details`: Field-level details (present for validation errors only)
- `requestId`: The trace ID for this request (always present)

### 13.3 What the Global Handler Must Never Do

- Expose stack traces in responses
- Expose `cause` chains in responses
- Return raw database or infrastructure errors
- Return different error structures for different error types (structure must be consistent)

### 13.4 Unrecognized Errors

Any error that is not an instance of `VoidError` must be:
- Logged at `error` level with full stack trace
- Returned to the user as a generic `500` response
- Treated as a bug requiring investigation

---

## 14. Async Error Handling

### 14.1 All Async Functions Must Handle Their Errors

Every `async` function that performs a fallible operation must either:
- Handle the error internally and return a result
- Re-throw the error (with context) so the caller can handle it
- Be awaited by a caller that handles the error

An `async` function that throws without any caller catching it is an unhandled rejection.

### 14.2 Top-Level Async Calls Must Be Supervised

Any top-level async call (event handlers, fire-and-forget operations, background tasks) must be wrapped in a supervisor that catches and logs unhandled errors:

```typescript
// Correct: supervised top-level async
runBackgroundTask().catch((error) => {
  logger.error('Background task failed unexpectedly', { error });
});

// Forbidden: unsupervised top-level async
runBackgroundTask(); // errors are silently lost
```

### 14.3 Event Emitters and Callbacks

Event handlers that perform async operations must catch their own errors. Uncaught errors inside event handlers do not propagate to the emitter's caller — they become unhandled rejections.

---

## 15. Promise Rejection Policy

### 15.1 No Unhandled Promise Rejections

Unhandled promise rejections are forbidden. The process must be configured to treat unhandled rejections as fatal errors:

```
process.on('unhandledRejection', (reason) => {
  logger.fatal('Unhandled promise rejection', { reason });
  process.exit(1);
});
```

### 15.2 Promise Chains Must Handle Rejection

Every `.then()` chain must include a `.catch()`. Every `await` expression inside an `async` function must be inside a `try/catch` or the function's own error must propagate to a supervised caller.

### 15.3 `Promise.all` and `Promise.allSettled`

- Use `Promise.allSettled` when partial failure is acceptable — inspect each result individually.
- Use `Promise.all` when all operations must succeed — any single failure rejects the entire promise. Ensure the rejection is caught.
- Never use `Promise.all` without a catch when a single failure should not block the others.

---

## 16. Graceful Degradation

Graceful degradation means the system continues to serve users at a reduced capability level rather than failing completely.

### 16.1 Define Degradation Tiers

For each major feature, define its degradation tiers:

| Tier | Condition | Behavior |
|---|---|---|
| Full | All systems operational | Full feature set available |
| Degraded | Cache unavailable | Serve from database, higher latency |
| Minimal | Database read-only | Serve cached data, disable writes |
| Offline | Core service unavailable | Return maintenance message |

### 16.2 Degradation Must Be Explicit

The system must know it is degraded. Degradation must be:
- Logged when entered and exited
- Tracked in health check endpoints
- Communicated to users when appropriate ("Some features are temporarily unavailable")

### 16.3 Degradation Must Not Produce Incorrect Data

A degraded response that serves stale, partial, or incorrect data must clearly indicate this. Serving wrong data silently is worse than serving an error.

---

## 17. Failure Recovery

### 17.1 Self-Healing Behaviors

The system must implement automatic recovery for known transient failures:
- Reconnect to the database when a connection is lost
- Reconnect to Redis when the connection drops
- Re-authenticate with Facebook when a token expires (if a refresh token is available)

### 17.2 Recovery Must Be Bounded

Self-healing attempts must have a maximum count and a backoff delay. Infinite reconnection loops are forbidden. After exceeding the recovery limit, the system must alert and enter a degraded or offline state.

### 17.3 State Integrity After Recovery

After recovering from a failure, the system must verify that its in-memory state is consistent with the persistent state. Any state built on top of a failed component may be stale and must be invalidated or re-fetched.

---

## 18. Forbidden Error Handling Practices

The following practices are strictly prohibited in Void. Code review must reject any instance of these patterns.

### 18.1 Silent Catch

```typescript
// FORBIDDEN
try {
  await doSomething();
} catch {
  // silence
}
```

Silently catching an error destroys the signal entirely. The error is invisible in logs, invisible in monitoring, and invisible to the caller. This is the most dangerous anti-pattern in the codebase.

### 18.2 Empty Catch Blocks

```typescript
// FORBIDDEN
try {
  await doSomething();
} catch (error) {
  // TODO: handle this later
}
```

Even with a comment, an empty catch block is a silent failure. "Later" never comes. If the error cannot be handled now, it must be logged and re-thrown.

### 18.3 Throwing Generic Error Without Reason

```typescript
// FORBIDDEN
throw new Error('Error occurred');
throw new Error('Something went wrong');
throw new Error('Failed');
```

Generic error messages provide zero diagnostic value. Every thrown error must use a typed class and carry a specific, descriptive message.

### 18.4 Ignoring Promise Rejections

```typescript
// FORBIDDEN
someAsyncOperation(); // no await, no .catch()
Promise.all([a(), b()]); // no .catch()
```

An async operation that can fail must always be supervised. Unsupervised operations become invisible unhandled rejections.

### 18.5 Exposing Sensitive Data in Error Messages

```typescript
// FORBIDDEN
throw new Error(`Authentication failed for user ${user.email} with password ${password}`);
throw new DatabaseError(`Query failed: ${rawSqlQuery}`); // may expose schema
throw new FacebookApiError(facebookError.message); // may expose internal token details
```

Error messages that reach logs or API responses must never contain passwords, tokens, secrets, or PII.

### 18.6 Using Errors as Control Flow

```typescript
// FORBIDDEN
try {
  const user = await getUser(id); // throws if not found
  return user;
} catch (error) {
  return null; // using error as a "not found" signal
}
```

If "not found" is an expected, non-exceptional outcome, the function must return `null` or a `Result` type — not throw and catch an exception. Exceptions are for unexpected failures, not branching logic.

### 18.7 Re-throwing Without Context

```typescript
// FORBIDDEN
try {
  await database.query(sql);
} catch (error) {
  throw error; // no added value, no context
}
```

If you catch and re-throw, you must add context. Otherwise, do not catch — let it propagate naturally.

### 18.8 Catching `Error` Superclass Indiscriminately

```typescript
// FORBIDDEN (in most cases)
try {
  // large block of code
} catch (error) {
  if (error instanceof DatabaseError) { ... }
  // all other errors are silently swallowed
}
```

Catching broadly and only handling a subset silently swallows everything else. Either handle all cases explicitly or re-throw unrecognized errors.

### 18.9 String-Based Error Checking

```typescript
// FORBIDDEN
if (error.message.includes('duplicate key')) {
  // handle duplicate
}
```

Checking error messages as strings is fragile — messages change between library versions. Always use typed error classes or error codes for programmatic error handling.

---

## 19. Common Mistakes

These are mistakes that appear frequently in codebases of this type. Void engineers must actively guard against them.

1. **Forgetting to await an async operation** inside a try/catch — the catch block never fires for the async error.
2. **Logging at `warn` when `error` is appropriate** — under-reporting severity masks real problems in monitoring.
3. **Creating a new error without passing `cause`** — the original stack trace is destroyed, making debugging significantly harder.
4. **Returning `null` to signal an error** — `null` is ambiguous. Use a typed `Result` or throw a typed error with clear semantics.
5. **Catching errors at the wrong layer** — handling infrastructure errors in the domain layer couples the domain to infrastructure concerns.
6. **Retrying non-idempotent operations** — duplicates can be created, payments charged twice, messages sent multiple times.
7. **Using `console.error` instead of the logger** — bypasses structured logging, loses request context and metadata.
8. **Swallowing errors in cleanup code** — errors in `finally` blocks or cleanup handlers are often ignored and can hide the original failure.

---

## 20. Anti-Patterns

These are structural patterns that must be rejected at code review regardless of whether they "work" in the current context.

### 20.1 The Catch-All Handler at Every Layer

Placing a broad `try/catch` around every function — even functions that do not perform fallible operations — creates noise and makes it harder to identify where real errors originate.

### 20.2 Error Codes as Magic Numbers

```typescript
// ANTI-PATTERN
if (error.code === 23505) { // What is 23505?
  // handle duplicate
}
```

Database error codes, HTTP status codes, and Facebook API codes must be mapped to named constants or typed error classes before being used in conditional logic.

### 20.3 The Boolean Error Flag

```typescript
// ANTI-PATTERN
async function publishPost(id: string): Promise<boolean> {
  try {
    await facebook.publish(id);
    return true;
  } catch {
    return false; // why did it fail? unknown
  }
}
```

Boolean success/failure signals discard all information about what went wrong. Use typed result objects or throw typed errors.

### 20.4 The God Error Class

A single `AppError` class used for every error in the system, differentiated only by a string `type` field, is not a type system — it is untyped. It cannot be handled programmatically without string matching.

### 20.5 Error Swallowing in Middleware

Middleware that catches errors and transforms them without re-throwing or passing to `next(error)` in Express effectively terminates the error handling chain silently.

---

## 21. AI Error Handling Rules

This section defines how an AI system (such as a code generation assistant) must reason about error handling when developing within the Void project.

### 21.1 Understand Before Acting

Before writing error handling code, the AI must:
1. Identify the layer in which the code lives (domain, infrastructure, HTTP, scheduler, plugin, command)
2. Identify the category of the operation (database query, API call, validation, business rule)
3. Consult this document to determine the correct error class, log level, and recovery strategy for that combination

### 21.2 When to Create a New Error Class

Create a new error class when:
- The error has distinct handling requirements not satisfied by any existing class (different HTTP status, different retry policy, different user message)
- The error represents a new category of failure not covered by the existing hierarchy
- Multiple callers need to handle this error type programmatically

Do not create a new class when:
- An existing class can represent the error with a different `code` and `context`
- The error is a one-off failure with no callers that inspect its type

### 21.3 When to Reuse an Existing Error Class

Reuse an existing class when:
- The failure category matches an existing class
- The handling requirements (retry, fallback, HTTP status) are identical
- Only the specific `code` and `context` differ

### 21.4 How to Choose the Right Error Type

Follow this decision tree:

```
Is the input invalid or malformed?
  → ValidationError (InputValidationError for field-level)

Is the caller's identity unknown or unverified?
  → AuthenticationError

Does the caller lack permission for this operation?
  → AuthorizationError

Does the operation violate a business rule?
  → DomainError (BusinessRuleViolationError, EntityConflictError, etc.)

Did the database operation fail?
  → DatabaseError (ConnectionError, QueryError, ConstraintViolationError)

Did a cache operation fail?
  → CacheError (CacheReadError, CacheWriteError)

Did the Facebook API return an error?
  → FacebookApiError (inspect code → map to subtype)

Did a network call fail with a transient error?
  → NetworkError (TimeoutError, ConnectionRefusedError)

Is this a scheduler job failure?
  → SchedulerError

Is this a plugin lifecycle failure?
  → PluginError

Is this a command execution failure?
  → CommandError

None of the above?
  → VoidError (with descriptive code and context) — and consider whether a new class is warranted
```

### 21.5 AI Must Not Generate Forbidden Patterns

When generating error handling code, the AI must never produce:
- Silent catch blocks
- Generic `throw new Error('...')` without a typed class
- Unsupervised async operations
- String-based error matching
- Exposure of sensitive values in error messages or context

If the AI is uncertain whether a pattern violates this policy, it must err on the side of caution and ask for clarification.

### 21.6 AI Must Propagate Cause

Whenever the AI generates code that wraps an error, it must pass the original as `cause`. This is not optional.

### 21.7 AI Must Respect Layer Boundaries

The AI must not generate domain layer code that references infrastructure error types, and must not generate infrastructure code that throws domain errors. Layer boundaries in error handling mirror layer boundaries in architecture.

---

## 22. Review Checklist

Use this checklist during every code review that introduces or modifies error handling.

### Error Classification
- [ ] Every caught error is classified into one of the types defined in Section 2
- [ ] Domain errors are modeled as typed classes, not generic exceptions
- [ ] Infrastructure errors are caught at the infrastructure layer and wrapped before propagating upward

### Error Construction
- [ ] All thrown errors are instances of typed `VoidError` subclasses
- [ ] No raw `new Error('...')` is used in production code
- [ ] All errors carry a specific `code` and meaningful `message`
- [ ] All wrapping errors pass the original as `cause`
- [ ] Error codes follow the `SCREAMING_SNAKE_CASE` and prefix convention

### Catch Blocks
- [ ] No catch block is empty or silent
- [ ] Every catch block logs, wraps-and-rethrows, returns a result, or executes a fallback
- [ ] Catch blocks do not catch more broadly than necessary
- [ ] Unrecognized error types are re-thrown, not swallowed

### Async Handling
- [ ] All async operations are awaited or supervised with `.catch()`
- [ ] No top-level async calls are unsupervised
- [ ] `Promise.all` calls have error handling
- [ ] `Promise.allSettled` results are inspected individually

### Logging
- [ ] Every error is logged at the correct level (see Section 9.1)
- [ ] Log entries include all required fields (see Section 9.2)
- [ ] No sensitive values appear in log entries

### User-Facing Responses
- [ ] User-facing error messages contain no internal details
- [ ] All error responses follow the standard structure (Section 13.2)
- [ ] Validation errors include field-level details

### Retry and Fallback
- [ ] Retry is only applied to eligible (transient, idempotent) operations
- [ ] Retry has a maximum attempt count and backoff configuration
- [ ] Fallback is logged when applied
- [ ] Fallback does not produce silently incorrect data

### Forbidden Practices
- [ ] No silent catches
- [ ] No empty catch blocks
- [ ] No generic error throws
- [ ] No unsupervised async operations
- [ ] No sensitive data in error messages
- [ ] No errors used as control flow
- [ ] No string-based error code matching

---

*This document is the official and sole error handling reference for the Void project. All layers, subsystems, contributors, and AI systems operating on this codebase are bound by the policies defined here. Any conflict between this document and other documents is resolved in favor of this document. Changes to this policy require explicit review and approval.*
