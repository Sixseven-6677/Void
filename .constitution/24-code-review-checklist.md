# 24 — Code Review Checklist

> **Status:** Official  
> **Scope:** Every pull request, every patch, every modification to the Void codebase — no exceptions  
> **Authority:** This document is the official and mandatory code review reference for Void. A change is not accepted until every applicable section of this checklist has been reviewed by at least one engineer other than the author. A reviewer who approves a change without completing this checklist accepts shared responsibility for any defect the checklist would have caught. An AI system that generates a change must self-evaluate against this checklist before delivering the change.

---

## How to Use This Checklist

Every item is a gate. An item that cannot be answered "yes" — or "not applicable with justification" — is a blocking defect. The reviewer marks it as a blocking defect in the review, the author addresses it, and the reviewer re-checks before approval.

**Marking items as not applicable** requires a written justification in the review. "N/A" without explanation is not acceptable. The justification must explain which aspect of the change makes the item inapplicable — not simply assert that it is.

**Severity classification:**

| Symbol | Severity | Meaning |
|---|---|---|
| 🔴 | Blocking | Must be resolved before merge. Non-negotiable. |
| 🟡 | Required | Must be resolved before merge unless a specific exemption is documented in the PR |
| 🟢 | Advisory | Should be addressed; may be deferred to a follow-up issue with tracking |

All items without a symbol are 🔴 Blocking unless otherwise noted.

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [SOLID Principles](#2-solid-principles)
3. [Naming](#3-naming)
4. [Layer Boundaries](#4-layer-boundaries)
5. [Dependency Rules](#5-dependency-rules)
6. [TypeScript](#6-typescript)
7. [Error Handling](#7-error-handling)
8. [Logging](#8-logging)
9. [Testing](#9-testing)
10. [Security](#10-security)
11. [Performance](#11-performance)
12. [Facebook Layer](#12-facebook-layer)
13. [Sessions](#13-sessions)
14. [Documentation](#14-documentation)
15. [Maintainability](#15-maintainability)
16. [Final Gate](#16-final-gate)

---

## 1. Architecture

> Reference: `01-project-philosophy.md`, `02-architecture.md` through `14-event-system.md`

### 1.1 Layer Placement

- [ ] 🔴 Every new file is placed in the correct layer — Service, Manager, Repository, Plugin, Command, or infrastructure utility — according to the definitions in the constitution
- [ ] 🔴 The component type matches its name suffix: `*Service.ts`, `*Manager.ts`, `*Repository.ts`, `*Plugin.ts`, `*Command.ts`
- [ ] 🔴 No new component type has been invented that does not exist in the constitution — if a new abstraction is genuinely needed, an ADR accompanies the change
- [ ] 🔴 The layer placement is consistent — a concern that belongs to Services is not split between a Service and a raw utility module at the same level

### 1.2 Responsibility Boundaries

- [ ] 🔴 Each new component has exactly one well-defined responsibility — it does not combine concerns from multiple constitution-defined roles
- [ ] 🔴 No Service directly implements persistence logic — all database access goes through a Repository
- [ ] 🔴 No Repository implements business logic — it only translates between the domain model and storage
- [ ] 🔴 No Manager implements business logic — it only coordinates component lifecycles and state transitions
- [ ] 🔴 No Plugin implements business logic that belongs in a Service — Plugins extend behavior, they do not own domain logic

### 1.3 New Abstractions

- [ ] 🟡 Any new interface, abstract class, or protocol introduced in the change is justified — it solves a concrete problem, not a hypothetical future problem
- [ ] 🟡 Any new cross-cutting concern introduced is documented in the constitution or accompanied by a PR to add it
- [ ] 🟢 The component's relationship to the rest of the system is immediately comprehensible from its name, location, and interface — no exploration of the implementation should be required to understand its role

### 1.4 Architectural Decisions

- [ ] 🔴 Any non-obvious design choice in the change has an accompanying comment or ADR that explains why this approach was chosen over the obvious alternative
- [ ] 🟡 No existing architectural decision recorded in the constitution has been silently reversed or bypassed in the change

---

## 2. SOLID Principles

> Reference: `02-solid-principles.md`

### 2.1 Single Responsibility Principle

- [ ] 🔴 Every class, module, and function in the change has a single, clearly stateable reason to change — it does not do two unrelated things
- [ ] 🔴 No function exceeds 40 lines of logic — longer functions are either a sign of multiple responsibilities or missing helper decomposition
- [ ] 🔴 No class has more than one primary concern that would cause it to be modified for different reasons in different scenarios
- [ ] 🟡 Utility modules do not accumulate unrelated helpers — each utility module has a coherent theme

### 2.2 Open/Closed Principle

- [ ] 🟡 New behavior has been added through extension (new classes, new interface implementations, new Plugin registrations) rather than by modifying existing, tested code wherever possible
- [ ] 🟡 No existing public interface has been broken to accommodate new behavior when an additive approach was available
- [ ] 🟢 Extension points used by the Plugin system have not been modified in a way that breaks existing Plugin implementations

### 2.3 Liskov Substitution Principle

- [ ] 🔴 Any class that implements an interface or extends a base class satisfies the full contract of that interface — it does not throw `NotImplemented` for optional-seeming methods, does not narrow preconditions, and does not weaken postconditions
- [ ] 🔴 No implementation returns a value type incompatible with what the interface declares — including Promise vs non-Promise, null vs non-null variants
- [ ] 🟡 Subclasses do not override methods in ways that produce surprising behavior for callers who only know the base type

### 2.4 Interface Segregation Principle

- [ ] 🟡 No interface forces implementors to depend on methods they do not use — large interfaces are split by usage cohesion, not by assumed convenience
- [ ] 🟡 No function accepts an object parameter requiring fields the function does not actually use — the parameter type is as narrow as the function's actual requirements

### 2.5 Dependency Inversion Principle

- [ ] 🔴 High-level components depend on abstractions (interfaces, abstract types), not on concrete implementations — except at explicit composition roots
- [ ] 🔴 Dependencies are injected rather than instantiated inside the component — no `new ConcreteService()` inside a Service or Manager body
- [ ] 🟡 Test doubles (mocks, stubs, fakes) can replace any dependency without modifying the component under test — verifying that dependency inversion is real, not nominal

---

## 3. Naming

> Reference: `03-naming-conventions.md`

### 3.1 File Names

- [ ] 🔴 File names use PascalCase for class files (`AccountService.ts`), camelCase for utility modules (`sessionUtils.ts`), and kebab-case for configuration files (`jest.config.ts` is acceptable)
- [ ] 🔴 The file name matches the primary export — a file named `AccountService.ts` exports `AccountService` as its primary export
- [ ] 🔴 Test files follow the pattern `*.test.ts` and are co-located with the file they test

### 3.2 Class and Interface Names

- [ ] 🔴 Class names are PascalCase nouns or noun phrases — they describe what the class is, not what it does
- [ ] 🔴 Interface names are PascalCase — no `I` prefix (not `IAccountService` — use `AccountService` for the interface and `AccountServiceImpl` or a domain-specific name for the implementation if needed)
- [ ] 🔴 Abstract classes use the suffix `Base` when they are designed for extension: `ServiceBase`, `RepositoryBase`
- [ ] 🔴 No name collides with a built-in global, a widely-used library export, or another component in the same namespace

### 3.3 Method and Function Names

- [ ] 🔴 Method names are camelCase verbs or verb phrases that describe the operation: `findById`, `createSession`, `handleDisconnect`, `validateToken`
- [ ] 🔴 Boolean-returning methods use `is`, `has`, `can`, or `should` prefixes: `isAuthenticated`, `hasActiveSession`, `canPublish`
- [ ] 🔴 Methods that return collections are plural: `findSessions`, `listAccounts`
- [ ] 🔴 Methods that may return nothing use `find` prefix rather than `get` — `get` implies definite retrieval, `find` implies the result may be absent
- [ ] 🟡 No abbreviations that require domain knowledge to decode — `acct` for `account`, `sess` for `session`, `msg` for `message` are not acceptable in public interfaces

### 3.4 Variable and Parameter Names

- [ ] 🔴 Variable names are camelCase and descriptive — `sessionId` not `sid`, `accountId` not `id` when the variable is in a scope with multiple entity references
- [ ] 🔴 No single-letter variable names except for established conventions: `i`, `j`, `k` for loop indices in tight numeric loops; `e` for caught errors in `catch` blocks
- [ ] 🔴 Boolean variables use the same `is`/`has`/`can`/`should` prefix convention as boolean methods
- [ ] 🟡 Loop variables over domain entities use the entity name: `for (const session of sessions)` — not `for (const s of sessions)`

### 3.5 Constant Names

- [ ] 🔴 Module-level constants that are fixed values use `SCREAMING_SNAKE_CASE`: `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT_MS`
- [ ] 🔴 Constants are named for what they represent, not their value: `MAX_SESSION_DURATION_MS` not `SEVEN_DAYS_IN_MS`

---

## 4. Layer Boundaries

> Reference: `08-layer-boundaries.md`

### 4.1 Service Layer

- [ ] 🔴 Services call only Repositories and other Services — never directly access any database client, ORM instance, cache client, or network socket
- [ ] 🔴 Services do not import from infrastructure packages directly — all infrastructure access is mediated through the Repository layer
- [ ] 🔴 Services do not contain SQL, query builder calls, or cache key construction — these belong in Repositories
- [ ] 🔴 Services do not emit raw HTTP responses or hold HTTP request objects — they operate on domain types only

### 4.2 Repository Layer

- [ ] 🔴 Repositories return domain model types — not raw database row objects, not ORM entity instances, not serialized strings
- [ ] 🔴 Repositories do not call other Repositories — cross-entity queries are composed at the Service layer or via a dedicated read model
- [ ] 🔴 Repositories do not apply business rules — they execute the query as requested; validation and policy enforcement live in Services
- [ ] 🔴 Every Repository method returns a typed Result — success with a domain type or failure with a typed error — never throws, never returns `null | undefined` without a typed reason

### 4.3 Manager Layer

- [ ] 🔴 Managers do not issue database queries directly — all persistence is delegated to Services or Repositories as appropriate
- [ ] 🔴 Managers do not implement business logic — they observe and coordinate component lifecycle state
- [ ] 🔴 Managers do not hold state that belongs in the database — in-memory Manager state is transient operational state only
- [ ] 🔴 Managers that emit events use typed event envelopes — no raw string events with untyped payloads

### 4.4 Plugin Layer

- [ ] 🔴 Plugins operate only through the Plugin contract — they do not hold references to internal Service or Manager instances obtained outside the official Plugin lifecycle
- [ ] 🔴 Plugins do not bypass the Facebook Layer — all Facebook API interaction from Plugins goes through the Facebook Layer abstraction
- [ ] 🟡 Plugins declare their dependencies explicitly — no implicit reliance on global singletons or module-level state outside the Plugin contract

---

## 5. Dependency Rules

> Reference: `04-dependency-rules.md`

### 5.1 Dependency Direction

- [ ] 🔴 No circular dependencies exist in the change — running the project's circular dependency check produces no new cycles
- [ ] 🔴 The dependency direction is downward: Managers → Services → Repositories — no upward dependency from a lower layer to a higher layer
- [ ] 🔴 Infrastructure modules (database clients, HTTP clients, cache clients) are depended on from the Repository layer only — not from Services or Managers
- [ ] 🔴 The Facebook Layer is not imported by Services directly — access to the Facebook Layer is mediated through the Manager or Plugin contract

### 5.2 External Dependencies

- [ ] 🔴 No new external package dependency has been introduced without: (a) a justification comment in the PR, (b) an assessment of the package's maintenance status and license
- [ ] 🟡 No dependency introduced duplicates functionality already available in the existing dependency set — adding a second date manipulation library when one is already present requires explicit justification
- [ ] 🟡 New dependencies are pinned to a specific version range — not `*` or `latest`
- [ ] 🟢 The total bundle size impact of new dependencies has been assessed for client-facing packages

### 5.3 Internal Coupling

- [ ] 🟡 No component imports from another component's internal implementation files — only from its public interface exports
- [ ] 🟡 No component has been made to depend on a detail of another component's implementation that the owning component could change without notice

---

## 6. TypeScript

> Reference: `05-typescript-rules.md`

### 6.1 Type Safety

- [ ] 🔴 No use of `any` — every value has a specific type or a union that accurately describes its domain
- [ ] 🔴 No use of `as unknown as T` double-cast — these patterns bypass the type system entirely and hide type errors
- [ ] 🔴 No suppression of TypeScript errors using `@ts-ignore` or `@ts-expect-error` without a comment explaining the exact TypeScript limitation being worked around and why a type-safe alternative is not available
- [ ] 🔴 No implicit `any` allowed — all function parameters have explicit type annotations
- [ ] 🔴 All function return types are explicitly annotated — the compiler infers correctly, but explicit return types are required for public interfaces for documentation clarity

### 6.2 Strict Mode Compliance

- [ ] 🔴 The change compiles with zero TypeScript errors under the project's `strict: true` configuration
- [ ] 🔴 No `strictNullChecks` violations — no unchecked access to a value that may be `null` or `undefined`
- [ ] 🔴 No `noUncheckedIndexedAccess` violations — array access and object index access results are checked before use

### 6.3 Type Design

- [ ] 🔴 Discriminated unions are used for types that represent a set of distinct variants — no stringly-typed variant fields (`type: string` when `type: 'success' | 'failure'` is the actual domain)
- [ ] 🔴 `readonly` is applied to all properties that must not be mutated after construction — especially in domain model types, event types, and command types
- [ ] 🟡 Generic type parameters have meaningful names — `T` is acceptable for truly generic utilities; `TEntity`, `TError`, `TResult` for domain-adjacent generics
- [ ] 🟡 Mapped types, conditional types, and template literal types are not used where a simpler explicit type would be clearer — type-level cleverness is not valued for its own sake

### 6.4 Enums and Literal Types

- [ ] 🟡 `const enum` is not used for values that must cross module boundaries or be serialized — use union types of string literals instead
- [ ] 🟡 Regular `enum` is not used where a union of string literals produces the same type safety with better readability and no runtime footprint

### 6.5 Async Types

- [ ] 🔴 All async functions return `Promise<T>` with an explicit `T` — no `Promise<any>`, no `Promise<void>` when a value is actually returned
- [ ] 🔴 No mixing of async/await and raw `.then()/.catch()` chains within the same function — one style is used consistently
- [ ] 🔴 No floating Promises — every `async` call is either awaited or explicitly handled with `.then().catch()`

---

## 7. Error Handling

> Reference: `06-error-handling-policy.md`

### 7.1 Error Classification

- [ ] 🔴 All errors are classified as Operational or Programmer errors per the constitution — no unclassified error propagation
- [ ] 🔴 Operational errors (expected failures: not found, validation failure, rate limit exceeded) are represented as typed Result values — not thrown exceptions
- [ ] 🔴 Programmer errors (invariant violations, impossible states) are thrown with clear messages that identify the violated invariant and the context — not returned as Result values
- [ ] 🔴 No error is swallowed — every catch block either handles the error explicitly, re-throws it, or converts it to a typed Result

### 7.2 Error Types

- [ ] 🔴 No `throw new Error("something went wrong")` — error messages identify the specific failure condition, the expected state, and the actual state
- [ ] 🔴 No throwing of plain JavaScript objects (`throw { code: 'ERR_X' }`) — all thrown values extend the base error class
- [ ] 🔴 All error types carry sufficient context for diagnosis: operation name, relevant IDs, the condition that triggered the error
- [ ] 🟡 Error types are not reused across unrelated concerns — `ValidationError` for validation, `NotFoundError` for absence, `UnauthorizedError` for authorization failure — not a single generic `AppError` for everything

### 7.3 Result Pattern

- [ ] 🔴 All Repository methods return typed Results — `{ ok: true, value: T }` or `{ ok: false, error: TypedError }`
- [ ] 🔴 All Service methods that can produce expected failures return typed Results — callers are forced to handle both outcomes
- [ ] 🔴 Result types are not ignored — the caller unwraps and handles both branches explicitly, not just the success branch
- [ ] 🔴 No `result.value` access without first checking `result.ok === true`

### 7.4 Boundary Error Handling

- [ ] 🔴 All errors that cross the HTTP boundary (reaching the route handler) are caught by the global error middleware and converted to structured error responses — no unhandled errors reach the Express default handler
- [ ] 🔴 Stack traces are never included in API error responses in production — they are logged internally, not exposed to callers
- [ ] 🟡 External API errors (Facebook API, third-party services) are translated into domain errors at the boundary — callers receive domain-typed errors, not raw external error objects

---

## 8. Logging

> Reference: `07-logging-policy.md`

### 8.1 Log Hygiene

- [ ] 🔴 No `console.log`, `console.error`, `console.warn`, or `console.debug` in production code — all logging uses the project's structured logger
- [ ] 🔴 No sensitive data in log messages — passwords, tokens, session secrets, payment information, and personally identifiable information are never logged
- [ ] 🔴 Log messages are structured — key-value pairs with meaningful field names, not interpolated strings that cannot be queried
- [ ] 🔴 No log message that could produce a log injection attack — user-provided strings are passed as structured fields, not interpolated into the message template

### 8.2 Log Levels

- [ ] 🔴 Log levels are used correctly:
  - `ERROR` — an operation failed in a way that requires operator attention
  - `WARN` — an unexpected condition occurred but the operation completed; monitoring should note it
  - `INFO` — a significant, expected system event (startup, shutdown, connection established)
  - `DEBUG` — detail useful for debugging, not emitted in production
- [ ] 🔴 No `ERROR` log for an expected, handled failure (a not-found lookup is not an error — it is an expected outcome)
- [ ] 🔴 No `DEBUG` log left active in production code paths

### 8.3 Correlation

- [ ] 🔴 All log statements within a request handler carry the request correlation ID — log statements that cannot be correlated to their originating request are undiagnosable in production
- [ ] 🟡 Log statements for long-running operations (job processing, batch operations) carry a job correlation ID
- [ ] 🟡 Related log statements within a single operation share enough context fields to be reconstructed as a sequence during incident investigation

### 8.4 Volume

- [ ] 🟡 No log statement inside a tight loop that executes per-item — per-item logging in batch operations produces log storms that obscure other signals
- [ ] 🟡 No log statement duplicates information available in a preceding log statement in the same code path without adding new information

---

## 9. Testing

> Reference: `21-testing-policy.md`

### 9.1 Coverage Requirements

- [ ] 🔴 Every new Service method has at least one test for the success path and one test for each distinct failure path
- [ ] 🔴 Every new Repository method has at least one integration test against a real database or an accurately-behaving test double
- [ ] 🔴 Every new public API endpoint has at least one end-to-end test covering the success case and the primary error cases
- [ ] 🔴 No new code path that cannot be reached by tests — if code is added that cannot be tested, it is removed or the architecture is changed to make it testable

### 9.2 Test Quality

- [ ] 🔴 No test asserts on implementation details — tests assert on observable behavior: return values, emitted events, observable state changes
- [ ] 🔴 No test relies on test execution order — every test sets up its own state and tears it down; tests are independent
- [ ] 🔴 No test uses real external services (live Facebook API, live payment processor) — all external dependencies are test-doubled at the integration boundary
- [ ] 🔴 No test uses `setTimeout` or `sleep` to wait for async operations — tests use proper async coordination (awaiting Promises, using test utilities for event-driven code)

### 9.3 Test Naming

- [ ] 🔴 Test names follow the pattern: `"[unit under test] [action or condition] [expected outcome]"` — e.g., `"SessionService.create when account is suspended returns SuspendedAccountError"`
- [ ] 🔴 Test names are complete sentences that describe the behavior being verified — not descriptions of the test mechanics ("should call repository", "should not throw")
- [ ] 🟡 Test file organization mirrors the source file structure — a reader looking at `AccountService.ts` can immediately locate `AccountService.test.ts`

### 9.4 Mocks and Test Doubles

- [ ] 🔴 Mocks are typed — no `jest.fn()` without a type annotation that constrains the mock to the interface being replaced
- [ ] 🔴 No test double is more permissive than the real implementation — a mock that accepts invalid inputs without error produces tests that pass for code that would fail in production
- [ ] 🟡 Test doubles are minimal — they implement only the behavior needed by the test, not a complete simulation of the dependency

### 9.5 Regression Tests

- [ ] 🟡 Every bug fix includes a regression test that would have caught the bug before the fix was applied — the test fails on the buggy code and passes on the fixed code

---

## 10. Security

> Reference: `10-security-policy.md`

### 10.1 Input Validation

- [ ] 🔴 All external inputs — HTTP request bodies, path parameters, query parameters, WebSocket messages, job queue payloads — are validated against a typed schema before use
- [ ] 🔴 Validation failures return a structured error response — they do not produce unhandled exceptions or 500 errors
- [ ] 🔴 No validation schema uses permissive patterns (`string` with no constraints where `email`, `uuid`, or a bounded length is the actual requirement)
- [ ] 🔴 File uploads and binary data have explicit size limits enforced before the data is read into memory

### 10.2 Authentication and Authorization

- [ ] 🔴 Every new route that accesses user data requires authentication middleware — unauthenticated requests are rejected with 401 before reaching the route handler
- [ ] 🔴 Every new route that accesses or modifies data belonging to a specific account performs an authorization check — the authenticated identity is verified to own or have access to the requested resource
- [ ] 🔴 Authorization checks happen in the Service layer — not only in the route handler, ensuring that authorization is enforced regardless of how the Service is called
- [ ] 🔴 No IDOR (Insecure Direct Object Reference) — user-supplied IDs are validated against the authenticated user's permission before the referenced object is accessed

### 10.3 Secrets and Sensitive Data

- [ ] 🔴 No secrets, tokens, API keys, or passwords appear in source code, configuration files, log output, or comments
- [ ] 🔴 All secrets are accessed through the environment variable abstraction — no hardcoded fallback values for secrets
- [ ] 🔴 Sensitive fields in domain objects are not included in log output or API responses unless explicitly required — and when required, they are masked or tokenized
- [ ] 🔴 No sensitive data is included in error messages returned to API callers

### 10.4 Injection Prevention

- [ ] 🔴 No SQL string concatenation or interpolation — all database queries use parameterized queries or a query builder that prevents SQL injection
- [ ] 🔴 No command injection — user-provided input is never passed to shell execution functions
- [ ] 🔴 No path traversal — user-provided file paths are validated and normalized before any file system operation

### 10.5 Rate Limiting and Abuse Prevention

- [ ] 🟡 New authenticated endpoints have rate limiting applied — endpoints that perform expensive operations have tighter rate limits than read-only endpoints
- [ ] 🟡 New unauthenticated endpoints have rate limiting applied — they are the primary surface for abuse

---

## 11. Performance

> Reference: `22-performance-policy.md`

### 11.1 Stability First

- [ ] 🔴 No safety mechanism has been removed or weakened for performance — validation, retry logic, timeouts, and error handling are intact
- [ ] 🔴 No shared mutable state introduced to avoid the overhead of passing data through function arguments
- [ ] 🔴 The change does not introduce unbounded memory growth — all new in-memory structures have size limits and eviction or overflow policies
- [ ] 🔴 No timeout has been removed or set to infinity for any external call

### 11.2 Algorithmic Complexity

- [ ] 🔴 No O(N²) or worse algorithm in a hot code path — hot paths are O(N) or better
- [ ] 🔴 No N+1 query pattern — collection-loading code paths are reviewed for sequential per-item queries that could be a single batch query
- [ ] 🔴 No unbounded `Promise.all` over a collection of unknown size — parallel operations have a concurrency limit

### 11.3 Memory

- [ ] 🔴 No large dataset loaded entirely into memory when streaming or pagination is feasible
- [ ] 🟡 No new significant allocation in a hot code path without justification — objects created on every request are examined for pooling or reuse opportunities
- [ ] 🟡 Regular expressions used in hot paths are compiled once at module initialization — not on every function call

### 11.4 Async

- [ ] 🔴 Independent async operations are parallelized — sequential awaiting of independent operations is a latency defect
- [ ] 🟡 Long async loops yield periodically to avoid event loop starvation
- [ ] 🟡 New hot paths emit latency metrics — performance degradation is observable without profiling

---

## 12. Facebook Layer

> Reference: `11-facebook-layer-rules.md`

### 12.1 Access Discipline

- [ ] 🔴 The Facebook Layer is not imported directly by any Service — all Facebook API interaction goes through the designated Manager or abstraction that owns the Facebook connection
- [ ] 🔴 No new direct Facebook API call has been introduced outside the Facebook Layer module
- [ ] 🔴 The Facebook Layer abstraction is not bypassed for "convenience" — even in tests, the Facebook Layer interface is mocked rather than bypassed

### 12.2 Error Handling

- [ ] 🔴 All Facebook API error responses are classified and translated into typed domain errors at the Facebook Layer boundary — raw Facebook error objects do not leak into Services
- [ ] 🔴 Facebook API rate limit responses are handled at the Facebook Layer — they are not propagated as generic errors
- [ ] 🔴 Facebook API authentication failures trigger the correct reconnection or session invalidation flow — they are not silently discarded

### 12.3 State Management

- [ ] 🔴 Facebook session state (tokens, connection state, stream subscriptions) is managed exclusively by the Facebook Layer — no external component holds or mutates Facebook connection state directly
- [ ] 🔴 The Facebook Layer connection state transitions are valid — transitions occur only through the defined state machine (see the relevant Manager documentation)
- [ ] 🟡 The Facebook Layer emits the correct events for state transitions — consumers of Facebook Layer events receive typed, well-formed event envelopes

### 12.4 Reconnection Logic

- [ ] 🔴 Any change to the Facebook Layer reconnection logic has been reviewed against the reconnection state machine specification — unintended state transitions are a source of connection instability
- [ ] 🟡 Reconnection backoff parameters have not been changed without a documented reason — backoff parameters are tuned based on observed Facebook API behavior and should not be adjusted speculatively

---

## 13. Sessions

> Reference: `11-session-management.md` (FacebookSession) — for ConversationSession see `27-roadmap.md` Phase 4

### 13.1 Session Lifecycle

- [ ] 🔴 Any change that touches session creation, validation, expiration, or invalidation is reviewed against the session state machine — the state machine is the authoritative specification
- [ ] 🔴 No invalid session state transition is introduced — the state machine defines the valid transitions; any new code path that could produce a session in a state not reachable by valid transitions is a bug
- [ ] 🔴 Session tokens are validated on every use — no code path accesses session-protected resources without a token validation step
- [ ] 🔴 Session expiration is enforced server-side — client-reported session validity is not trusted

### 13.2 Session Storage

- [ ] 🔴 Session state is not stored in application process memory as the primary store — sessions that survive process restarts require a persistent store
- [ ] 🔴 Session tokens are not logged — a logged session token is a potential session hijacking vector
- [ ] 🔴 Session tokens are not included in URL parameters — tokens in URLs appear in access logs, browser history, and referrer headers

### 13.3 Concurrent Access

- [ ] 🔴 Session updates under concurrent modification are safe — no lost update problem is possible from concurrent requests affecting the same session without a conflict detection or locking mechanism
- [ ] 🟡 The session cleanup mechanism (expiring old sessions) is not affected by the change — any change to session storage schema must verify the cleanup query still functions correctly

### 13.4 Session Propagation

- [ ] 🔴 Session context is not passed through function arguments as raw primitive values (account ID as a string) — session context is passed as a typed session object that carries all relevant context
- [ ] 🟡 New operations that require session context declare their dependency on session context explicitly in their interface — no implicit reliance on a thread-local or request-scoped global session

---

## 14. Documentation

> Reference: `23-documentation-policy.md`

### 14.1 Interface Documentation

- [ ] 🔴 Every new public Service method has a complete docstring: purpose, parameters, return value, and all typed errors it can return
- [ ] 🔴 Every new public API endpoint is documented in the OpenAPI spec with all fields, response shapes, and error codes
- [ ] 🔴 Every new configuration option is documented with its type, default value, effect, and sensitivity classification
- [ ] 🔴 No new public interface ships without documentation — not "we will document it in a follow-up"

### 14.2 Architectural Decisions

- [ ] 🔴 Any non-obvious design choice in the change has an accompanying ADR or a comment that explains the rationale — a reviewer who does not understand why a choice was made must not approve it
- [ ] 🟡 If the change constitutes a project-wide policy change, a PR to update the relevant constitution document accompanies the code change

### 14.3 Comment Quality

- [ ] 🔴 All comments explain WHY — not WHAT (what the code does is visible from the code)
- [ ] 🔴 No commented-out code is present
- [ ] 🔴 All TODO comments have an owner, a tracking reference, and a deadline
- [ ] 🔴 All type assertions and non-null assertions have a comment explaining why the assertion is safe

### 14.4 Accuracy

- [ ] 🔴 Documentation for modified interfaces has been updated in the same PR as the code change
- [ ] 🔴 Deleted code has had its documentation deleted in the same PR
- [ ] 🟡 No documentation describes behavior the code does not implement

---

## 15. Maintainability

### 15.1 Readability

- [ ] 🔴 The change can be understood by an engineer unfamiliar with the affected area within ten minutes of reading — if it cannot, the complexity is either essential (and must be explained) or accidental (and must be reduced)
- [ ] 🔴 Magic numbers and magic strings are named constants — no literal `86400000` when `ONE_DAY_MS` communicates intent
- [ ] 🔴 No deeply nested conditional blocks (more than three levels of nesting) without an explanation or a refactor to reduce nesting using early returns or guard clauses
- [ ] 🟡 No functions longer than 60 lines including comments — long functions typically contain multiple responsibilities that can be extracted

### 15.2 Consistency

- [ ] 🔴 The change follows the patterns established in the existing codebase — no new local conventions that differ from the established conventions without documented justification
- [ ] 🔴 Error messages follow the same phrasing conventions as existing error messages in the codebase
- [ ] 🟡 The code style (spacing, bracket placement, import ordering) is consistent with the surrounding code — the formatter should have been run before submitting

### 15.3 Testability

- [ ] 🔴 Every component introduced in the change can be tested in isolation — dependencies are injectable, side effects are encapsulated, external calls are behind interfaces
- [ ] 🔴 No hidden global state is introduced — module-level mutable variables that affect behavior are not present unless explicitly designed and documented as a controlled singleton

### 15.4 Reversibility

- [ ] 🟡 Database schema changes are backward-compatible — a deployment can be rolled back without a schema rollback (additive changes are safe; removing columns, renaming columns, and changing types require a multi-phase migration)
- [ ] 🟡 API changes are backward-compatible or versioned — a change that removes a field or changes a response type without versioning breaks existing callers

---

## 16. Final Gate

These are the questions every reviewer must be able to answer affirmatively before approving any change.

### 16.1 Correctness

- [ ] 🔴 I understand what this change does and I have verified it does what it claims to do
- [ ] 🔴 I have considered the edge cases and verified they are handled correctly: empty collections, null optional values, concurrent access, overload conditions, external dependency failures
- [ ] 🔴 I have verified that the tests cover the success path and all material failure paths
- [ ] 🔴 I have verified that no test has been weakened, removed, or suppressed to make the change pass

### 16.2 Impact

- [ ] 🔴 I understand every component this change affects — directly (files modified) and transitively (callers, dependents, consumers)
- [ ] 🔴 I have verified that no existing behavior has been inadvertently changed — regression tests cover the affected behavior or a manual verification was performed
- [ ] 🟡 I have assessed the operational impact of this change — any new log output, new metric, changed error rate, or changed latency profile is understood and expected

### 16.3 Completeness

- [ ] 🔴 This change is complete — there are no TODOs, no placeholder implementations, no `// TODO: handle this error` comments without tracking references
- [ ] 🔴 All documentation has been updated in this PR — no documentation debt has been deferred
- [ ] 🔴 The change compiles with zero errors, all tests pass, and the linter reports no violations

### 16.4 Alignment

- [ ] 🔴 This change is consistent with the constitution — it does not silently violate any rule, bypass any boundary, or reverse any documented architectural decision
- [ ] 🔴 If this change represents a new architectural pattern, it is documented and the constitution will be updated to reflect it
- [ ] 🔴 I would be comfortable explaining every decision in this change to any other engineer on the project — there are no choices I made that I would not want scrutinized

---

*This checklist is the official and mandatory gate for every code change in Void. It is not a suggestion, a guideline, or a best-effort aspiration. It is the minimum standard for code quality in this project. A reviewer who approves a change without completing this checklist is accepting responsibility for its defects. An author who submits a change that fails this checklist is submitting incomplete work. The checklist is updated through the constitution process — individual reviewers may not waive checklist items except by documented exemption.*
