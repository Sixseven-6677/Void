# 16 — Manager Rules

> **Status:** Official  
> **Scope:** All Manager design decisions in Void — when Managers are used, what they own, what they must not do, and how they relate to Services, components, and the systems they coordinate  
> **Authority:** This document is the single source of truth for Manager design in Void. It is read in conjunction with `15-service-rules.md`. No Manager may be created, modified, or deleted without consulting this document. When in doubt about whether code belongs in a Manager or a Service, this document provides the deciding principle.

---

## Table of Contents

1. [Manager Philosophy](#1-manager-philosophy)
2. [When to Use a Manager](#2-when-to-use-a-manager)
3. [When Not to Use a Manager](#3-when-not-to-use-a-manager)
4. [The Manager vs. Service Distinction](#4-the-manager-vs-service-distinction)
5. [Manager Lifecycle Management](#5-manager-lifecycle-management)
6. [Resource Management](#6-resource-management)
7. [State Coordination](#7-state-coordination)
8. [Component Coordination](#8-component-coordination)
9. [Dependency Rules](#9-dependency-rules)
10. [Communication Patterns](#10-communication-patterns)
11. [Error Handling in Managers](#11-error-handling-in-managers)
12. [Observability](#12-observability)
13. [Testing Managers](#13-testing-managers)
14. [Best Practices](#14-best-practices)
15. [Anti-Patterns](#15-anti-patterns)
16. [Forbidden Manager Practices](#16-forbidden-manager-practices)
17. [AI Decision Rules](#17-ai-decision-rules)
18. [Review Checklist](#18-review-checklist)

---

## 1. Manager Philosophy

### 1.1 Coordination Without Decision

A Manager coordinates. It does not decide. This is the entire Manager philosophy expressed in five words — and every other rule in this document is a consequence of it.

Coordination means: sequencing operations, managing the lifecycle of components, tracking state transitions, delegating work to the right component at the right time, and ensuring that components that must work together do so in the correct order. None of these activities require business judgment. They require structural awareness — knowing what exists, what state it is in, and what must happen next according to a defined sequence.

Decision means: applying business rules, enforcing domain constraints, computing outcomes from domain inputs, determining whether an operation is valid in a given context. These activities require judgment about the domain — about what the system is *for*. This is the exclusive territory of Services.

A Manager that makes a business decision has crossed into Service territory. A Service that coordinates infrastructure lifecycles has crossed into Manager territory. Both are design errors. The boundary between them must be respected in both directions.

### 1.2 The Manager as Infrastructure

Managers are infrastructure — the hidden machinery that keeps the application's components running. Like good infrastructure everywhere, a Manager should be invisible when things are working. It is noticed only when something goes wrong. The application layer (Services, Commands, Events) operates on top of the infrastructure that Managers provide — it does not concern itself with how that infrastructure is managed.

### 1.3 One Manager, One Concern

Every Manager has exactly one coordination concern. `SessionManager` manages session state — not connections. `ConnectionController` manages connection lifecycle — not authentication. `ReconnectManager` manages reconnection — not session recovery. The single-concern rule prevents Managers from growing into coordination hubs that mix unrelated infrastructure concerns.

When a new coordination concern emerges that does not fit cleanly into any existing Manager, the answer is a new Manager — not adding the concern to the nearest existing one.

### 1.4 Managers Are Not Optional

When a system has a lifecycle, a resource pool, or a coordination requirement, a Manager must exist to own it. The alternative — spreading coordination responsibility across multiple Services, event handlers, or entry points — produces distributed, inconsistent lifecycle management. The cost of a missing Manager is paid in subtle timing bugs, resource leaks, and initialization order failures.

---

## 2. When to Use a Manager

A Manager is appropriate when the coordination concern has one or more of the following characteristics:

### 2.1 Lifecycle Ownership

When a component, resource, or subsystem has a defined lifecycle — states it must progress through in a defined order — a Manager must own that lifecycle. The Manager is the sole authority on what state the component is in and what transitions are valid.

Examples:
- A Facebook connection progresses through `connecting → connected → reconnecting → disconnected` — `ConnectionController` owns this lifecycle
- A plugin progresses through `discovered → registered → loading → active → disabled → uninstalled` — the Plugin Manager owns this lifecycle
- A session progresses through `creating → active → refreshing → expired → destroyed` — `SessionManager` owns this lifecycle

No lifecycle may have more than one owner.

### 2.2 Resource Pool Management

When the system maintains a pool of reusable resources — connections, worker threads, cache slots — a Manager must govern the pool: allocating resources, tracking which are in use, reclaiming resources after use, and enforcing pool size limits.

A resource pool managed without a dedicated Manager will leak, overflow, or exhibit allocation conflicts when multiple callers access it concurrently.

### 2.3 Multi-Component Coordination

When achieving a goal requires coordinating multiple components in a specific sequence — where the sequence itself is the concern, not the goal — a Manager is appropriate.

Example: Establishing a Facebook connection requires coordinating `AuthenticationManager`, `SessionManager`, and `FacebookTransport` in a defined order. `ConnectionController` coordinates this sequence. The business question "should we connect?" is answered by the application layer. The coordination question "in what order, with what signals, with what fallbacks?" is answered by `ConnectionController`.

### 2.4 Authoritative State Registry

When the system needs a single, authoritative source of truth about the current state of a resource — which sessions are active, which plugins are loaded, which connections are established — a Manager provides that registry.

Without a centralized registry, any component that needs to know "is there an active session for account X?" must either query the database (slow) or maintain its own copy of the information (inconsistent).

### 2.5 Cross-Component Signal Routing

When events or signals from one component must be translated and delivered to another component in a controlled way — not through the general event system, but through a direct coordination relationship — a Manager handles the routing.

Example: `ConnectionHealthMonitor` receives health signals from `HeartbeatMonitor`, `RetryController`, and `RateLimitController`, aggregates them, and signals `ConnectionController` when the threshold is breached. This aggregation and routing is coordination, not business logic.

---

## 3. When Not to Use a Manager

A Manager is the wrong choice when:

### 3.1 The Concern Is Business Logic

If the code being written makes domain decisions — "should this message be sent?", "is this account eligible for this operation?", "what retry delay is appropriate given this error type?" — it belongs in a Service, not a Manager. The presence of domain-level conditionals is the clearest signal that a Manager boundary is being crossed.

### 3.2 The Concern Is Already Owned

If an existing Manager already owns the relevant coordination concern, the code belongs in that Manager — not in a new one. Creating a second Manager for the same concern produces split ownership and conflicts.

### 3.3 The Concern Is Stateless Processing

If the coordination concern has no state — no lifecycle to manage, no resource pool to govern, no registry to maintain — it is not a coordination concern. It is a computation. Stateless processing belongs in a Service or a utility function.

### 3.4 The Concern Is Entry Point Routing

If the code is deciding which Service to call based on incoming request parameters, it is a router — a function that belongs in the entry point layer (Command, event handler, API controller). Routing decisions are not coordination.

### 3.5 A Service Already Solves It

Before creating a Manager, the question must be asked: can the concern be handled by a Service? If a Service can own the state, encapsulate the logic, and provide a clean interface to the rest of the system, a Manager adds no value. Managers exist for concerns that Services structurally cannot own — primarily because they involve coordinating multiple components rather than implementing a business capability.

---

## 4. The Manager vs. Service Distinction

This distinction is the most important conceptual boundary in the infrastructure design of Void. When code is being written and there is uncertainty about whether it belongs in a Manager or a Service, this section provides the deciding framework.

### 4.1 The Fundamental Test

| Question | Manager | Service |
|---|---|---|
| Does it enforce a business rule? | No | Yes |
| Does it make a domain decision? | No | Yes |
| Does it coordinate components? | Yes | No |
| Does it manage a lifecycle? | Yes | No |
| Does it own a resource pool? | Yes | No |
| Does it maintain an authoritative registry? | Yes | No |
| Does it implement a user-facing capability? | No | Yes |
| Can it be called from any entry point for the same result? | No — it is not called by entry points | Yes |
| Is its behavior driven by domain inputs? | No | Yes |
| Is its behavior driven by component state? | Yes | No |

### 4.2 The Vocabulary Test

Manager code talks about components, states, lifecycles, resources, and coordination sequences. If the code contains vocabulary about components (`FacebookTransport`, `SessionManager`, `HeartbeatMonitor`) and their states (`connected`, `reconnecting`, `degraded`), it is coordination — it belongs in a Manager.

Service code talks about the domain: accounts, messages, contacts, sessions (as domain concepts, not as managed resources), operations, rules, and outcomes. If the code contains domain vocabulary and applies domain rules, it belongs in a Service.

### 4.3 Concrete Examples

| Scenario | Manager or Service? | Why |
|---|---|---|
| "Transition the connection from `connected` to `reconnecting`" | **Manager** | Lifecycle state transition |
| "Determine the appropriate backoff delay for a reconnect attempt" | **Service** | Business rule — computes an outcome from domain inputs |
| "Track which plugins are currently active" | **Manager** | Authoritative registry |
| "Validate that a plugin's declared permissions are acceptable" | **Service** | Business rule enforcement |
| "Coordinate the session → auth → transport sequence on connect" | **Manager** | Multi-component coordination |
| "Determine whether the current session is valid" | **Service** | Domain decision |
| "Release the resources associated with a disabled plugin" | **Manager** | Resource management |
| "Decide whether a failed operation should be retried" | **Service** | Business rule — applies retry policy |
| "Route a health signal from HeartbeatMonitor to ConnectionController" | **Manager** | Cross-component signal routing |

### 4.4 When the Line Is Blurry

When a Manager appears to be making a decision, inspect the decision more carefully:
- If the decision is purely mechanical — "if state is X, transition to Y" with no domain context — it is structural coordination and belongs in the Manager
- If the decision requires domain context — "given this account type, this error code, and this retry count, should we re-authenticate?" — it belongs in a Service that the Manager calls

Managers may call Services for the domain judgment they need. A Manager must never implement that judgment itself.

---

## 5. Manager Lifecycle Management

### 5.1 Managers Have Their Own Lifecycle

A Manager itself has a lifecycle — it is initialized at startup, operates for the process lifetime, and is shut down cleanly at process termination. The Manager lifecycle is owned by the application initialization system — not by the Manager itself.

### 5.2 Initialization Sequence

Managers are initialized in dependency order at startup. A Manager that depends on another Manager or on infrastructure components is initialized after those dependencies. The initialization sequence is:
1. Infrastructure components (database connections, external clients)
2. Foundational Managers (configuration, credentials)
3. Dependent Managers (in dependency order)
4. Application layer (Services, event handlers, command registration)

A Manager that is called before it has been initialized must detect this condition and fail with a clear error — not operate silently in an uninitialized state.

### 5.3 Manager Initialization Must Be Synchronous in Effect

Even if initialization involves asynchronous operations, the initialization phase must complete before the Manager is available to callers. The calling initialization system awaits the Manager's initialization completion before proceeding. A Manager that declares itself initialized before actually completing initialization causes unpredictable behavior in dependent components.

### 5.4 Shutdown Sequence

Managers are shut down in reverse dependency order — dependents before dependencies. Each Manager's shutdown:
1. Stops accepting new coordination requests
2. Completes or gracefully terminates in-progress operations
3. Releases all managed resources
4. Persists state that must survive restart (if applicable)
5. Signals shutdown completion to the shutdown coordinator

A Manager that does not implement a shutdown path leaks resources on every process termination.

### 5.5 Lifecycle States Must Be Observable

The Manager's current lifecycle state must be observable — accessible to the monitoring system and to the operators. A Manager that provides no visibility into whether it has been initialized, whether it is operating normally, or whether it has encountered an error is a black box that cannot be operated.

---

## 6. Resource Management

### 6.1 Managers Own Their Resources Completely

Every resource a Manager creates — connections, timers, memory buffers, file handles, worker processes — is owned exclusively by that Manager. Ownership means:
- The Manager creates the resource
- The Manager tracks the resource for its entire lifetime
- The Manager releases the resource when it is no longer needed or when the Manager shuts down
- No other component may release a resource that the Manager owns

Shared resource ownership produces double-release bugs and use-after-free errors.

### 6.2 Resource Lifecycle Mirrors Manager Lifecycle

Resources held by a Manager are valid for at most the Manager's operational lifetime. A resource created during initialization is released during shutdown. A resource created during an operation is released when the operation completes or when the Manager shuts down — whichever comes first.

### 6.3 Resource Limits Are Enforced by the Manager

A Manager that governs a resource pool must enforce its limits. Limits include:
- Maximum pool size (number of resources that may exist simultaneously)
- Maximum idle time (a resource that has been unused for this long is released)
- Maximum lifetime (a resource that has existed for this long is recycled, even if idle time has not expired)
- Acquisition timeout (a caller that cannot acquire a resource within this period receives an error — it does not wait indefinitely)

Resource limits are not optional performance tuning — they are correctness requirements. An unbounded resource pool is a memory leak and a denial-of-service vector.

### 6.4 Resource Acquisition Is Never Silent on Failure

When a Manager cannot provide a requested resource — because the pool is exhausted, because initialization failed, because the resource was destroyed — it returns an explicit error. It does not return null, it does not return a degraded resource, and it does not wait silently until a timeout.

### 6.5 Resources Are Not Leaked on Error

Error paths that acquire resources must release them. A code path that acquires a resource and then throws an exception without releasing it is a leak. Manager code must audit every path through resource acquisition to confirm that the resource is released on every exit — success or failure.

---

## 7. State Coordination

### 7.1 State Is Centralized in the Manager

When multiple components need to know the current state of a shared resource — "is the connection active?", "is this session valid?", "is this plugin loaded?" — the Manager is the single source of truth. No component maintains its own copy of state that the Manager owns. Components query the Manager; they do not cache Manager-owned state independently.

### 7.2 State Transitions Are Atomic

A state transition managed by a Manager must be atomic from the perspective of other components. Between the start and end of a transition, no other component must be able to observe the resource in an intermediate state. In practice:
- Transitions are guarded against concurrent modification
- Components that query state during a transition see either the before state or the after state — never a partial transition

### 7.3 State Transitions Are Explicit and Defined

Every valid state transition must be explicitly defined in the Manager. Undefined transitions — states that are reached without a corresponding Manager operation — are bugs. A state machine with undefined transitions produces unrecoverable states.

The Manager must document:
- Every valid state
- Every valid transition between states
- The conditions under which each transition occurs
- The components that are notified when a transition occurs

### 7.4 State Is Not Business State

Manager state is operational state — the current condition of infrastructure and components. It is not business state. Business state (an account's status, a message's delivery state, a user's preference) belongs in the domain layer, persisted in storage, and accessed through Services.

A Manager that stores business state in memory is:
- Creating a second source of truth that conflicts with the database
- Losing business state on every process restart
- Preventing the business state from being queried without going through the Manager

### 7.5 State Visibility Without State Exposure

Components that need to observe Manager state must be able to do so without accessing the Manager's internal data structures directly. The Manager exposes read-only views — query methods that return a snapshot of the relevant state — not references to its internal state objects.

---

## 8. Component Coordination

### 8.1 Coordination Is Sequential Guidance

A Manager coordinates by issuing instructions to components in a defined sequence and observing their responses. It does not perform the work itself — it delegates to the components that own the relevant capabilities. The Manager's intelligence is in the sequence and the response handling, not in the work.

### 8.2 The Manager Does Not Bypass Component Interfaces

When coordinating components, the Manager calls each component through its public interface — not by accessing internal state or calling private methods. A Manager that reaches into a component's internals creates coupling that makes both the Manager and the component harder to change.

### 8.3 The Manager Responds to, Not Controls, Component Failures

When a component fails during a coordination sequence, the Manager handles the failure at the coordination level — deciding whether to retry, fall back, abort, or transition to a failure state. It does not try to fix the component's internal failure. Fixing component failures is the component's own responsibility.

### 8.4 Coordination Sequences Are Documented

Every coordination sequence managed by a Manager must be explicitly documented — the steps, the expected responses, the failure handling at each step, and the final state outcome for each possible result. Undocumented sequences are undocumented behavior.

### 8.5 Coordination Does Not Produce Business Results

A Manager coordination sequence produces operational outcomes — "connection is established", "session is loaded", "plugin is active" — not business results — "message was sent", "account was updated", "contact was added". Business results are produced by Services. Operational outcomes are produced by Managers.

---

## 9. Dependency Rules

### 9.1 Managers Depend on Components and Services

A Manager may depend on:
- The components it coordinates (e.g., `ConnectionController` depends on `FacebookTransport`)
- Services it needs for domain judgment (e.g., a Manager that needs to know "is this session valid?" calls `SessionValidationService`)
- Infrastructure adapters (databases, external clients) for state persistence

### 9.2 Managers Must Not Depend on Commands

A Manager must never import or call a Command handler. Commands are entry points — they call Managers (indirectly through Services) — not the other way around. A Manager that calls a Command has inverted the dependency chain.

### 9.3 Managers Must Not Depend on Plugins

A Manager must never directly invoke plugin code. If a Manager needs to notify plugins of a state change, it does so by emitting an event through the `EventDispatcher` — not by calling plugin handlers directly.

### 9.4 Cross-Manager Dependencies Are Permitted but Must Be Acyclic

Managers may depend on other Managers — `ReconnectManager` coordinates with `SessionManager` and `AuthenticationManager`. These cross-Manager dependencies must form a directed acyclic graph. Circular Manager dependencies produce initialization deadlocks and are forbidden.

Per `10-facebook-architecture.md`, the permitted cross-Manager relationships within the Facebook Layer are explicitly defined. No new cross-Manager relationship may be introduced without documenting it in the relevant architectural document.

### 9.5 Managers Do Not Depend on Each Other for Business Logic

When Manager A calls Manager B, it is for coordination — not to obtain a business judgment. If Manager A needs a business judgment, it calls a Service — not Manager B.

---

## 10. Communication Patterns

### 10.1 Managers Signal Through Events or Direct Calls

Managers communicate state changes to the rest of the system through two mechanisms:
- **Direct calls:** When the coordination relationship is 1:1 and explicitly defined (e.g., `ConnectionController` calling `ReconnectManager` when a reconnect is needed)
- **Event emission:** When the state change is relevant to multiple components and the Manager must not know who they are

A Manager that builds a subscriber list and notifies subscribers directly is reimplementing the event system inside itself. That is the `EventDispatcher`'s responsibility.

### 10.2 Managers Do Not Subscribe to Events

Per `15-service-rules.md` and `14-event-system.md`, event subscription is handled by event handlers — thin components that receive events and call Services or trigger Managers. A Manager that subscribes to events has absorbed event-handling responsibility.

The correct pattern: an event handler receives an event and calls the appropriate Manager method. The Manager method performs the coordination. The Manager does not see the event.

### 10.3 Manager API Is Intentional

The methods that a Manager exposes constitute its API. Every exposed method represents a coordination capability that the Manager provides to authorized callers. Methods that are not part of the Manager's intended coordination role must not be exposed. The Manager's API is not "all the things this Manager happens to be able to do" — it is "the coordination operations this Manager is responsible for."

### 10.4 Callers Cannot Observe Manager Internal Sequences

The internal coordination sequence executed by a Manager is an implementation detail. Callers call a Manager method and receive an outcome — they do not observe intermediate steps, receive progress notifications for internal steps, or have any visibility into the internal sequence. If progress visibility is needed, it is provided through a status query method — not through exposing internal steps.

---

## 11. Error Handling in Managers

### 11.1 Manager Errors Are Operational Errors

Errors from Managers are operational — they describe what went wrong with infrastructure and coordination, not what went wrong with a business operation. A Manager error communicates: "the coordination could not complete" — not "the business rule was violated".

### 11.2 Error Classification

| Error Type | Description | Response |
|---|---|---|
| `initialization_failed` | The Manager or a component failed to initialize | Startup failure — process does not become operational |
| `coordination_failed` | A coordination sequence could not complete | Transition to failure state; notify caller; notify monitoring |
| `component_unavailable` | A component required for coordination is not available | Retry or fail coordination; notify monitoring |
| `resource_exhausted` | The Manager cannot provide a requested resource | Return explicit resource-exhausted error to caller |
| `invalid_state_transition` | A coordination request was made in an incompatible state | Return state-conflict error; do not transition |
| `shutdown_in_progress` | A coordination request arrived during shutdown | Reject request; return unavailable error |

### 11.3 Managers Do Not Silently Degrade

A Manager that cannot fully coordinate its responsibility must fail explicitly and immediately — not return a degraded result that appears successful. Silent degradation produces inconsistent system behavior that is far harder to diagnose than an explicit failure.

### 11.4 Coordination Failures Are Logged with Full Context

When a Manager coordination sequence fails, the failure log must include:
- Which coordination operation was being attempted
- Which component failed
- The state of all relevant components at the time of failure
- The error received from the failing component
- The correlation ID linking this failure to the originating request

---

## 12. Observability

### 12.1 Managers Must Expose Their State

Every Manager must expose its current operational state through the monitoring system. At minimum:
- Current lifecycle state (initialized, operational, degraded, shutting down)
- For resource pools: current pool size, available resources, peak usage
- For lifecycle Managers: current state of each managed entity (with count aggregates)
- Error counts per error category, over a rolling time window

### 12.2 State Must Be Queryable Without Affecting It

The act of querying a Manager's state must not change that state. State exposure methods are purely observational — they have no side effects. A health check that triggers state changes is a health check that cannot be safely run.

### 12.3 Transitions Are Emitted as Audit Events

Every state transition managed by a Manager must produce a structured log entry — at minimum at `info` level — recording the entity, the from-state, the to-state, the triggering event, and the timestamp. These log entries form the operational history of the Manager's activity and are essential for incident investigation.

---

## 13. Testing Managers

### 13.1 Managers Are Tested for Coordination Correctness

Manager tests verify that the coordination sequence is correct — that the right components are called in the right order, that state transitions occur at the right points, and that the correct error handling applies when components fail.

Manager tests do not verify business logic — that verification belongs in Service tests.

### 13.2 Components Are Replaced with Controllable Fakes

In Manager tests, all real component dependencies are replaced with fakes that can be instructed to succeed, fail, or behave in specific ways. Tests exercise the Manager's coordination logic by controlling what its components report.

### 13.3 State Machine Coverage

Manager tests must cover every valid state transition — including failure transitions. A Manager with a five-state lifecycle has at least five times as many transitions as states. Each transition must have a test that confirms:
- The transition occurs under the correct conditions
- The Manager reaches the correct post-transition state
- The correct notifications are emitted

### 13.4 Concurrency Cases Are Tested

Managers that coordinate concurrent operations must have tests for concurrent access — two operations arriving simultaneously, a shutdown signal arriving during a coordination sequence, a component failing while another operation is in progress.

---

## 14. Best Practices

1. **Name Managers for what they coordinate, not for what they contain.** `ConnectionController` is better than `FacebookManager`. `PluginLifecycleManager` is better than `PluginManager`. The name must communicate the coordination concern.

2. **Prefer direct-call coordination over event-based coordination within a Manager.** When a Manager must sequence components, direct calls are clearer and more reliable than chaining through events. Events are appropriate for broadcasting — not for sequencing.

3. **Keep state transitions as small as possible.** A state transition should change exactly one state variable to exactly one value. Complex, multi-variable state transitions are harder to reason about, harder to test, and more prone to producing inconsistent intermediate states.

4. **Make the coordination sequence visible in the code structure.** The sequence of steps in a coordination method should be readable as a sequence — step 1, step 2, step 3 — without requiring readers to follow function calls across multiple files to understand the sequence.

5. **Treat component failures as first-class outcomes.** Every component call in a coordination sequence must have an explicit failure handler. "It will not fail" is not a failure handler.

6. **Document the state machine.** The valid states and transitions must be documented in the Manager — not just in this constitution. A reader of the Manager code must be able to understand the state machine without consulting external documents.

7. **Never store business state in a Manager.** If a piece of state must survive a restart or be queried by multiple Services, it belongs in the database. If it is queried frequently enough to justify caching, cache it in a Service — not in a Manager.

---

## 15. Anti-Patterns

### 15.1 The Business Logic Manager

A Manager whose coordination methods contain domain conditionals, apply business rules, or compute domain outcomes. The Manager has absorbed Service responsibilities. The symptom: the Manager's code contains vocabulary from both the infrastructure domain ("component", "state", "lifecycle") and the business domain ("account", "eligibility", "policy"). These vocabularies must not coexist in a Manager.

### 15.2 The Singleton Everything Manager

A single Manager that coordinates all infrastructure concerns — connections, sessions, plugins, resources, health — because "there is only one of everything." This pattern produces a Manager with no coherent boundary that grows indefinitely and becomes impossible to test or reason about. Each coordination concern gets its own Manager.

### 15.3 The State-Skipping Manager

A Manager that allows state transitions to skip intermediate states for "efficiency." A plugin that jumps from `registered` to `active` without passing through `loading` and `loaded` has bypassed the setup that those states represent. Skipped states produce components that appear to be ready but have not completed their initialization.

### 15.4 The Passive Manager

A Manager that exposes its resource pool or state registry directly — as a shared mutable data structure that callers read and write directly — rather than through controlled access methods. This is not management — it is a global variable with a class name. True management means the Manager controls all access to the resources it owns.

### 15.5 The Callback-Accumulating Manager

A Manager that allows components to register callbacks to be called when specific state transitions occur, accumulating an unbounded list of callbacks over time. This pattern leaks memory, makes state transitions non-deterministic in their effects, and reproduces the event system inside the Manager. State change notifications must go through the `EventDispatcher`.

### 15.6 The Synchronous Blocker

A Manager that performs synchronous, blocking coordination operations — waiting for a component to complete a long operation before returning to the caller. The Manager blocks its calling thread for the duration. In an async runtime, synchronous blocking propagates to all callers waiting for the Manager's response. All Manager coordination operations are asynchronous.

---

## 16. Forbidden Manager Practices

### 16.1 Implementing Business Logic

A Manager must not contain conditionals, transformations, or computations that represent business rules. Any business rule found in a Manager must be extracted to a Service that the Manager calls for the domain judgment it needs.

### 16.2 Owning More Than One Coordination Concern

A Manager that owns multiple unrelated coordination concerns — sessions and connections, plugins and health monitoring, resources and event routing — is a violation of the single-concern rule. Each concern requires its own Manager with its own name, tests, and documentation.

### 16.3 Creating a Second Manager for an Owned Concern

Creating a second Manager for a coordination concern that is already owned by an existing Manager produces split ownership. All coordination for a given concern must pass through one Manager.

### 16.4 Exposing Internal State Directly

A Manager's internal data structures — its resource pool list, its state registry, its component references — must not be returned directly to callers. Callers receive read-only views (snapshots, status summaries) — not references to the live internal state.

### 16.5 Depending on Entry Points

A Manager must not import or call Commands, API controllers, or plugin handlers. Managers are below entry points in the dependency hierarchy. Any dependency pointing from a Manager upward to an entry point is an architectural inversion.

### 16.6 Performing Authentication or Business Operations

A Manager must not authenticate against Facebook, evaluate user permissions, compute message content, or perform any operation that constitutes fulfilling a user-facing capability. These are Service responsibilities. A Manager that performs them has absorbed Service territory.

### 16.7 Mutating State from Outside the Manager

No component outside the Manager may modify the state that the Manager owns. State is read through the Manager's query interface and modified only through the Manager's coordination methods. External mutation of Manager-owned state destroys the single-source-of-truth invariant.

---

## 17. AI Decision Rules

This section defines how an AI system must reason about Managers when developing within Void.

### 17.1 Apply the Vocabulary Test First

When the AI is writing code and is uncertain whether it belongs in a Manager or a Service, it must apply the vocabulary test (Section 4.2). If the code's vocabulary is infrastructure and components, it belongs in a Manager. If the code's vocabulary is domain and business rules, it belongs in a Service.

### 17.2 The AI Must Not Put Business Logic in Managers

When generating Manager code, the AI must inspect every conditional and computation for domain intent. If a conditional in a Manager reads "if the account type is premium, then..." or "if the retry count exceeds the policy maximum..." — these are business rules. The AI must extract them to a Service and have the Manager call the Service for the judgment it needs.

### 17.3 The AI Must Not Create a New Manager for an Existing Concern

Before proposing a new Manager, the AI must verify that no existing Manager already owns the proposed concern. If the concern is already owned, the code belongs in the existing Manager — or in a Service if it is business logic.

### 17.4 New Managers Require Documentation First

When the AI determines that a new Manager is genuinely needed, it must:
1. State the Manager's name
2. State its single coordination concern
3. Define its lifecycle states and transitions
4. Define its dependencies
5. Propose its addition to this document or the relevant architectural document
6. Wait for approval before generating the implementation

A Manager instantiated in code without a documented coordination concern is an undocumented architectural decision.

### 17.5 The AI Must Enforce Acyclic Dependencies

When generating code that introduces a dependency between two Managers, the AI must verify that the dependency does not create a cycle. If a cycle would be created, the AI must refuse and propose an alternative design — typically extracting the shared concern into a third component that both Managers can depend on.

### 17.6 The AI Must Not Generate Passive Managers

When generating a Manager, the AI must ensure the Manager controls all access to its owned resources. The AI must not generate a Manager that exposes its internal data structures as public properties for external mutation. Every resource access is through a controlled method.

### 17.7 Coordination Failures Must Have Explicit Handlers

When generating a Manager coordination sequence, the AI must generate explicit failure handlers for every component call. A coordination sequence with unhandled component failures is incomplete and must not be delivered. The AI must not defer error handling to "be added later."

### 17.8 When the Boundary Is Unclear

When the AI encounters a genuine ambiguity about whether code belongs in a Manager or a Service, it must:
1. Apply the test table from Section 4.1
2. Apply the vocabulary test from Section 4.2
3. If still ambiguous: state the ambiguity explicitly and propose both the Manager version and the Service version
4. Request explicit guidance before implementing

The AI must not resolve ambiguity by guessing and proceeding. Incorrectly placed logic — business logic in a Manager, coordination logic in a Service — creates architectural debt that compounds.

---

## 18. Review Checklist

Use this checklist for every code review that introduces or modifies a Manager.

### Responsibility Boundary
- [ ] The Manager owns exactly one coordination concern
- [ ] No business logic is present — no domain conditionals, domain transformations, or domain rule enforcement
- [ ] No second Manager was created for a concern already owned by an existing Manager
- [ ] The Manager's name accurately describes its single coordination concern

### State Management
- [ ] Every valid state is defined
- [ ] Every valid state transition is defined and explicitly coded
- [ ] No state transitions skip intermediate states
- [ ] State is exposed only through read-only query methods — not as direct references
- [ ] State transitions are atomic — no observable intermediate states
- [ ] Business state is not stored in the Manager

### Resource Management
- [ ] All resources are owned and tracked by the Manager
- [ ] Resource limits are defined and enforced
- [ ] Resources are released on every exit path — success and failure
- [ ] No resource is released by any component other than the Manager that owns it

### Lifecycle
- [ ] The Manager has an explicit initialization sequence
- [ ] The Manager has an explicit shutdown sequence
- [ ] The Manager detects and fails if called before initialization
- [ ] All managed components are shut down during the Manager shutdown

### Dependencies
- [ ] Dependencies are injected — not globally accessed
- [ ] No dependency on Commands, API controllers, or plugin handlers
- [ ] No circular dependencies with other Managers
- [ ] Cross-Manager dependencies are documented in the relevant architectural document

### Communication
- [ ] Components are called through their public interfaces — not internal state
- [ ] State change notifications go through the EventDispatcher — not a private callback list
- [ ] The Manager does not subscribe to events
- [ ] The Manager API exposes only intentional coordination operations

### Error Handling
- [ ] Every component call has an explicit failure handler
- [ ] No silent degradation — failures are explicit and immediately surfaced
- [ ] Failure logs include full coordination context and correlation ID
- [ ] State transitions handle failure cases, not only success cases

### Observability
- [ ] Manager lifecycle state is exposed to the monitoring system
- [ ] State transitions produce structured log entries
- [ ] Resource pool metrics are exposed (if applicable)
- [ ] Error counts are tracked and observable

### Testing
- [ ] Tests verify coordination sequence correctness
- [ ] Tests cover every state transition — including failure transitions
- [ ] Components are replaced with controllable fakes in tests
- [ ] Concurrency cases are tested

---

*This document is the official and sole reference for Manager design in Void. Managers coordinate — they do not decide. Business logic belongs in Services. Coordination of infrastructure and component lifecycles belongs in Managers. These boundaries must be respected in every new Manager created, every line of existing Manager code modified, and every architectural decision involving Manager responsibilities.*
