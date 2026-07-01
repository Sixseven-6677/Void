# 15 — Service Rules

> **Status:** Official  
> **Scope:** All service design decisions in Void — service responsibilities, business logic ownership, lifecycle, dependencies, communication, validation, transactions, error handling, performance, and testing  
> **Authority:** This document is the single source of truth for how Services are designed, structured, and governed within Void. No Service may be written, modified, or deleted without consulting this document. All business logic decisions must trace back to a Service. Changes to service design principles require updating this document before implementation.

---

## Table of Contents

1. [Service Philosophy](#1-service-philosophy)
2. [Service Responsibilities](#2-service-responsibilities)
3. [Business Logic Ownership](#3-business-logic-ownership)
4. [Service Lifecycle](#4-service-lifecycle)
5. [Service Dependencies](#5-service-dependencies)
6. [Stateless vs Stateful Services](#6-stateless-vs-stateful-services)
7. [Service Communication](#7-service-communication)
8. [Validation Strategy](#8-validation-strategy)
9. [Transaction Boundaries](#9-transaction-boundaries)
10. [Error Handling](#10-error-handling)
11. [Performance Rules](#11-performance-rules)
12. [Testing Rules](#12-testing-rules)
13. [Best Practices](#13-best-practices)
14. [Anti-Patterns](#14-anti-patterns)
15. [Forbidden Service Practices](#15-forbidden-service-practices)
16. [AI Service Rules](#16-ai-service-rules)
17. [Review Checklist](#17-review-checklist)

---

## 1. Service Philosophy

### 1.1 Services Are the Domain

Everything the system does — every decision it makes, every transformation it applies, every rule it enforces — is expressed in a Service. The Service layer is not a plumbing layer, not a routing layer, and not a convenience wrapper. It is the domain of the application. It is where Void's intelligence lives.

A system's quality is ultimately measured by the quality of its Services. Commands can be replaced — they are entry points. Plugins come and go — they are extensions. Managers coordinate infrastructure — they do not define behavior. But Services define what the system *does*. They encode the rules, the constraints, the workflows, and the decisions that make Void what it is.

### 1.2 The Service as the Authority

For any given capability — sending a message, validating an account, scheduling a task, managing a contact — there is exactly one Service that owns that capability's logic. That Service is the authority. Any component that needs the capability calls the Service. No component reimplements the capability independently.

This single-authority principle eliminates duplication. Duplicated logic is the source of divergence — two implementations of the same rule that drift apart over time, producing inconsistent system behavior. There is one implementation and it lives in the Service.

### 1.3 Services Are Callable from Anywhere

Because Services are the location of business logic, they must be accessible from every entry point that legitimately needs them: Commands call Services. Scheduled tasks call Services. Event handlers call Services. API endpoints call Services. Plugins call Services (through the Plugin API). The Service does not change because of who is calling it — the logic is the same regardless of the caller's identity.

### 1.4 Services Do Not Know Their Callers

A Service does not know — and must not know — whether it is being called from a Command, a scheduled task, an event handler, or a plugin. The caller provides inputs through the Service's interface. The Service applies its logic and returns a result. The caller's identity is not part of the Service's concern.

This ignorance is intentional. A Service that behaves differently depending on who calls it is a Service with implicit coupling to its callers. Coupling to callers prevents the Service from being called from new contexts without modifying it.

### 1.5 Services Are the Testability Boundary

Because Services contain the logic, they are the primary target of testing. A Service that can be tested in isolation — given inputs, it produces deterministic outputs — is a Service whose logic can be verified completely and independently of the infrastructure around it. A system whose logic is testable through its Services is a system whose correctness can be confidently maintained over time.

---

## 2. Service Responsibilities

A Service is responsible for exactly the capabilities it explicitly declares. Every Service has a name, a purpose statement, and a defined set of operations. The purpose statement is not optional — it is the Service's contract with the rest of the system.

### 2.1 What a Service Owns

A Service owns:
- **The logic of its operations:** The rules, conditions, decisions, and transformations that define what each operation does
- **The validation of its inputs:** Ensuring that inputs meet the requirements for the operation to proceed
- **The coordination of its dependencies:** Calling other Services, repositories, and infrastructure components in the correct sequence
- **The definition of its error cases:** What constitutes a failure, how failures are classified, and what information is returned on failure
- **The boundaries of its transactions:** What operations must succeed or fail as a unit

### 2.2 What a Service Does Not Own

A Service does not own:
- **Transport concerns:** How requests arrive (HTTP, command, event) — this is the entry point's concern
- **Presentation concerns:** How results are formatted for display — this is the caller's concern
- **Cross-cutting concerns:** Logging, tracing, authentication — these are applied uniformly through middleware or infrastructure layers, not inside Services
- **Persistence mechanism details:** How data is stored — a Service calls a repository; it does not write SQL
- **External platform details:** How a Facebook message is actually sent — a Service calls the Message Gateway abstraction; it does not know about FacebookTransport

### 2.3 Service Scope

A Service's scope is determined by cohesion — the operations in a Service belong together because they operate on the same domain concept or fulfill the same capability. A Service whose operations span multiple unrelated concepts is a Service that has grown beyond its proper scope. The correct response is to split it.

A Service that contains only one operation is not necessarily wrong — some capabilities are atomic and genuinely belong alone. A Service that contains fifty operations likely has no coherent domain boundary and must be decomposed.

---

## 3. Business Logic Ownership

Business logic is the rules, decisions, and transformations that define the system's behavior from a domain perspective. This section defines where business logic lives and where it is forbidden to live.

### 3.1 Business Logic Lives Exclusively in Services

Every piece of business logic in Void must reside in a Service. This is the most fundamental rule in this document. It has no exceptions.

Business logic includes:
- Conditional decisions based on domain state ("should this message be sent?", "is this account eligible?")
- Domain object transformations ("format this contact record for delivery", "compute the retry delay from this failure count")
- Enforcement of domain rules ("a session may not be used after invalidation", "a message may not exceed N characters")
- Workflows that coordinate multiple operations ("create the session, then notify the connection layer, then update the account status")
- Business-level validation ("is this phone number valid for this region?", "does this account have sufficient quota?")

### 3.2 Commands Must Not Contain Business Logic

A Command handler reads the Command Context, validates structural requirements (argument count, type), calls the appropriate Service, and returns the Service's result. It does not:
- Make decisions based on domain state
- Transform domain objects
- Enforce domain rules
- Coordinate multiple operations

A Command that contains any of the above has absorbed business logic that belongs in a Service. Per `13-command-system.md`, Command handlers must be thin. Thinness is enforced by the absence of business logic.

### 3.3 Plugins Must Not Contain Business Logic

Plugins add capabilities through the Plugin API — they do not implement domain logic independently. A plugin that needs to perform a domain operation calls a Service exposed through the Plugin API. A plugin that reimplements domain logic creates a shadow implementation that diverges from the canonical Service over time.

Per `12-plugin-system.md`, plugins are guests. Guests do not define the house rules. Services define the rules; plugins follow them by calling Services.

### 3.4 Managers Must Not Contain Business Logic

Managers (ConnectionController, SessionManager, ReconnectManager, etc.) are infrastructure orchestrators — they coordinate the lifecycle and operation of low-level components. They are not business logic containers. A Manager that conditionally decides whether to send a message based on account state has absorbed business logic that belongs in a Service.

The distinction: a Manager decides *how* the infrastructure operates; a Service decides *what* the system does.

### 3.5 Controllers Must Not Contain Business Logic

API Controllers (if present) are analogous to Command handlers — they are entry points that receive requests, validate structure, call Services, and return responses. A Controller that contains domain decisions, conditional logic based on domain state, or multi-step workflows has absorbed business logic that belongs in a Service.

### 3.6 The Business Logic Ownership Test

When writing any code, apply this test to every conditional, every transformation, and every multi-step sequence:

> *"If a different entry point (a scheduled task instead of a command, an event handler instead of an API call) needed the same behavior, would this code need to be duplicated?"*

If the answer is yes, the code is business logic and must be in a Service. If the answer is no (the code is purely about presentation, transport, or structural parsing), it may remain in the entry point.

---

## 4. Service Lifecycle

### 4.1 Service Instantiation

Services are instantiated once — at application startup — and held for the lifetime of the process. They are not created per-request, per-invocation, or per-user. A Service is a long-lived application component, not a request-scoped object.

The exception is stateless Services that are functionally pure — they may be instantiated on first use and cached, or instantiated per-call if instantiation cost is negligible. The choice between these approaches is an implementation detail that does not affect the Service's contract.

### 4.2 Service Registration

Services are registered in the dependency injection container (or equivalent initialization mechanism) at startup. Registration declares:
- The Service's interface (the contract it satisfies)
- The Service's concrete implementation
- The Service's dependencies (other Services, repositories, infrastructure components)

### 4.3 Service Initialization

If a Service requires initialization — loading cached state, verifying that dependencies are reachable, pre-computing constants — initialization is performed at startup, before the Service is made available to callers. A Service that fails initialization causes a startup failure — not a runtime failure on the first call.

### 4.4 Service Shutdown

If a Service holds resources — connections, timers, caches — it must release them during the application shutdown sequence. The shutdown sequence calls each Service's cleanup method in reverse dependency order. A Service that does not release its resources on shutdown causes leaks that persist until process termination.

### 4.5 Service Availability

A Service must be available for the entire duration of the application's operational period — from the moment initialization completes until shutdown begins. There must be no operational period during which a Service is unavailable to legitimate callers.

---

## 5. Service Dependencies

### 5.1 Dependencies Are Declared Explicitly

Every Service's dependencies — the other Services, repositories, and infrastructure components it requires — are declared explicitly in the Service's constructor or initialization interface. A Service must not discover its dependencies at runtime, must not pull dependencies from global state, and must not create its own dependency instances.

Explicit dependency declaration enables:
- Dependency injection — the system assembles the dependency graph
- Testability — tests can inject mocks or fakes for dependencies
- Auditability — the complete dependency graph is visible from the code structure

### 5.2 The Dependency Graph Must Be Acyclic

Service A may depend on Service B, and Service B may depend on Service C — but Service C may not depend on Service A. Circular dependencies between Services indicate that the responsibility boundaries between those Services are incorrectly drawn. The correct resolution is to extract the shared logic into a third Service that both depend on.

### 5.3 Dependency Direction

Dependencies flow in one direction: from less-specific to more-specific. A general-purpose Service may be depended upon by many. A highly specific Service depends on the general ones, not the other way around.

| Direction | Acceptable |
|---|---|
| High-level Service → Low-level Service | ✅ |
| High-level Service → Repository | ✅ |
| High-level Service → Infrastructure adapter | ✅ |
| Low-level Service → High-level Service | ❌ Inversion — redesign required |
| Service → Command | ❌ Services must not know about Commands |
| Service → Plugin | ❌ Services must not know about Plugins |

### 5.4 Service-to-Service Communication Is Through Interfaces

When Service A calls Service B, it calls through Service B's interface — not through a concrete class reference. This allows Service B's implementation to be replaced, wrapped, or mocked without Service A changing.

### 5.5 Depth Limits

A Service call chain that is ten levels deep is a warning sign. Deep chains produce difficult-to-trace failures and high latency from accumulated overhead. When the chain depth is growing, it typically indicates that intermediate Services are thin wrappers that add no value — they should be eliminated, or the domain model should be redesigned.

---

## 6. Stateless vs Stateful Services

### 6.1 The Preference for Statelessness

Stateless Services are always preferred over stateful ones. A stateless Service receives inputs, applies logic, calls dependencies, and returns a result — without retaining any information between calls. Stateless Services are:
- Trivially testable — call with inputs, verify outputs
- Safe for concurrent invocation — no shared mutable state
- Simple to reason about — no hidden history influencing behavior
- Safe to restart — no in-memory state is lost

### 6.2 When Stateful Services Are Justified

A Service may be stateful when:
- It manages a resource pool (connections, workers) that must be shared across calls
- It maintains a cache that is expensive to reconstruct per-call
- It tracks in-progress operations to prevent duplication (idempotency enforcement)
- It manages a long-running workflow state that spans multiple calls

Stateful Services require additional design care — their state must be thread-safe, must be cleanly initialized and shutdown, and must not become a source of subtle bugs as state accumulates over the process lifetime.

### 6.3 State That Belongs in Storage

If a Service's state must survive a process restart, it does not belong in the Service's memory — it belongs in a persistent store. A Service that caches data from the database in memory for performance may lose that cache on restart — this is acceptable. A Service that stores the canonical record of an account's status in memory will lose it on restart — this is a design defect.

### 6.4 Stateful Services Must Define Their State Contract

A stateful Service must explicitly document:
- What state it holds
- How state is initialized
- How state transitions occur
- What happens to state on error
- How state is cleaned up on shutdown

A stateful Service that does not define its state contract is an undocumented complexity that will produce maintenance problems.

---

## 7. Service Communication

### 7.1 Services Call Services Through Interfaces

When a Service needs a capability provided by another Service, it invokes the other Service through its declared interface. The calling Service does not know — and must not care — whether the called Service is a local in-process implementation, a cached wrapper, or a remote service. The interface is the contract; the implementation is not the caller's concern.

### 7.2 Communication Is Request-Response

The primary communication pattern between Services is request-response: the caller provides typed inputs and receives a typed result or a typed error. There are no fire-and-forget calls between Services — if a Service call cannot fail silently, it must return a result that the caller can inspect.

### 7.3 Services Do Not Subscribe to Events Directly

A Service does not subscribe to system events. Event subscription is the concern of Event Handlers — thin components that receive events and call Services. The Service receives the operation request from the handler; it does not listen for events itself. This preserves the separation between the event routing concern (the handler) and the business logic concern (the Service).

### 7.4 Services Do Not Emit Events

A Service does not emit events directly. If a Service operation produces an outcome that other parts of the system should be aware of, the caller of the Service emits the appropriate event after receiving the Service's result. The Service's responsibility ends with returning the result — downstream notification is the caller's concern.

The exception is system-level notifications (logging, metrics emission) that are applied uniformly through cross-cutting mechanisms rather than explicit Service code.

### 7.5 Synchronous by Default

Service calls are synchronous (or awaited-asynchronous) by default. A caller that invokes a Service awaits the result before proceeding. Fire-and-forget calls that ignore the result are permitted only when the caller has explicitly decided that the operation's outcome does not affect the caller's workflow — and this decision must be documented.

---

## 8. Validation Strategy

### 8.1 Services Validate Their Own Inputs

Every Service operation validates its inputs before executing its logic. Validation is the Service's first act. A Service that trusts its inputs without validation is a Service that will fail unpredictably when callers pass unexpected values.

### 8.2 Two Levels of Validation

Services apply validation at two levels:

**Structural validation:** Does the input satisfy the type, format, and presence requirements of the Service's interface?
- Required fields are present
- Types match expected types
- Values are within allowed ranges or formats
- Collections meet minimum or maximum size requirements

**Semantic validation:** Does the input make sense in the context of the current domain state?
- Does the referenced entity exist?
- Does the invoking context have the right relationship to the referenced entity?
- Is the requested operation currently valid for this entity's state?

Structural validation is fast and stateless — it runs against the input alone. Semantic validation may require database queries or Service calls to resolve domain state.

### 8.3 Validation Produces Typed Errors

Validation failures produce typed error results — not generic exceptions. A typed error communicates:
- Which validation failed
- Why it failed
- What the caller must correct

A caller that receives a typed validation error can respond appropriately — including providing a meaningful user-facing message. A caller that receives a generic exception cannot.

### 8.4 Validation Is Not Duplicated Between Caller and Service

The Command handler (or event handler, or API controller) may perform structural validation before calling the Service — to return fast errors without reaching the Service. This is acceptable. However, the Service must not trust this pre-validation — it must validate independently. The Service's validation is the canonical check. The caller's validation is an optimization.

### 8.5 Invalid Inputs Are Not Normalized Silently

A Service that receives an input that fails validation must reject it — not silently coerce it into something valid. Silent normalization (trimming strings, replacing null with a default, rounding numbers) hides caller errors and produces surprising behavior. The Service returns a validation error; the caller fixes the input.

---

## 9. Transaction Boundaries

### 9.1 Services Define Transaction Boundaries

When an operation requires multiple database writes that must all succeed or all fail, the Service that contains the operation defines the transaction boundary. The transaction begins before the first write and commits (or rolls back) after the last write.

### 9.2 Transaction Scope Is the Service Operation

A transaction's scope must not span multiple Service operations — each Service operation defines its own atomic boundary. A caller that calls Service A and then Service B does not hold a transaction across both calls. If two Service operations must be atomic, they must be unified into a single Service operation.

### 9.3 Repositories Are Transactional Participants

A Service that has a transaction boundary passes the transaction context to the repositories it calls within that boundary. Repositories do not create transactions — they participate in the one provided by the Service.

### 9.4 Long-Running Transactions Are Forbidden

A transaction must not hold database locks for the duration of a long-running operation (external API calls, multi-step computations). The pattern is:
1. Read what is needed (without a write transaction)
2. Execute the long-running operation
3. Write the result in a short, targeted transaction

A transaction that spans an external API call (e.g., sending a Facebook message) holds database locks while waiting for the network — blocking other operations on the same rows indefinitely.

### 9.5 Partial Failure Must Be Handled Explicitly

When a Service operation involves multiple steps and a later step fails, the Service must define what happens to the work already done. Options include:
- **Rollback:** Use a transaction to undo database changes
- **Compensating operation:** Apply a reversing operation to undo the effect (for operations that cannot be rolled back, such as sent messages)
- **Idempotent retry:** Design the operation to be safely re-attempted from any step

"Leave it in a partially complete state" is not an option. Partial completion produces inconsistent domain state that is difficult to detect and recover from.

---

## 10. Error Handling

### 10.1 Services Return Typed Results

Every Service operation returns one of two things:
- A typed success result — the operation succeeded; here is the output
- A typed error result — the operation failed; here is why, classified into a meaningful category

Services do not throw unhandled exceptions as their primary error communication mechanism. Exceptions are for truly unexpected conditions — bugs, infrastructure failures — not for expected failure modes (entity not found, validation failed, quota exceeded).

### 10.2 Error Classification

Service errors are classified into the following categories. Every Service must document which error categories each of its operations can produce.

| Category | Description | Caller Response |
|---|---|---|
| `validation_error` | Input failed structural or semantic validation | Fix the input and retry |
| `not_found` | The requested entity does not exist | Handle the absent entity |
| `conflict` | The operation conflicts with current domain state | Resolve the conflict and retry |
| `quota_exceeded` | The operation would exceed a resource limit | Wait or request quota increase |
| `permission_denied` | The caller lacks permission for this operation | Do not retry — escalate |
| `unavailable` | A dependency is temporarily unavailable | Retry with backoff |
| `rate_limited` | The caller is sending too many requests | Back off and retry |
| `internal_error` | An unexpected error occurred within the Service | Log and alert; do not retry blindly |

### 10.3 Errors Are Not Logged by the Service

A Service produces an error result — it does not log the error. Logging is the caller's responsibility. The caller has the context needed to log meaningfully: who called, what they were trying to do, what the correlation ID is. The Service has only the error itself. Logging in the Service produces duplicate, context-poor log entries.

The exception is `internal_error` — an unexpected infrastructure failure that the Service did not anticipate. Internal errors must be logged at the point of occurrence, within the Service, because they indicate a condition the caller may not know how to log meaningfully.

### 10.4 Error Results Are Not Exceptions

Services must not use exception throwing as the normal mechanism for returning business-level errors (not_found, validation_error, conflict). These are expected outcomes — they are part of the Service's defined interface. Expected outcomes are return values; exceptions are for unexpected conditions.

### 10.5 Errors Propagate With Context

When a Service calls another Service and that Service returns an error, the calling Service either:
- Handles the error (converts it to a different outcome, retries, falls back)
- Propagates the error — adding context about the calling operation before returning it to its own caller

A propagated error must include both the original error and the context of the operation that encountered it. A bare error re-thrown without context loses the chain of causation.

---

## 11. Performance Rules

### 11.1 Services Must Not Block the Event Loop

In an event-driven runtime, a Service operation that performs synchronous blocking I/O blocks the entire system. All database access, network calls, and file I/O within Services must be performed asynchronously.

### 11.2 N+1 Query Prevention

A Service that loads a collection of entities and then queries the database once per entity (N+1) is a performance defect. Services must use batch loading — a single query that retrieves all needed related data — rather than sequential per-entity queries. This is especially critical for operations that process message histories, contact lists, or large collections.

### 11.3 Cache at the Service Layer

Repeated identical queries within a short time window are a performance opportunity. Services may maintain in-memory caches for frequently accessed, slowly changing data. Caches must:
- Have an explicit TTL — no cache is valid forever
- Have a maximum size — unbounded caches become memory leaks
- Be invalidated when the underlying data changes
- Be transparent to callers — the Service's interface does not expose cache existence

### 11.4 Pagination for Large Results

A Service operation that could return an unbounded number of results must support pagination. Returning all records from a large table in a single response is a performance hazard. Services define their pagination contract — cursor-based or offset-based — and document it in the operation's interface.

### 11.5 Operations Must Have Defined Complexity

Every Service operation must have a defined worst-case time complexity. Operations that are O(N²) or worse based on input size are architectural problems — they must be redesigned before they reach production. Complexity analysis is part of the Service's design, not an afterthought.

### 11.6 Timeouts Are Mandatory for External Calls

Every call a Service makes to an external system — a database, a network service, the Facebook Layer — must have a defined timeout. A Service that makes an external call without a timeout can hang indefinitely, holding resources and blocking callers. Timeout values are configured per dependency type and per environment.

---

## 12. Testing Rules

### 12.1 Services Are the Primary Testing Target

Because Services contain all business logic, they are the primary testing target. A test suite that achieves high coverage of Services but lower coverage of Commands or Controllers is a well-prioritized test suite. The inverse is not.

### 12.2 Services Must Be Testable in Isolation

A Service must be testable without its real dependencies — without a real database, without a real Facebook connection, without real external services. This requires:
- Dependencies are injected, not hard-coded
- Interfaces are used for dependencies, not concrete classes
- No global state is accessed inside Services

A Service that cannot be tested in isolation has dependency coupling that must be eliminated.

### 12.3 Each Operation Gets Its Own Tests

Every operation exposed by a Service must have dedicated tests that cover:
- The happy path — valid inputs produce the expected success result
- Each validation error case — each invalid input produces the appropriate typed error
- Each semantic error case — each invalid domain state produces the appropriate typed error
- Each dependency error case — each possible failure from a dependency produces the correct Service response
- Edge cases specific to the operation's logic

### 12.4 Tests Assert on Typed Results

Tests must assert on the typed result returned by the Service — not on implementation details (which methods were called, how many queries were run). A test that asserts `repository.save was called once` is testing implementation. A test that asserts `the returned result has status 'active' and contains the expected account ID` is testing behavior.

### 12.5 Test Data Is Explicit

Test data must be explicitly constructed in the test — not loaded from fixtures, not shared across test cases, not mutated between assertions. Each test is self-contained. A test failure must be diagnosable by reading only the test, its inputs, and its assertions.

### 12.6 Tests Must Be Fast

Service tests must not make real network connections, real database connections, or real external API calls. These slow tests down by orders of magnitude and make the test suite dependent on external infrastructure. All external dependencies are replaced with fakes or mocks in unit tests. Integration tests (which test the Service with real infrastructure) are kept in a separate, explicitly-labeled suite.

### 12.7 Error Paths Are First-Class

Error paths must have the same test coverage as the happy path. A Service with ten happy-path tests and zero error-path tests has untested behavior in exactly the conditions where correct behavior matters most — when things go wrong.

---

## 13. Best Practices

1. **Name Services after domain capabilities, not technical layers.** `MessageDeliveryService` is better than `MessageDatabaseService`. `AccountConnectionService` is better than `FacebookManagerService`. Names express what the Service does at the domain level.

2. **Keep operation signatures stable.** Once a Service operation is in use, its signature is a contract. Changing the types or semantics of parameters is a breaking change. New requirements are addressed by adding parameters with defaults or adding new operations — not by modifying existing ones.

3. **Document every error case.** Each operation's documentation lists every error category it can produce and the conditions that trigger it. Callers need this information to handle errors correctly.

4. **Design for idempotency from the start.** An operation that can be safely called multiple times with the same inputs without additional side effects is a more reliable operation. Idempotency simplifies retry logic at the caller and makes the system resilient to network-level duplicate delivery.

5. **Prefer returning domain objects over raw data.** A Service that returns a domain object (an account record, a message record) with its invariants enforced is safer than one that returns a raw map of fields. The domain object communicates structure and constraints; a map communicates nothing.

6. **Separate read and write operations.** Operations that read state and operations that change state must not be mixed in a single Service call. A read operation that produces side effects surprises callers. A write operation that also returns a large read result is doing two things.

7. **Log at the caller, not inside the Service.** The caller has context the Service does not. When a Service returns an error, the caller logs the error with the correlation ID, the caller's operation context, and the Service's error result. The Service itself logs only internal_errors — unexpected infrastructure failures.

8. **Version Service interfaces when breaking changes are necessary.** When a breaking change to a Service interface is unavoidable, version the interface. Run the old and new versions concurrently during the migration period. Remove the old version when all callers have migrated.

---

## 14. Anti-Patterns

### 14.1 The God Service

A single Service that contains every business operation in the system. This emerges when the "one place for business logic" principle is applied without the complementary decomposition principle. The result is a Service that grows indefinitely, develops internal coupling between unrelated operations, and becomes impossible to test, reason about, or modify safely.

### 14.2 The Anemic Service

A Service whose operations are trivial delegations to a repository without any business logic. The Service adds no value — it is a pass-through wrapper. The business logic exists nowhere — it was not placed in the Service, and it was not placed in the repository either. The system makes no business decisions; it only moves data.

### 14.3 The Event-Listening Service

A Service that subscribes to system events to trigger its operations. This inverts the correct relationship: event handlers call Services; Services do not subscribe to events. A Service that listens to events is a Service that has absorbed event-handling responsibility — making it harder to call from other contexts and coupling it to the event system.

### 14.4 The Caller-Aware Service

A Service that changes its behavior based on who is calling it — applying different rules for admin callers, different validation for plugin callers, different output for API callers. The caller's identity is context that belongs in the entry point. The Service applies the same logic to all callers; access control is enforced before the Service is reached.

### 14.5 The Exception-as-Control-Flow Service

A Service that uses thrown exceptions to communicate expected failure modes (entity not found, validation failed). Exceptions break the readable flow of the code, cannot be inspected statically, and produce unclear caller contracts. Expected outcomes are return values; exceptions are for unexpected infrastructure failures.

### 14.6 The Chatty Service

A Service operation that calls ten other Services, each of which calls five more, to fulfill a single request. Deep call chains produce high latency, difficult tracing, and cascading failures. Deep chains are a signal that the Service graph was designed bottom-up rather than top-down — services were created for technical layers rather than domain capabilities.

### 14.7 The Implicit Dependency Service

A Service that accesses a database connection, a configuration object, or another Service through a global variable or a module-level import rather than through injection. This Service cannot be tested in isolation, cannot have its dependencies swapped, and creates hidden coupling that is invisible from the Service's interface.

---

## 15. Forbidden Service Practices

The following practices are categorically forbidden. Any instance found in code review must be rejected before merge.

### 15.1 Business Logic Outside of Services

Any conditional logic, transformation, workflow coordination, or rule enforcement related to domain behavior that exists in a Command handler, Plugin handler, Manager, Controller, Repository, or any other location that is not a Service is a forbidden practice. Business logic has exactly one home. The location of business logic is not a stylistic choice.

### 15.2 Services Calling Commands

A Service must never import or call a Command. Commands are entry points that call Services — not the reverse. A Service that calls a Command has inverted the dependency direction and created a circular dependency. If a Service needs to trigger behavior that is currently in a Command, that behavior must be extracted into a shared Service that both the Command and the triggering Service call.

### 15.3 Services Calling Plugin Handlers

A Service must never invoke a plugin handler directly. Plugins extend the system through the Plugin API — they do not receive direct calls from Core Services. If a Service needs to notify plugins of an outcome, it emits an event (through the event emission mechanism provided to its caller) that plugins may subscribe to.

### 15.4 Services Accessing the Facebook Layer Directly

A Service must not import or call any Facebook Layer component directly — not `FacebookTransport`, not `SessionManager`, not `MessageGateway`. Services that need to send Facebook messages or read session state do so through dedicated abstraction interfaces that hide the Facebook Layer's internals. The abstraction interfaces are the Service's dependency — not the Facebook Layer components themselves.

### 15.5 Shared Mutable State Between Services

Two Services must not share mutable state through a global variable, a module-level object, or a singleton that both import and modify. Shared mutable state between Services produces race conditions, makes Services non-testable in isolation, and creates hidden coupling that is invisible from either Service's interface.

### 15.6 Services Creating Their Own Dependencies

A Service that creates its own repository instance, its own database connection, or its own external client bypasses the dependency injection mechanism. This makes the Service non-testable (the dependency cannot be replaced), duplicates connection management (producing resource exhaustion), and hides the dependency from the system's dependency graph.

### 15.7 Skipping Validation on "Trusted" Callers

A Service that skips its input validation when called from a "trusted" entry point (an admin command, an internal scheduled task) applies inconsistent logic. The Service's validation is its own invariant — it must hold regardless of the caller. If a trusted caller needs to bypass a validation rule, the correct approach is to expose a separate operation with different validation constraints — not to skip validation conditionally.

---

## 16. AI Service Rules

This section defines how an AI system must reason about Services when developing within Void.

### 16.1 Identify the Service Before Writing the Logic

When the AI is asked to implement a feature, it must identify the Service that owns the relevant capability before writing any logic. The sequence is:
1. What capability does this feature require?
2. Does an existing Service own this capability?
3. If yes: does the logic belong in an existing operation, or does a new operation need to be added?
4. If no: a new Service is needed — specify its responsibility boundary before writing code

The AI must never write business logic in an entry point because "there is no appropriate Service yet." The correct response is to create the Service first.

### 16.2 The AI Must Not Generate Business Logic in Commands or Handlers

When generating Command handlers or event handlers, the AI must ensure they contain no business logic. The handler reads context, calls a Service, and returns the result. If the AI finds itself writing conditional logic, domain transformations, or multi-step workflows in a handler, it must stop and move that logic to a Service.

### 16.3 The AI Must Generate Typed Results

When generating Service operations, the AI must generate typed result types — both for success and for each possible error category. A Service operation that returns `any`, throws exceptions for expected failures, or returns untyped objects has an incomplete interface.

### 16.4 The AI Must Generate Tests Alongside Services

When generating a new Service or adding an operation to an existing Service, the AI must simultaneously generate the corresponding tests. Tests are not optional post-implementation work — they are part of the operation's definition. The AI must not deliver a Service operation without tests.

### 16.5 The AI Must Respect Transaction Boundaries

When generating Service operations that involve multiple writes, the AI must identify the transaction boundary and implement it correctly. Operations that write to multiple tables without a transaction, or that hold transactions open across external API calls, are implementation defects that must be caught before generation.

### 16.6 The AI Must Not Design God Services

When a feature request requires multiple distinct capabilities, the AI must assess whether those capabilities belong in the same Service or in separate Services. If the capabilities have different domain concepts, different state concerns, or different caller audiences, they belong in separate Services. The AI must not consolidate unrelated operations into a single Service for convenience.

### 16.7 The AI Must Identify Dependency Direction Violations

When a proposed Service design requires Service A to depend on Service B and Service B to depend on Service A, the AI must identify this circular dependency, refuse to implement it as designed, and propose a resolution — typically extracting the shared logic into a Service C that both A and B depend on.

### 16.8 When a New Service Is Needed

If implementing a feature requires a Service that does not yet exist, the AI must:
1. Define the new Service's name, responsibility statement, and operations
2. Document it here (or propose a new constitutional document if the Service is large enough)
3. Define its dependencies
4. Define its error categories
5. Only then generate the implementation

Service creation is an architectural decision — it must be deliberate and documented, not incidental to feature work.

### 16.9 The AI Must Not Generate Silent Failures

Any Service operation generated by the AI must account for all failure paths. An operation that swallows errors, returns null without explanation, or produces no response on failure is a silent failure. Silent failures are the hardest bugs to diagnose in production. Every path through a Service operation must produce a defined outcome.

---

## 17. Review Checklist

Use this checklist for every code review that introduces or modifies a Service.

### Business Logic Ownership
- [ ] All conditional logic, transformations, and workflow coordination are inside the Service — not in the calling Command, handler, plugin, or controller
- [ ] No business logic is duplicated in a different Service or in a non-Service location
- [ ] The Service's responsibility statement is clear and its operations are cohesive

### Service Design
- [ ] The Service's dependencies are declared through injection — not accessed globally
- [ ] The Service calls other Services through their interfaces — not concrete classes
- [ ] No circular dependencies exist between this Service and its dependencies
- [ ] State held by the Service (if any) is explicitly documented
- [ ] The Service does not call Commands, plugin handlers, or Facebook Layer components directly

### Validation
- [ ] Every operation validates its inputs before executing logic
- [ ] Structural validation and semantic validation are both present where applicable
- [ ] Validation failures return typed error results — not exceptions
- [ ] Validation is not silently skipped for any caller

### Transactions
- [ ] Multi-write operations define explicit transaction boundaries
- [ ] Transactions do not span external API calls
- [ ] Partial failure cases are handled — no operation leaves domain state partially complete
- [ ] Repository calls within a transaction receive the transaction context

### Error Handling
- [ ] Every operation documents which error categories it can return
- [ ] Expected failures return typed error results — not thrown exceptions
- [ ] Internal (unexpected) errors are logged within the Service
- [ ] Errors propagated from dependencies include calling-operation context

### Performance
- [ ] All I/O within the Service is asynchronous
- [ ] No N+1 query patterns are present
- [ ] Timeouts are defined for every external call
- [ ] Operations that could return large result sets support pagination

### Testing
- [ ] Tests exist for the happy path of every operation
- [ ] Tests exist for every documented error case
- [ ] Tests use injected fakes/mocks — no real database or network connections in unit tests
- [ ] Tests assert on typed results — not on implementation details
- [ ] Test data is explicitly constructed per test — no shared mutable fixtures

### AI-Generated Code Specific
- [ ] No business logic is present in the caller that delegated to this Service
- [ ] Typed result types are defined for both success and all error categories
- [ ] Tests were generated alongside the Service operation
- [ ] No new God Service was created — the Service has a clear, bounded responsibility

---

*This document is the official and sole reference for Service design in the Void project. Every Service — without exception — must comply with the philosophy, responsibilities, and constraints defined here. Business logic belongs in Services. Not in Commands. Not in Plugins. Not in Managers. Not in Controllers. Services are the domain. All other components serve as entry points, infrastructure, or extension mechanisms around that domain.*
