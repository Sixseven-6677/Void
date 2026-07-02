# 20 — Middleware Policy

> **Status:** Official  
> **Scope:** All middleware design decisions in Void — philosophy, execution order, the context pipeline, authentication, authorization, validation, rate limiting, error handling, logging, cancellation, and performance  
> **Authority:** This document is the single source of truth for middleware design in Void. Middleware is pipeline infrastructure — it prepares, guards, and enriches the context in which a request executes. It does not contain business logic. It does not make domain decisions. Every piece of domain reasoning in a middleware component is a design defect that belongs in a Service.

---

## Table of Contents

1. [Middleware Philosophy](#1-middleware-philosophy)
2. [The No-Business-Logic Rule](#2-the-no-business-logic-rule)
3. [Execution Order](#3-execution-order)
4. [The Context Pipeline](#4-the-context-pipeline)
5. [Authentication Middleware](#5-authentication-middleware)
6. [Authorization Middleware](#6-authorization-middleware)
7. [Validation Middleware](#7-validation-middleware)
8. [Rate Limiting Middleware](#8-rate-limiting-middleware)
9. [Error Middleware](#9-error-middleware)
10. [Logging Middleware](#10-logging-middleware)
11. [Cancellation](#11-cancellation)
12. [Performance](#12-performance)
13. [Best Practices](#13-best-practices)
14. [Anti-Patterns](#14-anti-patterns)
15. [Forbidden Middleware Practices](#15-forbidden-middleware-practices)
16. [AI Middleware Rules](#16-ai-middleware-rules)
17. [Review Checklist](#17-review-checklist)

---

## 1. Middleware Philosophy

### 1.1 Middleware Is a Pipeline, Not a Feature

Middleware is the ordered sequence of processing stages that every request passes through before reaching its handler and every response passes through before reaching its sender. It is infrastructure — invisible to users, essential to correctness, and concerned entirely with the mechanics of request handling.

Middleware does not produce domain outcomes. It does not send messages, update accounts, or validate business rules. It prepares the environment in which domain outcomes are produced: establishing who is making the request, whether they are permitted, whether the request is structurally valid, and whether system resources allow it to proceed. Once the environment is prepared, middleware steps aside and the handler — which calls a Service — does the actual work.

### 1.2 Middleware Is Uniform

The value of middleware comes from its uniformity. An authentication middleware that applies to every request provides a guarantee: no handler can be reached by an unauthenticated caller. An authorization middleware that applies before every handler provides a guarantee: no handler executes without the caller's permission having been verified. These guarantees are only valid if the middleware is truly uniform — if there are no bypass paths, no exceptions silently carved out, no handlers reachable without passing through the full pipeline.

When a middleware concern does not apply uniformly, the exception is explicit, documented, and visible in the pipeline configuration — not achieved by quietly not installing the middleware.

### 1.3 Middleware Is Composable and Ordered

Each middleware component does one thing. It reads from the context, optionally adds to the context, and either passes control to the next stage or terminates the request. The power of the middleware pattern is composition — combining many single-purpose stages into a complete pipeline. A middleware component that does multiple unrelated things is a middleware that has broken the composition model.

### 1.4 Middleware Is Transparent to Handlers

A handler does not know which middleware stages ran before it. It reads from the enriched context — the identity the authentication middleware established, the validated inputs the validation middleware verified, the rate limit state the rate limiter checked — but it does not know how those context values arrived. If the middleware pipeline changes — new stages added, existing stages reorganized — the handler continues to work without modification.

---

## 2. The No-Business-Logic Rule

This section is the most important in this document. Every other section is a consequence of it.

### 2.1 Middleware Contains No Business Logic

Business logic is any decision, transformation, or rule that is specific to the domain — that expresses what the system does rather than how requests flow through it. Business logic belongs exclusively in Services (per `15-service-rules.md`). It must not be placed in middleware for any reason.

Examples of business logic that must not appear in middleware:
- Deciding whether an account is eligible for a specific feature based on its subscription level
- Computing the rate limit quota for a specific user based on their account type
- Determining whether a message can be sent based on the recipient's privacy settings
- Transforming a request payload based on the caller's account region
- Applying promotional discounts based on the current date

### 2.2 The Boundary Test

When reviewing a piece of middleware, apply this test to every conditional and computation:

> *"If this decision were made differently, would it change what the system does for a user, or only how a request is handled?"*

If changing the decision would change the user's experience or the system's domain behavior — it is business logic and belongs in a Service. If changing the decision would only affect whether the request proceeds or how it is structured — it is infrastructure logic and may live in middleware.

### 2.3 Middleware That Needs a Domain Decision Calls a Service

When a middleware stage requires a domain judgment — "is this token still valid?", "does this caller have permission for this resource?", "has this caller exceeded their quota?" — it calls a Service that provides the judgment. The middleware does not implement the judgment itself. The Service returns a verdict; the middleware acts on the verdict.

This pattern makes the domain judgment testable (Service tests), auditable (one implementation), and replaceable (swap the Service without touching the middleware).

### 2.4 Verdicts Are Not Business Rules

A middleware stage acts on a binary verdict: proceed or reject. The rule that produces the verdict is a business rule that belongs in a Service. The action taken on the verdict — pass the request to the next stage, return an error response — is middleware infrastructure and belongs in the middleware.

---

## 3. Execution Order

### 3.1 Order Is Defined, Documented, and Enforced

The middleware execution order is a first-class architectural decision. It is defined explicitly — not emergent from the order in which components are registered. Every addition to the pipeline must specify where it belongs in the order and why.

### 3.2 Standard Pipeline Order

The following order is the standard Void middleware pipeline. Every request processes these stages in sequence. Departures from this order require explicit documentation and justification.

```
Incoming Request
       │
       ▼
  1. Logging (Request In)
       │
       ▼
  2. Cancellation / Deadline Propagation
       │
       ▼
  3. Request ID / Correlation ID Attachment
       │
       ▼
  4. Rate Limiting (Global)
       │
       ▼
  5. Authentication
       │
       ▼
  6. Authorization
       │
       ▼
  7. Rate Limiting (Per-User / Per-Resource)
       │
       ▼
  8. Input Validation
       │
       ▼
  9. Handler (Command / Controller / Event)
       │
       ▼
 10. Response Normalization
       │
       ▼
 11. Error Handling (catches from any prior stage)
       │
       ▼
 12. Logging (Request Out)
       │
       ▼
Outgoing Response
```

### 3.3 Why This Order Matters

Each position in the order is chosen to minimize unnecessary work and maximize security:

- **Logging first:** The request is recorded before any processing — even rejected requests produce a log entry
- **Cancellation early:** Cancelled or timed-out requests are detected before expensive operations begin
- **Correlation ID before everything:** Every log entry from every subsequent stage carries the same ID
- **Global rate limiting before authentication:** Unauthenticated flooding is stopped without touching the auth system
- **Authentication before authorization:** Identity must be established before permissions can be checked
- **Per-user rate limiting after authentication:** The user's identity is known; per-user quotas can be applied
- **Validation after auth:** Structural validation does not need to happen for requests that will be rejected anyway
- **Error handling wraps everything:** Any stage may produce an error; all errors are normalized here
- **Logging last:** The response code and duration are captured after all processing completes

### 3.4 Stage Skipping Is Explicit

When a route or handler does not require a specific middleware stage — a public endpoint that does not require authentication, a health check endpoint that is not rate limited — the skip is explicit and visible in the routing configuration. Silent skipping (installing middleware globally but quietly not applying it to certain routes through undocumented exceptions) is forbidden.

### 3.5 The Order Is Code-Reviewed

Changes to the pipeline order are code-reviewed with specific attention to the security and correctness implications. Moving a stage earlier or later can produce subtle vulnerabilities or correctness defects that are not obvious from reading the change alone.

---

## 4. The Context Pipeline

### 4.1 Context Is the Pipeline's Communication Channel

Middleware stages communicate with each other and with the handler through a shared context object — an immutable-by-convention container that carries request-scoped data. Each middleware stage that enriches the context produces a new version (or adds to the mutable context) that downstream stages and the handler can read.

The context carries:
- The raw request (method, path, headers, body)
- The correlation ID
- The authenticated identity (set by the Authentication middleware)
- The authorization verdict and permitted scopes (set by the Authorization middleware)
- The validated and parsed input (set by the Validation middleware)
- The cancellation signal
- Custom per-request metadata added by any stage

### 4.2 Context Values Have Typed Accessors

Every context value has a typed accessor — a function or property that reads the value and returns it in a typed form. There is no raw, untyped context access (e.g., `context.get('userId')` returning `unknown`). A typed accessor for `identity` returns an `Identity` type; an accessor for `validatedInput` returns the specific validated type for that route.

### 4.3 Context Is Request-Scoped

The context object lives for the lifetime of a single request. It is created at the start of the pipeline and destroyed when the response is sent. No context value is stored beyond the request's lifetime. No context object is shared between requests. A context value that must persist beyond the request is a domain value — it must be written to the database through a Service before the request ends.

### 4.4 Downstream Stages Must Not Break When Context Values Are Absent

When a middleware stage is skipped (e.g., authentication is not required for a public route), downstream stages that would normally read values set by that stage must handle their absence gracefully. A downstream stage that unconditionally reads `context.identity` without checking whether the authentication stage ran and set it will throw a null reference error on unauthenticated routes.

### 4.5 Context Additions Are Additive

Each middleware stage may add to the context — it must not modify or remove values that a prior stage has written. A middleware stage that overwrites the correlation ID set by the correlation middleware, or that removes the identity set by the authentication middleware, is breaking the pipeline contract.

---

## 5. Authentication Middleware

### 5.1 Purpose

The Authentication middleware establishes the identity of the request's caller. It verifies the caller's credential (token, API key, session cookie) and, if valid, adds a typed `Identity` object to the context. Downstream stages and handlers read this `Identity` to know who is making the request.

Authentication middleware does not decide what the caller is permitted to do. That is Authorization middleware's concern (Section 6).

### 5.2 What Authentication Middleware Does

1. Extract the credential from the request (header, cookie, query parameter — per the protocol)
2. Validate the credential's structure (present, non-empty, correct format)
3. Call the `AuthenticationService` with the credential
4. If the service returns a valid identity: add the `Identity` to the context and proceed
5. If the service returns an invalid credential: terminate the request with a `401 Unauthorized` response

### 5.3 What Authentication Middleware Does Not Do

- Does not decide whether the identity has permission for this request — Authorization middleware does this
- Does not look up account details beyond what is needed to establish identity
- Does not refresh tokens — token refresh is a Service capability triggered by the caller explicitly
- Does not log credential values — credential content must never appear in logs
- Does not implement the token validation algorithm — this is in the `AuthenticationService`

### 5.4 Authentication Failure Is Always 401

An authentication failure — invalid token, expired token, missing credential — always produces a `401 Unauthorized` response. The response body is a structured error indicating that the caller must present a valid credential. The response does not reveal why the credential was rejected (expired vs. invalid vs. revoked) — this detail aids attackers.

### 5.5 Anonymous Requests Are Explicitly Permitted

Routes that do not require authentication must be explicitly configured as public in the routing definition. The authentication middleware, when applied to a public route, either skips entirely or produces a null identity (and downstream stages handle null identity correctly). Public routes are not created by accident — they are deliberate and visible.

---

## 6. Authorization Middleware

### 6.1 Purpose

The Authorization middleware verifies that the authenticated caller is permitted to perform the requested operation. It reads the `Identity` from the context (set by Authentication middleware) and evaluates whether the identity holds the required permissions for this route.

Authorization middleware does not determine what permissions an identity holds — that is the `AuthorizationService`'s concern. Authorization middleware applies the verdict to the request.

### 6.2 Authorization Requires an Authenticated Identity

The Authorization middleware must run after the Authentication middleware. An authorization check without an established identity is meaningless. If the context contains no identity (the authentication stage did not run or the request is anonymous), the authorization stage terminates the request with a `403 Forbidden` response for any route that requires authorization.

### 6.3 What Authorization Middleware Does

1. Read the `Identity` from the context
2. Read the required permission(s) for this route from the routing configuration
3. Call the `AuthorizationService` with the identity and the required permissions
4. If the service returns permitted: proceed to the next stage
5. If the service returns denied: terminate the request with a `403 Forbidden` response

### 6.4 What Authorization Middleware Does Not Do

- Does not contain permission rules — rules live in the `AuthorizationService`
- Does not differentiate between "not permitted" and "resource does not exist" — both return `403` to prevent resource enumeration
- Does not log the specific permission that was missing — this detail is logged at `debug` level internally, not surfaced in the response
- Does not cache authorization verdicts locally — caching is the `AuthorizationService`'s concern

### 6.5 Resource-Level Authorization Is a Service Concern

Authorization middleware verifies route-level permissions: "is this caller permitted to access any resource at this route?" Resource-level authorization — "is this caller permitted to access this specific resource?" — requires knowledge of the resource's identity, which is not available in the middleware (the request body has not been parsed, the database has not been queried). Resource-level authorization is performed in the Service, after the resource has been loaded.

---

## 7. Validation Middleware

### 7.1 Purpose

The Validation middleware verifies that the request's structural inputs — path parameters, query parameters, headers, and body — conform to the schema defined for this route. Structurally valid inputs are parsed into typed objects and added to the context. Structurally invalid inputs terminate the request immediately with a `400 Bad Request` response.

### 7.2 Structural vs. Semantic Validation

Validation middleware performs **structural validation** only:
- Required fields are present
- Field types are correct
- Field values are within allowed formats (length, pattern, enumerated values)
- The body can be parsed (valid JSON, correct content type)

Validation middleware does not perform **semantic validation**:
- Whether a referenced entity exists in the database
- Whether the combination of values is valid in the current domain state
- Whether the caller is allowed to use these values

Semantic validation is performed in the Service after structural validation has confirmed the input is parseable.

### 7.3 The Schema Is the Contract

The validation schema for each route is the contract between the caller and the handler. The schema is defined in one place — the route definition or a shared schema file — and applied by the validation middleware. The handler reads validated, typed inputs from the context — it does not re-validate what the middleware has already verified.

### 7.4 Validation Errors Are Detailed and Actionable

A validation failure response identifies:
- Which field(s) failed validation
- What constraint was violated (required, type, format, length)
- What the caller must correct

A generic "invalid request" response that does not identify which field failed is not actionable. The caller cannot correct an error they cannot identify.

### 7.5 Validation Does Not Transform for Business Purposes

Validation middleware may parse and normalize input for structural correctness — trimming whitespace, parsing a date string into a `Date` object, converting a numeric string to a number. It must not transform input for business purposes — applying business defaults, converting between business concepts, enriching the input with domain data. Business transformation belongs in the Service.

---

## 8. Rate Limiting Middleware

### 8.1 Purpose

Rate limiting middleware protects the system's resources by enforcing limits on how many requests a caller (global, per-IP, per-user, per-resource) may make within a time window. Requests that exceed the limit are rejected with a `429 Too Many Requests` response before reaching the handler.

### 8.2 Two Tiers of Rate Limiting

Rate limiting is applied in two tiers at different positions in the pipeline:

**Global rate limiting (Stage 4):** Applied before authentication. Limits total requests from a given IP or network address, regardless of identity. Protects against unauthenticated flooding. The limit is coarse — sufficient to stop flooding, not so tight that it affects legitimate burst traffic.

**Per-user rate limiting (Stage 7):** Applied after authentication. Limits requests by authenticated identity, per route or per resource type. The limit is specific to the caller's account tier and the operation type. This is where per-account quotas are enforced.

### 8.3 Rate Limit State Is Managed by a Service

The rate limit counter state — current count, window start, limit threshold — is managed by the `RateLimitService`. The middleware calls the service, the service returns a verdict (allowed / denied + remaining quota + reset time), and the middleware acts on the verdict.

The middleware does not manage counter state directly. It does not read from or write to any rate limit store — it delegates entirely to the service.

### 8.4 Rate Limit Responses Include Standard Headers

Every response from a rate-limited route includes standard headers that allow callers to understand their current quota and plan their retry behavior:

```
X-RateLimit-Limit: 100          # Maximum requests in the window
X-RateLimit-Remaining: 23       # Requests remaining in the current window
X-RateLimit-Reset: 1720000000   # Unix timestamp when the window resets
Retry-After: 30                 # Seconds until retry is permitted (on 429)
```

These headers are included on all responses — not just `429` responses — so callers can track their quota proactively.

### 8.5 Rate Limiting Does Not Differentiate on Business Criteria

Rate limit thresholds by account tier (free accounts get 100 req/min, premium get 1000 req/min) are business rules. The middleware applies the threshold it receives from the `RateLimitService` verdict — it does not read the account tier itself and select a threshold. The tier-to-threshold mapping lives entirely in the `RateLimitService`.

---

## 9. Error Middleware

### 9.1 Purpose

The Error middleware is the single, uniform point where all errors from any pipeline stage or handler are caught, classified, normalized, and converted into a consistent error response format. It is the last meaningful stage in the pipeline — it wraps all prior stages.

### 9.2 Every Error Reaches the Error Middleware

No pipeline stage or handler catches and silences errors that should be surfaced to the caller. A stage may catch an error to transform it into a more appropriate typed error — but it must either re-throw the typed error (so the Error middleware catches it) or terminate the request with the correct response. There is no `try { ... } catch { /* ignore */ }` in pipeline code.

### 9.3 Error Classification at the Boundary

The Error middleware classifies errors into HTTP status codes and structured response bodies. The mapping is defined once in the Error middleware — not in each handler:

| Error Category | HTTP Status | Description |
|---|---|---|
| `validation_error` | 400 | Structural input validation failed |
| `unauthenticated` | 401 | Credential missing or invalid |
| `forbidden` | 403 | Permission denied |
| `not_found` | 404 | Resource does not exist |
| `conflict` | 409 | Operation conflicts with current state |
| `unprocessable` | 422 | Semantic validation failed |
| `rate_limited` | 429 | Quota exceeded |
| `unavailable` | 503 | A dependency is temporarily unavailable |
| `internal_error` | 500 | Unexpected error — something went wrong |

### 9.4 Error Responses Are Structured

Every error response follows a consistent structure:

```json
{
  "error": {
    "code": "validation_error",
    "message": "The request could not be processed.",
    "details": [
      { "field": "phoneNumber", "constraint": "format", "message": "Must be E.164 format" }
    ],
    "requestId": "req_abc123"
  }
}
```

The `requestId` is the correlation ID from the context — enabling the caller to reference a specific failed request in a support interaction, and enabling operators to find the full request trace in the logs.

### 9.5 Internal Error Details Are Not Surfaced

When an `internal_error` occurs — an unexpected exception from a Service, a database error that was not anticipated — the response contains only a generic message and the correlation ID. The error's internal details (stack trace, database error message, Service error context) are logged internally but must never appear in the response body. Surfacing internal details exposes system internals to potential attackers and is a security concern.

### 9.6 Error Middleware Logs Errors

The Error middleware is the canonical location where errors are logged. It has access to:
- The error itself (type, message, category)
- The request context (correlation ID, identity, route, method)
- The response status code

A single log entry per request error, produced here, is sufficient. Stages that produce errors must not also log them — duplicate logging creates noise.

---

## 10. Logging Middleware

### 10.1 Purpose

The Logging middleware is the bookend of the pipeline. At the start (before all other stages), it records that a request arrived. At the end (after all other stages), it records how the request completed — status code, duration, and relevant metadata.

### 10.2 Request Ingress Log Entry

When a request enters the pipeline, the Logging middleware records:
- Timestamp (UTC, millisecond precision)
- Correlation ID (generated or extracted from the request)
- HTTP method and path (without query parameters if they may contain sensitive data)
- Caller IP address (or the last hop in the X-Forwarded-For chain)
- Content-Type and Content-Length (for request body presence; not the body contents)

This entry is written before any processing begins — including before authentication. Even requests that are immediately rejected (e.g., by rate limiting) produce an ingress log entry.

### 10.3 Request Egress Log Entry

When the response is ready to be sent, the Logging middleware records:
- Correlation ID (same as ingress)
- HTTP status code
- Response time in milliseconds (from ingress to egress)
- Response Content-Length
- The authenticated identity (if authentication succeeded — user ID only, not credential)

### 10.4 What Is Never Logged

The Logging middleware must never log:
- Request body contents (may contain passwords, tokens, personal data)
- Authorization header value (contains the credential)
- Cookie values
- Query parameters that may contain tokens or personal data
- Response body contents
- Any value identified as personally identifiable or sensitive in `17-database-policy.md`

Logging these values constitutes a data leak. The correlation ID enables retrospective investigation through controlled access to log records — it does not require logging the sensitive content itself.

### 10.5 Sensitive Headers Are Redacted in Logs

When headers must be logged (for debugging transport issues), the following headers are redacted — their names are logged but their values are replaced with `[REDACTED]`:
- `Authorization`
- `Cookie`
- `X-API-Key`
- `X-Session-Token`
- Any header whose name contains `token`, `key`, `secret`, or `credential` (case-insensitive)

---

## 11. Cancellation

### 11.1 Cancellation Signals Are Propagated

Every request carries a cancellation signal — a mechanism that allows the pipeline and all downstream operations to be notified that the request has been cancelled (the client disconnected, the timeout expired, the caller explicitly aborted). The Cancellation middleware creates this signal at the start of the pipeline and makes it available through the context.

### 11.2 Every Long-Running Operation Checks for Cancellation

Any middleware stage or handler that performs a long-running operation — a database query, an external service call, a computation that may take time — must check the cancellation signal at appropriate intervals. A cancelled request that continues executing consumes resources unnecessarily and delays the worker for the next request.

### 11.3 Request Deadlines Are Enforced

Every request has a maximum lifetime — a deadline by which the response must be sent. If the deadline is reached before the response is ready, the request is cancelled and a `503 Service Unavailable` or `504 Gateway Timeout` response is sent. Deadlines are configured per route category, with longer deadlines for known long-running operations.

Deadlines are not optional. A request with no deadline can hang indefinitely, consuming a worker slot and its memory allocation for an unbounded period.

### 11.4 Cancellation Is Not an Error

When a request is cancelled because the client disconnected, this is not an application error — it is normal behavior. Cancelled requests must not produce error log entries at the `error` level. They are logged at the `info` or `debug` level as a request outcome.

### 11.5 Downstream Services Respect Cancellation

When the pipeline calls a Service and the request is subsequently cancelled, the Service call must be cancelled too. A Service that does not respect the cancellation signal will continue executing even after the caller has abandoned the request. Services must accept the cancellation signal as part of their operation context and check it at appropriate points.

---

## 12. Performance

### 12.1 Middleware Must Be Fast

Every middleware stage adds latency to every request. Each stage's contribution must be measured and bounded. A middleware stage that adds more than a few milliseconds to the request pipeline is a performance concern.

Performance budgets per middleware category:

| Middleware Stage | Target Overhead |
|---|---|
| Logging (ingress/egress) | < 1ms |
| Correlation ID attachment | < 0.1ms |
| Global rate limiting | < 2ms |
| Authentication | < 5ms (Service call) |
| Authorization | < 3ms (Service call, often cached) |
| Per-user rate limiting | < 3ms (Service call, often cached) |
| Input validation | < 2ms (schema validation) |
| Error normalization | < 1ms |

Any stage consistently exceeding its budget is profiled and optimized.

### 12.2 Service Calls in Middleware Are Cached Appropriately

Middleware stages that call Services — Authentication, Authorization, Rate Limiting — may produce results that are cacheable within the request or across requests with short TTLs. Caching in the Service (per `18-cache-policy.md`) reduces the latency of these Service calls. The middleware itself does not cache — it calls the Service, which manages its own cache.

### 12.3 Middleware Must Not Block the Event Loop

Every middleware stage that performs I/O — calling an authentication service, reading from a rate limit store — must do so asynchronously. A middleware stage that blocks the event loop blocks every concurrent request. All middleware I/O is awaited asynchronously.

### 12.4 Middleware Does Not Parse the Body Unnecessarily

The request body is parsed only once — by the Validation middleware, for routes that require body parsing. Middleware stages before Validation (Logging, Correlation, Rate Limiting, Authentication, Authorization) do not parse the request body. Parsing the body in multiple stages doubles or triples the parsing cost.

---

## 13. Best Practices

1. **One concern per middleware component.** A middleware component that handles authentication and rate limiting and logging is three middleware components incorrectly combined. Each stage handles exactly one concern. The pipeline composes them.

2. **Express the pipeline explicitly.** The pipeline configuration — the ordered list of stages applied to each route — is expressed explicitly in code and visible to any reader. The order must not emerge implicitly from the sequence in which components are registered.

3. **Test each stage in isolation.** Each middleware stage is independently testable: given an incoming context, does the stage produce the correct outgoing context or the correct termination? Middleware stages are tested without the rest of the pipeline.

4. **Design for graceful degradation when Services are unavailable.** Authentication middleware calls an `AuthenticationService`. If that Service is temporarily unavailable, the middleware must decide: fail closed (reject all requests) or fail open (permit all requests). The default for security-relevant middleware is fail closed. The chosen behavior is documented.

5. **Make public routes conspicuous.** Routes that bypass the authentication or authorization stages are higher-risk than protected routes. They must be conspicuous in the routing configuration — not easy to create accidentally, and immediately visible to a reviewer.

6. **Middleware errors use the Error middleware.** A middleware stage that encounters an error throws a typed error rather than constructing and sending an HTTP response itself. The Error middleware constructs all HTTP error responses. This ensures consistent error formatting across all stages.

7. **Avoid stateful middleware.** Middleware stages should be stateless — processing each request independently of prior requests. If a middleware stage must maintain state (e.g., a rate limit window counter), that state is managed in a Service or dedicated store — not in the middleware component's memory.

---

## 14. Anti-Patterns

### 14.1 The Business Logic Middleware

A middleware component that contains domain conditionals — checking account types, applying pricing rules, making eligibility decisions. The middleware has crossed into Service territory. Any domain decision found in middleware must be extracted to a Service that the middleware calls for the verdict it needs.

### 14.2 The God Middleware

A single middleware component that handles authentication, authorization, rate limiting, and validation in one block. This is an undecomposed pipeline — it must be split into individual, single-purpose stages that can be ordered, skipped, replaced, and tested independently.

### 14.3 The Order-Unaware Pipeline

A pipeline whose execution order is determined by the order of module imports or component registration — not by explicit declaration. Order-unaware pipelines are fragile: adding a new component in the wrong file or moving a registration call changes the pipeline behavior silently.

### 14.4 The Silent Pass-Through Error

A middleware stage that catches an error, decides "this is not my concern," and calls `next()` without re-throwing or terminating. The error is silently lost. The handler executes in a broken context. All errors in middleware are either handled (producing a response) or re-thrown (reaching the Error middleware).

### 14.5 The Context-Polluting Middleware

A middleware stage that adds large, expensive-to-compute values to the context "in case the handler needs them." Adding data to the context that no handler reads wastes computation on every request. Context values are added only when they are required by downstream stages or handlers.

### 14.6 The Duplicate Validator

A middleware validation schema that duplicates validation already performed in the Service. The middleware validates structural inputs; the Service validates semantic ones. When both validate the same structural rule, one of them is redundant. The middleware is the canonical location for structural validation — if it is correct and complete, the Service does not re-validate structure.

### 14.7 The Request-Body-Reading Logger

A Logging middleware that reads and logs the request body for debugging purposes. Request bodies may contain credentials, personal data, and sensitive content. Logging request bodies is a data leak. Correlation IDs and structured metadata provide sufficient context for investigation without exposing body contents.

---

## 15. Forbidden Middleware Practices

### 15.1 Business Logic in Middleware

Any conditional, transformation, or rule that represents domain behavior — "if the account type is X, then..." — is forbidden in middleware. Business logic belongs in Services. A middleware that contains business logic is immediately rejected in code review.

### 15.2 Direct Database Access in Middleware

Middleware stages must not issue database queries directly. If a middleware stage needs data from the database — to validate a token, to check a rate limit, to verify a permission — it calls a Service that uses a Repository. Database access boundaries defined in `17-database-policy.md` apply to middleware without exception.

### 15.3 Logging Sensitive Values

Logging credentials, tokens, session identifiers, passwords, personal data (names, phone numbers, email addresses), payment information, or any value marked sensitive in the data model is forbidden in all middleware logging. Correlation IDs are the safe mechanism for post-hoc log investigation.

### 15.4 Bypassing Authentication for Convenience

Creating a bypass path — a route that skips authentication without explicit, documented justification and review — is forbidden. Authentication bypasses create security vulnerabilities that are difficult to detect and are often exploited long after the bypass is forgotten.

### 15.5 Modifying Prior Context Values

A middleware stage must not overwrite or remove context values that a prior stage has set. The `Identity` set by the Authentication middleware must not be modified by any subsequent stage. If a downstream stage determines that the identity is incorrect, it terminates the request — it does not silently replace the identity.

### 15.6 Infinite Blocking in Middleware

A middleware stage must never block indefinitely — waiting on a lock, polling until a condition is met, or performing an unbounded computation. All operations in middleware are time-bounded. A middleware stage that can block indefinitely blocks every concurrent request.

---

## 16. AI Middleware Rules

This section defines how an AI system must reason about middleware when developing within Void.

### 16.1 The AI Must Not Generate Business Logic in Middleware

When generating middleware code, the AI must inspect every conditional and computation for domain intent. If a conditional reads account state, applies a business rule, or makes a domain decision, it belongs in a Service. The middleware calls the Service and acts on the verdict. The AI must not generate middleware that makes domain decisions internally.

### 16.2 The AI Must Generate Each Stage as a Separate Component

When the AI generates middleware for a new capability, each concern (authentication, authorization, validation, rate limiting, etc.) is generated as a separate, single-purpose stage. The AI must not combine multiple concerns into one middleware component for brevity or convenience.

### 16.3 The AI Must Specify the Pipeline Position

When the AI generates a new middleware stage, it must specify where in the pipeline the stage belongs — before or after each existing stage — and provide a documented justification. A middleware stage without a defined pipeline position is an incomplete implementation.

### 16.4 The AI Must Generate Service Calls for Domain Verdicts

When the AI generates a middleware stage that requires a domain verdict — "is this token valid?", "does this caller have permission?", "has this caller exceeded their quota?" — it must generate a call to the appropriate Service. The verdict logic is not implemented in the middleware itself.

### 16.5 The AI Must Generate Typed Context Additions

When the AI generates a middleware stage that adds to the context — an identity after authentication, validated input after validation — it must generate typed context additions. The context value has a defined type; the accessor for that value is typed. The AI must not generate `context.set('identity', rawValue)` without a corresponding typed accessor.

### 16.6 The AI Must Generate the Error Path for Every Stage

Every middleware stage the AI generates has both a success path (context enriched, next stage called) and an explicit failure path (request terminated with the correct HTTP status and a structured error response). The AI must not generate middleware stages with only a happy path.

### 16.7 The AI Must Not Log Sensitive Data

When the AI generates Logging middleware or adds logging to any middleware stage, it must explicitly exclude sensitive fields. If the AI generates a log statement that would include an authorization header, session token, request body, or personal data field, it must redact those fields in the generated code.

### 16.8 The AI Must Generate Pipeline Order Documentation

When the AI generates or modifies the pipeline configuration, it must generate or update the pipeline order documentation — the comment or document that shows all stages in order with a one-line description of each stage's purpose. An undocumented pipeline order is an undocumented architectural decision.

### 16.9 The AI Must Apply the No-Business-Logic Test Before Delivering

Before delivering any middleware implementation, the AI must apply the boundary test from Section 2.2 to every conditional and computation in the generated code. If any conditional or computation fails the test, the AI must refactor: extract the domain logic to a Service and have the middleware call the Service.

### 16.10 The AI Must Generate Tests for Each Stage

Every middleware stage the AI generates must have tests that verify:
- The success path: valid input produces the correct context enrichment and calls the next stage
- The failure path: invalid input terminates the request with the correct HTTP status and error structure
- Edge cases specific to the stage: expired credentials, missing required fields, exceeded quota
- The stage works correctly when prior context values are absent (for stages that may follow skipped stages)

---

## 17. Review Checklist

Use this checklist for every code review that introduces or modifies middleware.

### No Business Logic
- [ ] No domain conditionals are present — no account type checks, no eligibility rules, no business transformations
- [ ] Domain verdicts are obtained by calling a Service — not implemented in the middleware
- [ ] The boundary test (Section 2.2) has been applied to every conditional in the middleware

### Pipeline Order
- [ ] The new stage's position in the pipeline is explicitly declared
- [ ] The position is justified — why this stage runs before or after each adjacent stage
- [ ] The pipeline order documentation has been updated to include the new stage
- [ ] Any routes that skip this stage are explicitly configured and documented

### Context
- [ ] Context additions are typed — both the stored value and its accessor
- [ ] The stage does not overwrite or remove prior context values
- [ ] Downstream stages handle the absence of this stage's context values gracefully (if this stage can be skipped)

### Authentication Middleware (if applicable)
- [ ] Credentials are not logged
- [ ] Authentication failure returns 401 with a generic, non-revealing message
- [ ] Public routes are explicitly configured — not achieved by silently not applying the middleware

### Authorization Middleware (if applicable)
- [ ] Authorization runs after authentication
- [ ] Permission rules are in the AuthorizationService — not in the middleware
- [ ] Authorization failure returns 403 regardless of whether the resource exists

### Validation Middleware (if applicable)
- [ ] Only structural validation is performed — no database queries, no domain lookups
- [ ] Validation failures return 400 with field-specific, actionable error details
- [ ] The request body is parsed only once

### Rate Limiting Middleware (if applicable)
- [ ] Rate limit state is managed by the RateLimitService — not directly by the middleware
- [ ] Standard rate limit headers are included in all responses
- [ ] Rate limit thresholds are not hardcoded — they come from the Service verdict

### Error Middleware (if applicable)
- [ ] All error categories map to the correct HTTP status codes
- [ ] Internal error details are not surfaced in responses
- [ ] The correlation ID is included in every error response
- [ ] Error responses follow the standard structure

### Logging Middleware (if applicable)
- [ ] No sensitive values are logged: no credentials, no body contents, no personal data
- [ ] Sensitive headers are redacted
- [ ] Both request ingress and response egress are logged
- [ ] Correlation ID is present in all log entries

### Performance
- [ ] All I/O in the middleware is asynchronous
- [ ] The middleware does not parse the request body unless it is the Validation stage
- [ ] The expected per-request overhead is within the stage's budget

### Testing
- [ ] Tests cover the success path
- [ ] Tests cover every defined failure path
- [ ] Tests verify the middleware works correctly when run in isolation
- [ ] Tests verify behavior when prior context values are absent (if the stage can follow a skipped stage)

---

*This document is the official and sole reference for middleware design in Void. Middleware is pipeline infrastructure — it prepares the execution context, applies cross-cutting guards, and normalizes outcomes. It does not decide what the system does. Business logic belongs in Services. A middleware component that makes a domain decision is a middleware component that has violated its own purpose and must be refactored.*
