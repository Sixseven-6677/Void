# 10 — Facebook Layer Architecture

> **Status:** Official  
> **Scope:** All Facebook-related design decisions in Void — connection management, authentication, session handling, messaging, event dispatching, and reconnection  
> **Authority:** This document is the single source of truth for the design and structure of the Facebook Layer. No Facebook-related code may be written, modified, or deleted without consulting this document. Changes to the Facebook Layer architecture require updating this document first.

---

## Table of Contents

1. [Facebook Layer Overview](#1-facebook-layer-overview)
2. [Design Philosophy](#2-design-philosophy)
3. [Architecture Goals](#3-architecture-goals)
4. [Layer Responsibilities](#4-layer-responsibilities)
5. [High-Level Component Diagram](#5-high-level-component-diagram)
6. [Internal Component Relationships](#6-internal-component-relationships)
7. [Component Specifications](#7-component-specifications)
   - 7.1 [FacebookTransport](#71-facebooktransport)
   - 7.2 [ConnectionController](#72-connectioncontroller)
   - 7.3 [SessionManager](#73-sessionmanager)
   - 7.4 [AuthenticationManager](#74-authenticationmanager)
   - 7.5 [ReconnectManager](#75-reconnectmanager)
   - 7.6 [EventDispatcher](#76-eventdispatcher)
   - 7.7 [MessageGateway](#77-messagegateway)
   - 7.8 [PresenceManager](#78-presencemanager)
   - 7.9 [AttachmentManager](#79-attachmentmanager)
   - 7.10 [RequestQueue](#710-requestqueue)
   - 7.11 [RetryController](#711-retrycontroller)
   - 7.12 [RateLimitController](#712-ratelimitcontroller)
   - 7.13 [HeartbeatMonitor](#713-heartbeatmonitor)
   - 7.14 [ConnectionHealthMonitor](#714-connectionhealthmonitor)
   - 7.15 [FacebookConfigurationProvider](#715-facebookconfigurationprovider)
8. [Connection Lifecycle](#8-connection-lifecycle)
9. [Authentication Lifecycle](#9-authentication-lifecycle)
10. [Session Lifecycle](#10-session-lifecycle)
11. [Message Lifecycle](#11-message-lifecycle)
12. [Event Lifecycle](#12-event-lifecycle)
13. [Reconnect Lifecycle](#13-reconnect-lifecycle)
14. [Shutdown Lifecycle](#14-shutdown-lifecycle)
15. [Error Recovery Lifecycle](#15-error-recovery-lifecycle)
16. [Component Communication](#16-component-communication)
17. [Dependency Rules](#17-dependency-rules)
18. [State Management](#18-state-management)
19. [Resource Management](#19-resource-management)
20. [Thread Safety](#20-thread-safety)
21. [Scalability Strategy](#21-scalability-strategy)
22. [Stability Strategy](#22-stability-strategy)
23. [Replaceability Strategy](#23-replaceability-strategy)
24. [Failure Recovery Strategy](#24-failure-recovery-strategy)
25. [Monitoring Strategy](#25-monitoring-strategy)
26. [Extension Strategy](#26-extension-strategy)
27. [Architectural Constraints](#27-architectural-constraints)
28. [Forbidden Facebook Architecture Practices](#28-forbidden-facebook-architecture-practices)
29. [Common Mistakes](#29-common-mistakes)
30. [Anti-Patterns](#30-anti-patterns)
31. [AI Architecture Rules](#31-ai-architecture-rules)
32. [Review Checklist](#32-review-checklist)

---

## 1. Facebook Layer Overview

The Facebook Layer is a self-contained, isolated subsystem within Void responsible for all interactions with the Facebook platform. It is the exclusive intermediary between the rest of the Void system and any Facebook-specific technology, protocol, or library.

No other layer in Void communicates with Facebook directly. No other layer instantiates, calls, configures, or imports any Facebook-specific library or client. The Facebook Layer is the single point of contact — a fully encapsulated boundary that can be understood, tested, monitored, replaced, and evolved independently of the rest of the system.

The Facebook Layer manages:
- The long-lived Facebook connection and its underlying transport
- Authentication and credential management for Facebook identities
- Session lifecycle — from creation through persistence through expiry and recovery
- All outbound Facebook messages
- All inbound Facebook events
- Reconnection logic when the connection is interrupted
- Rate limiting, request queuing, retry logic, and heartbeat monitoring

The Facebook Layer exposes a clean, Facebook-agnostic interface to the Application Layer above it. The Application Layer describes *what* it wants to do (send a message, receive an event, check presence) — the Facebook Layer determines *how* that is accomplished using whatever Facebook technology is beneath it.

---

## 2. Design Philosophy

### 2.1 Single Responsibility at Every Level

The Facebook Layer is not a monolith. It is composed of distinct components, each responsible for exactly one concern. A component that handles session management must not also handle reconnection. A component that dispatches events must not also manage authentication. Responsibility isolation is the foundation of this design — it makes each component independently testable, replaceable, and comprehensible.

### 2.2 The Facebook Layer Is a Black Box to the Outside

From the perspective of every layer above it, the Facebook Layer is opaque. The Application Layer does not know:
- Which Facebook library is in use
- How the connection is maintained
- How sessions are stored
- How reconnection is managed
- What protocol is used to communicate with Facebook

This opacity is intentional and must be preserved. It is what makes the Facebook Layer replaceable — a fundamental requirement given that Facebook's technical requirements, APIs, and session management approaches change over time.

### 2.3 Stability Through Isolation

The greatest risk to a long-lived Facebook connection is state contamination — different parts of the system independently managing or mutating connection-related state, creating conflicts and race conditions. The Facebook Layer solves this by centralizing all stateful Facebook operations into dedicated components with strict ownership rules. No piece of Facebook state is managed in two places.

### 2.4 Design for Failure

Facebook connections are inherently unstable over long periods. Network interruptions, token expirations, platform-side session invalidations, and API changes are expected events — not exceptional ones. The Facebook Layer is designed with the assumption that every component will eventually encounter a failure. Every lifecycle, every component, and every communication pattern accounts for failure as a first-class outcome.

### 2.5 Library Independence

The Facebook Layer's design is intentionally decoupled from any specific Facebook library or SDK. The architectural concepts — transport, session, authentication, reconnection, events — are universal. The specific library used beneath these concepts is an implementation detail. Replacing the library must require changes only within the Facebook Layer, not in any other part of the system.

---

## 3. Architecture Goals

The Facebook Layer is designed to achieve the following goals, in order of priority:

### 3.1 Connection Stability Over Months

The primary goal of the Facebook Layer is to maintain a stable, usable Facebook connection for months without operator intervention. Every design decision — reconnection logic, session persistence, heartbeat monitoring, error recovery — serves this goal.

### 3.2 Architectural Clarity

Every engineer working on Void must be able to identify, from this document alone, which component is responsible for any Facebook-related concern. There must be no ambiguity about where reconnection logic lives, where sessions are created, or where events enter the rest of the system.

### 3.3 Replaceability

The Facebook Layer must be replaceable — both in parts (individual components) and as a whole (the underlying library) — without requiring changes to any other layer. This is not just a nice-to-have property. It is a survival requirement for a system that must adapt to platform changes.

### 3.4 Observability

The Facebook Layer must make its internal state and behavior visible to the monitoring system. Connection health, session status, reconnection attempts, queue depth, rate limit state, and heartbeat status must all be observable without accessing the internals of the components.

### 3.5 Predictability

The Facebook Layer must behave the same way every time a given lifecycle occurs — connection, authentication, session creation, reconnection, shutdown. Inconsistent behavior under similar conditions is a design defect.

---

## 4. Layer Responsibilities

The Facebook Layer owns — exclusively and completely — the following responsibilities:

| Responsibility | Owner Component |
|---|---|
| Managing the raw transport connection to Facebook | FacebookTransport |
| Orchestrating connection establishment and teardown | ConnectionController |
| Creating, persisting, and recovering Facebook sessions | SessionManager |
| Authenticating against Facebook and managing credentials | AuthenticationManager |
| Managing reconnection when the connection is lost | ReconnectManager |
| Routing inbound Facebook events to the rest of the system | EventDispatcher |
| Sending all outbound Facebook messages | MessageGateway |
| Managing contact presence and online status | PresenceManager |
| Handling attachment uploads and downloads | AttachmentManager |
| Queuing and sequencing outbound requests | RequestQueue |
| Determining retry eligibility and executing retries | RetryController |
| Enforcing Facebook rate limits | RateLimitController |
| Sending keepalive signals and detecting silence | HeartbeatMonitor |
| Evaluating overall connection health | ConnectionHealthMonitor |
| Providing all Facebook-specific configuration | FacebookConfigurationProvider |

The Facebook Layer does **not** own:
- Business logic for how received messages are processed
- Persistence of user data beyond Facebook session state
- User-facing notification or display logic
- Scheduling of Facebook operations (this belongs to the Scheduler Layer)
- Authorization of Void users to perform Facebook actions (this belongs to the Authorization Layer)

---

## 5. High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                               │
│         (Commands, Use Cases, Schedulers, Domain Services)              │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ Facebook Layer Public Interface
                             │ (send message, get session, subscribe to events)
┌────────────────────────────▼────────────────────────────────────────────┐
│                         FACEBOOK LAYER                                  │
│                                                                         │
│  ┌─────────────────────┐   ┌──────────────────────┐                    │
│  │  ConnectionController│   │  AuthenticationManager│                   │
│  └──────────┬──────────┘   └──────────┬───────────┘                   │
│             │                         │                                  │
│  ┌──────────▼──────────┐   ┌──────────▼───────────┐                   │
│  │  FacebookTransport  │   │    SessionManager     │                   │
│  └──────────┬──────────┘   └──────────┬───────────┘                   │
│             │                         │                                  │
│  ┌──────────▼──────────┐   ┌──────────▼───────────┐                   │
│  │   HeartbeatMonitor  │   │   ReconnectManager    │                   │
│  └──────────┬──────────┘   └──────────┬───────────┘                   │
│             │                         │                                  │
│  ┌──────────▼─────────────────────────▼───────────┐                   │
│  │            ConnectionHealthMonitor              │                   │
│  └──────────────────────────────────────────────────┘                  │
│                                                                         │
│  ┌──────────────────────┐   ┌──────────────────────┐                  │
│  │    EventDispatcher   │   │    MessageGateway     │                  │
│  └──────────────────────┘   └──────────┬───────────┘                  │
│                                         │                               │
│                              ┌──────────▼───────────┐                  │
│                              │     RequestQueue      │                  │
│                              └──────────┬───────────┘                  │
│                                         │                               │
│                   ┌─────────────────────▼────────────────────┐         │
│                   │  RetryController │ RateLimitController    │         │
│                   └────────────────────────────────────────────┘         │
│                                                                         │
│  ┌──────────────────────┐   ┌──────────────────────┐                  │
│  │   PresenceManager    │   │  AttachmentManager    │                  │
│  └──────────────────────┘   └──────────────────────┘                  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │               FacebookConfigurationProvider                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                             │ Raw Connection
┌────────────────────────────▼────────────────────────────────────────────┐
│                       FACEBOOK PLATFORM                                 │
│               (Facebook Servers, Graph API, Realtime API)               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Internal Component Relationships

Component relationships within the Facebook Layer follow strict directional rules. These are not suggestions — they are architectural laws.

### 6.1 Ownership Hierarchy

```
FacebookConfigurationProvider  ←  (read by all components at initialization)

ConnectionController
  └── owns lifecycle of → FacebookTransport
  └── delegates reconnect to → ReconnectManager
  └── delegates auth to → AuthenticationManager
  └── reports health to → ConnectionHealthMonitor

SessionManager
  └── reads config from → FacebookConfigurationProvider
  └── notifies → ConnectionController (session ready / session expired)

AuthenticationManager
  └── reads credentials from → SessionManager
  └── reports result to → ConnectionController

ReconnectManager
  └── coordinates with → SessionManager (recover session)
  └── coordinates with → AuthenticationManager (re-authenticate)
  └── operates through → ConnectionController (establish new connection)

EventDispatcher
  └── receives raw events from → FacebookTransport
  └── publishes typed events to → Application Layer

MessageGateway
  └── receives send requests from → Application Layer
  └── routes through → RequestQueue

RequestQueue
  └── consults → RateLimitController (before dequeuing)
  └── routes failed items to → RetryController

RetryController
  └── returns retryable items to → RequestQueue
  └── reports exhausted items to → MessageGateway

HeartbeatMonitor
  └── operates through → FacebookTransport (send keepalive)
  └── reports silence to → ConnectionHealthMonitor

ConnectionHealthMonitor
  └── aggregates signals from → HeartbeatMonitor, ConnectionController, RetryController
  └── triggers → ReconnectManager (when health threshold is breached)

PresenceManager
  └── receives presence events from → EventDispatcher
  └── sends presence updates through → MessageGateway

AttachmentManager
  └── sends attachment requests through → MessageGateway
```

### 6.2 Forbidden Direct Relationships

The following component-to-component connections are forbidden regardless of perceived convenience:

- `SessionManager` must not call `ReconnectManager` directly (reconnect is orchestrated by `ConnectionController`)
- `EventDispatcher` must not call `MessageGateway` (events flow up, messages flow down — these directions must not mix)
- `RetryController` must not call `FacebookTransport` directly (all outbound operations route through `RequestQueue`)
- `PresenceManager` must not call `FacebookTransport` directly
- `AttachmentManager` must not call `FacebookTransport` directly
- `HeartbeatMonitor` must not call `ConnectionController` (it reports health signals — it does not initiate reconnects)
- Any component must not call `FacebookConfigurationProvider` after initialization — configuration is read once at startup, not on every operation

---

## 7. Component Specifications

### 7.1 FacebookTransport

**Single Responsibility:** Manage the raw, low-level connection to the Facebook platform — opening it, keeping it alive at the transport level, and closing it.

**What FacebookTransport Owns:**
- The underlying socket or persistent connection object
- The raw byte stream or frame parser at the transport level
- Transport-level connection state (connected, connecting, disconnected)
- Transport-level error detection (socket errors, stream errors)

**What FacebookTransport Must Not Do:**
- Make decisions about reconnection — it reports disconnection; `ReconnectManager` decides what to do
- Manage authentication — it carries authenticated traffic; it does not produce or validate credentials
- Interpret the content of events — it receives raw data frames; `EventDispatcher` interprets them
- Manage sessions — it is stateless with respect to session identity
- Implement retry logic — it attempts what it is asked once; `RetryController` decides on retries

**Permitted Collaborators:**
- `ConnectionController` — receives lifecycle instructions (connect, disconnect) and reports state changes
- `HeartbeatMonitor` — receives requests to send keepalive frames
- `EventDispatcher` — delivers raw inbound data for interpretation

**Forbidden Collaborators:**
- `SessionManager`, `AuthenticationManager`, `ReconnectManager`, `MessageGateway`, `RequestQueue`, `RetryController`, `RateLimitController` — `FacebookTransport` must not depend on any of these

**Transport-Level vs. Application-Level State:**
`FacebookTransport` is concerned only with whether bytes can flow. Whether those bytes represent a valid, authenticated, usable Facebook session is not its concern. A transport can be connected while the session is expired — these are distinct states managed by distinct components.

---

### 7.2 ConnectionController

**Single Responsibility:** Orchestrate the complete lifecycle of a Facebook connection — from the initial decision to connect through to graceful shutdown.

**What ConnectionController Owns:**
- The overall connection state machine: `idle → connecting → connected → degraded → disconnecting → disconnected`
- The sequence of steps required to establish a new connection (coordinate auth → establish transport → validate session → signal ready)
- The decision of when to initiate reconnection (delegating execution to `ReconnectManager`)
- The coordination between transport-level state and session-level state

**What ConnectionController Must Not Do:**
- Implement the reconnection backoff logic — it delegates to `ReconnectManager`
- Manage session persistence or recovery — it delegates to `SessionManager`
- Perform authentication operations — it delegates to `AuthenticationManager`
- Send or receive Facebook messages — that is `MessageGateway`'s and `EventDispatcher`'s domain

**Permitted Collaborators:**
- `FacebookTransport` — instructs it to connect, disconnect; receives state change notifications
- `SessionManager` — asks whether a session is available; receives session-ready and session-expired signals
- `AuthenticationManager` — triggers authentication when no valid session exists
- `ReconnectManager` — delegates reconnection execution
- `ConnectionHealthMonitor` — receives health assessments

**Forbidden Collaborators:**
- `EventDispatcher`, `MessageGateway`, `RequestQueue`, `RetryController`, `RateLimitController`, `PresenceManager`, `AttachmentManager`

**State Machine:**
`ConnectionController` is the authoritative source of the connection's lifecycle state. No other component may modify this state. Other components may observe it (via event subscription) or query it (via a read-only interface) — they may never write to it.

---

### 7.3 SessionManager

**Single Responsibility:** Own the complete lifecycle of Facebook session state — creation, persistence, retrieval, validation, recovery, and expiry.

**What SessionManager Owns:**
- The in-memory representation of active Facebook sessions
- The persistence and retrieval of encrypted session state (AppState) to/from the storage layer
- Session validity assessment — whether a given session is currently usable
- Session metadata — owner (Void user ID), creation time, last-used time, associated Facebook identity, token expiry
- The process of recovering a session from persisted state after a restart or cache eviction

**What SessionManager Must Not Do:**
- Initiate a new authentication to create a session — it receives the result of authentication from `AuthenticationManager` and stores it
- Trigger reconnection — it reports session expiry; `ConnectionHealthMonitor` and `ConnectionController` decide what to do
- Send any message to Facebook — all outbound operations go through `MessageGateway`
- Expose unencrypted session state outside the Facebook Layer boundary

**Permitted Collaborators:**
- `AuthenticationManager` — receives new session state after successful authentication
- `ConnectionController` — receives queries about session availability; emits session-ready and session-expired events
- `FacebookConfigurationProvider` — reads session configuration (TTL, encryption parameters)
- Storage Layer — persists and retrieves encrypted session state (the storage layer is infrastructure, not a Facebook Layer component)

**Forbidden Collaborators:**
- `ReconnectManager`, `EventDispatcher`, `MessageGateway`, `FacebookTransport`, `RequestQueue`, `RetryController`

**Session Isolation:**
Each session belongs to exactly one Void user account and one Facebook identity. `SessionManager` enforces this isolation — it must never return one user's session to a request made in the context of another user. Sessions are never shared.

**Session as Source of Truth:**
`SessionManager` is the single source of truth for all session state. No other component maintains a copy of session data. Any component that needs to know the current session state must query `SessionManager` — not maintain its own cached reference.

---

### 7.4 AuthenticationManager

**Single Responsibility:** Perform all operations required to establish a verified Facebook identity and produce a valid session state.

**What AuthenticationManager Owns:**
- The authentication flow — the sequence of steps required to authenticate against Facebook
- Credential validation — verifying that provided credentials are accepted by Facebook
- Production of initial session state from a successful authentication result
- Management of the authentication attempt lifecycle — including handling authentication failures

**What AuthenticationManager Must Not Do:**
- Store the session after creating it — it hands the session state to `SessionManager`
- Manage reconnection — it authenticates; `ReconnectManager` determines when re-authentication is needed
- Make decisions about when to authenticate — it authenticates when `ConnectionController` asks it to
- Retry authentication with different credentials automatically — retry decisions are escalated to the operator

**Permitted Collaborators:**
- `ConnectionController` — receives authentication requests; returns success or failure
- `SessionManager` — delivers new session state after successful authentication
- `FacebookConfigurationProvider` — reads authentication configuration

**Forbidden Collaborators:**
- `FacebookTransport` (direct), `ReconnectManager`, `EventDispatcher`, `MessageGateway`, `RequestQueue`, `RetryController`, `RateLimitController`

**Credential Security:**
`AuthenticationManager` handles the most sensitive data in the Facebook Layer. It must never log, cache in a broadly-scoped variable, or pass to another component any credential value beyond what is strictly required for the authentication operation. Credentials are used and discarded — they are never retained.

**Single Authentication Point:**
`AuthenticationManager` is the only component that may initiate a Facebook login. There must be no second authentication code path anywhere in the Facebook Layer or elsewhere in the system.

---

### 7.5 ReconnectManager

**Single Responsibility:** Manage the complete reconnection process when the Facebook connection is lost — determining the reconnect strategy, executing backoff delays, coordinating session recovery, and signaling success or permanent failure.

**What ReconnectManager Owns:**
- The reconnection strategy — how many attempts, what delays, what backoff algorithm
- The execution of the reconnect sequence (coordinate session recovery → coordinate re-authentication if needed → signal `ConnectionController` to establish new transport)
- The definition of when reconnection is considered permanently failed
- The state of the current reconnection attempt (attempt number, next attempt time, last error)

**What ReconnectManager Must Not Do:**
- Directly establish the transport connection — it coordinates with `ConnectionController`, which instructs `FacebookTransport`
- Create or destroy session state directly — it coordinates with `SessionManager` for session recovery
- Perform authentication directly — it coordinates with `AuthenticationManager` when re-authentication is required
- Make decisions independently — it acts when `ConnectionHealthMonitor` or `ConnectionController` instructs it to

**Permitted Collaborators:**
- `ConnectionController` — receives reconnect instructions; signals reconnect success or permanent failure
- `SessionManager` — requests session recovery during reconnect
- `AuthenticationManager` — requests re-authentication when session cannot be recovered
- `ConnectionHealthMonitor` — reports reconnect progress

**Forbidden Collaborators:**
- `FacebookTransport` (direct), `EventDispatcher`, `MessageGateway`, `RequestQueue`, `RetryController`, `RateLimitController`, `HeartbeatMonitor`

**Reconnect as a Single Authority:**
`ReconnectManager` is the only component that may execute a Facebook reconnection. No other code path in the system may independently attempt to reconnect a Facebook session. If reconnection logic exists in two places, they will conflict — producing race conditions, duplicate connections, and unpredictable state.

**Bounded Reconnection:**
Reconnection attempts must be finite and bounded. `ReconnectManager` must define a maximum attempt count and a maximum total reconnection window. Infinite reconnection loops are an architectural defect — they mask persistent failures and prevent the system from entering a known failure state that can be reported to the operator.

---

### 7.6 EventDispatcher

**Single Responsibility:** Receive all raw inbound data from the Facebook connection, parse it into typed events, and distribute those events to the appropriate subscribers within the rest of the system.

**What EventDispatcher Owns:**
- The mapping from raw Facebook data to typed, named event types
- The subscriber registry — which parts of the system listen for which event types
- The distribution logic — delivering each event to all registered subscribers
- Event ordering guarantees — ensuring events are delivered in the order they are received

**What EventDispatcher Must Not Do:**
- Take action based on events — it distributes; it does not process
- Modify events before distributing them — it delivers events as received, with type information added
- Send any message back to Facebook — events flow upward (Facebook → Application); `MessageGateway` handles downward flow
- Maintain event history — it dispatches and releases; it does not store

**Permitted Collaborators:**
- `FacebookTransport` — receives raw inbound data from the transport
- Application Layer subscribers — delivers typed events upward
- `PresenceManager` — delivers presence-related events for local processing within the Facebook Layer

**Forbidden Collaborators:**
- `ConnectionController`, `SessionManager`, `AuthenticationManager`, `ReconnectManager`, `MessageGateway`, `RequestQueue`, `RetryController`, `RateLimitController`, `HeartbeatMonitor`

**Event as Immutable Record:**
An event, once received and typed by `EventDispatcher`, is immutable. Subscribers receive the event as-is. No subscriber may modify the event for the benefit of another subscriber — each subscriber processes its own copy independently.

**No Backpressure Propagation:**
`EventDispatcher` must not block the receipt of new events from `FacebookTransport` because a subscriber is slow. Slow subscriber handling (buffering, dropping, error reporting) must be managed at the subscriber level — not by `EventDispatcher`.

---

### 7.7 MessageGateway

**Single Responsibility:** Serve as the single exit point for all outbound Facebook messages and operations initiated by the Application Layer.

**What MessageGateway Owns:**
- The public interface for sending Facebook messages and performing Facebook operations on behalf of the Application Layer
- The translation of application-level send requests into Facebook-specific operation formats
- The handoff of operations to `RequestQueue` for sequencing and rate-limit-aware delivery

**What MessageGateway Must Not Do:**
- Queue or retry operations directly — it hands off to `RequestQueue`
- Communicate directly with `FacebookTransport` — all sends go through `RequestQueue`
- Make rate-limiting decisions — those belong to `RateLimitController`
- Receive or process inbound events — that is `EventDispatcher`'s responsibility

**Permitted Collaborators:**
- Application Layer — receives send requests from above
- `RequestQueue` — forwards all operations for sequenced delivery
- `SessionManager` — queries for session validity before accepting an operation

**Forbidden Collaborators:**
- `FacebookTransport` (direct), `ConnectionController`, `AuthenticationManager`, `ReconnectManager`, `EventDispatcher`

**Gateway as Contract:**
`MessageGateway` is the contract point between the Application Layer and the Facebook Layer for outbound operations. If the Application Layer needs to send something to Facebook, it goes through `MessageGateway` — with no exceptions. There is no back channel, no direct transport access, and no alternative send path.

**Operation Acceptance Policy:**
`MessageGateway` must assess whether the current connection state permits accepting a new operation. If the connection is reconnecting or disconnected, `MessageGateway` must either queue the operation (if the operation type supports queuing) or reject it with a clear error — not silently drop it.

---

### 7.8 PresenceManager

**Single Responsibility:** Track and manage the online/offline presence state of Facebook contacts, and provide current presence information to the Application Layer.

**What PresenceManager Owns:**
- The in-memory presence state for known Facebook contacts
- The logic for interpreting presence events received from `EventDispatcher`
- The interface for querying current presence state from the Application Layer
- Presence subscription management — which contacts' presence the system tracks

**What PresenceManager Must Not Do:**
- Communicate directly with `FacebookTransport`
- Subscribe to events without going through `EventDispatcher`
- Send presence-related messages without going through `MessageGateway`

**Permitted Collaborators:**
- `EventDispatcher` — subscribes to presence events
- `MessageGateway` — sends presence subscriptions and updates
- Application Layer — serves presence queries

**Forbidden Collaborators:**
- `FacebookTransport`, `ConnectionController`, `SessionManager`, `AuthenticationManager`, `ReconnectManager`, `RequestQueue`, `RetryController`

---

### 7.9 AttachmentManager

**Single Responsibility:** Handle all attachment-related operations — uploading files to Facebook before sending them as messages, and managing the download or retrieval of attachments from received messages.

**What AttachmentManager Owns:**
- The upload workflow for file attachments (prepare → upload → receive attachment ID → hand to message sender)
- Attachment metadata (size limits, supported types, upload endpoints)
- Coordination with `MessageGateway` for post-upload message sends

**What AttachmentManager Must Not Do:**
- Send messages directly — it produces attachment IDs, which are then used by `MessageGateway`
- Store attachment files beyond the duration of the upload operation
- Communicate directly with `FacebookTransport`

**Permitted Collaborators:**
- `MessageGateway` — sends attachment operations through the gateway
- Application Layer — receives upload requests; returns attachment identifiers

**Forbidden Collaborators:**
- `FacebookTransport` (direct), `ConnectionController`, `SessionManager`, `AuthenticationManager`, `ReconnectManager`, `EventDispatcher`

---

### 7.10 RequestQueue

**Single Responsibility:** Maintain an ordered queue of pending outbound Facebook operations and deliver them to the transport in a controlled, sequenced manner.

**What RequestQueue Owns:**
- The ordered queue of pending operations
- The dequeue loop — the process that pulls operations from the queue and initiates their execution
- The decision of when to dequeue (gated by `RateLimitController`)
- The handoff of failed operations to `RetryController`

**What RequestQueue Must Not Do:**
- Make rate-limiting decisions — it queries `RateLimitController` before dequeuing
- Retry failed operations directly — it hands failed operations to `RetryController`
- Communicate directly with `FacebookTransport` — it coordinates with the component that wraps the transport for sending
- Accept operations when the queue is full — it must enforce a maximum queue depth and reject or signal backpressure

**Permitted Collaborators:**
- `MessageGateway` — receives operations from the gateway
- `RateLimitController` — queries rate limit availability before dequeuing
- `RetryController` — hands over failed operations; receives retry-ready operations

**Forbidden Collaborators:**
- `FacebookTransport` (direct), `ConnectionController`, `SessionManager`, `AuthenticationManager`, `ReconnectManager`, `EventDispatcher`, `HeartbeatMonitor`

---

### 7.11 RetryController

**Single Responsibility:** Determine whether a failed Facebook operation is eligible for retry, compute the delay before the next attempt, and return the operation to the queue at the appropriate time.

**What RetryController Owns:**
- Retry eligibility rules — which operation types and which error types warrant retry
- The retry attempt counter per operation
- The backoff delay computation
- The decision of when an operation has exceeded its maximum retry count (terminal failure)

**What RetryController Must Not Do:**
- Execute retries directly — it returns operations to `RequestQueue` for re-execution
- Make rate-limiting decisions — it applies retry-specific backoff; rate limiting is `RateLimitController`'s responsibility
- Determine connection health — a failed operation may be a network issue or an application-level rejection; distinguishing these is `ConnectionHealthMonitor`'s domain

**Permitted Collaborators:**
- `RequestQueue` — returns retry-ready operations; receives failed operations
- `MessageGateway` — reports permanently failed operations so callers can be notified

**Forbidden Collaborators:**
- `FacebookTransport` (direct), `ConnectionController`, `SessionManager`, `AuthenticationManager`, `ReconnectManager`, `EventDispatcher`

---

### 7.12 RateLimitController

**Single Responsibility:** Track Facebook's rate limit state and gate outbound operation execution to prevent rate limit violations.

**What RateLimitController Owns:**
- The current rate limit state — how many operations have been sent in the current window
- The configuration of rate limit thresholds (operations per second, per minute, per account)
- The availability signal — whether the current rate state permits a new operation to be dequeued
- Detection of rate-limit rejection responses from Facebook (and updating state accordingly)

**What RateLimitController Must Not Do:**
- Execute operations — it gates execution; it does not perform it
- Queue operations — queuing is `RequestQueue`'s responsibility
- Retry operations — retrying is `RetryController`'s responsibility
- Log rate limit events directly — it exposes rate limit state; logging is done by the component that observes the state change

**Permitted Collaborators:**
- `RequestQueue` — responds to "is a new operation permitted?" queries
- `ConnectionHealthMonitor` — reports sustained rate limit pressure as a health signal

**Forbidden Collaborators:**
- `FacebookTransport`, `ConnectionController`, `SessionManager`, `AuthenticationManager`, `ReconnectManager`, `EventDispatcher`, `MessageGateway`

---

### 7.13 HeartbeatMonitor

**Single Responsibility:** Send periodic keepalive signals over the Facebook connection and detect when the connection has gone silent.

**What HeartbeatMonitor Owns:**
- The heartbeat schedule — the interval at which keepalive signals are sent
- The silence detector — the logic that determines when too much time has passed without a response
- The signal emitted when silence is detected (delivered to `ConnectionHealthMonitor`)

**What HeartbeatMonitor Must Not Do:**
- Initiate reconnection — it reports silence; `ConnectionHealthMonitor` and `ConnectionController` decide on reconnection
- Manage the session or authenticate
- Send application-level messages — keepalive signals are transport-level pings, not application messages

**Permitted Collaborators:**
- `FacebookTransport` — sends keepalive frames through the transport
- `ConnectionHealthMonitor` — reports heartbeat success and silence events

**Forbidden Collaborators:**
- `ConnectionController`, `SessionManager`, `AuthenticationManager`, `ReconnectManager`, `EventDispatcher`, `MessageGateway`, `RequestQueue`, `RetryController`, `RateLimitController`

---

### 7.14 ConnectionHealthMonitor

**Single Responsibility:** Aggregate health signals from multiple components, maintain a unified assessment of the connection's health, and trigger reconnection when the health assessment crosses a defined threshold.

**What ConnectionHealthMonitor Owns:**
- The health assessment algorithm — how signals from `HeartbeatMonitor`, `RetryController`, `RateLimitController`, and `ConnectionController` are combined into a health score or state
- The threshold definition — at what health level reconnection is triggered
- The reconnect trigger — the signal sent to `ReconnectManager` and `ConnectionController` when the threshold is breached

**What ConnectionHealthMonitor Must Not Do:**
- Execute reconnection — it triggers reconnection; `ReconnectManager` executes it
- Repair health problems — it observes and reports; it does not fix
- Override the decisions of individual components — it interprets signals, not commands

**Permitted Collaborators:**
- `HeartbeatMonitor` — receives heartbeat signals
- `RetryController` — receives information about retry failures
- `RateLimitController` — receives rate limit pressure signals
- `ConnectionController` — receives connection state change signals; triggers reconnect via `ConnectionController`
- `ReconnectManager` — triggers reconnection

**Forbidden Collaborators:**
- `FacebookTransport`, `SessionManager`, `AuthenticationManager`, `EventDispatcher`, `MessageGateway`, `RequestQueue`

---

### 7.15 FacebookConfigurationProvider

**Single Responsibility:** Supply all Facebook-specific configuration to the Facebook Layer components at initialization time.

**What FacebookConfigurationProvider Owns:**
- The retrieval of Facebook configuration from environment variables and the secrets manager
- The validation of configuration completeness and format at startup
- The provision of configuration to requesting components (read-only, at initialization)

**What FacebookConfigurationProvider Must Not Do:**
- Provide configuration at runtime after initialization (configuration is read once — not polled)
- Store or expose secret values beyond the initialization handoff
- Make decisions based on configuration values — it provides; it does not interpret

**Permitted Collaborators:**
- All Facebook Layer components — may read configuration from this provider during initialization
- Environment / Secrets Manager — reads from the environment at process start

**Forbidden Collaborators:**
- Application Layer (the Application Layer must not access Facebook configuration directly)

---

## 8. Connection Lifecycle

The connection lifecycle describes the complete sequence of states and transitions from the initial decision to connect through to a fully connected and usable Facebook session.

### Phase 1: Initiation
The Application Layer or the startup sequence requests that a Facebook connection be established for a specific Void user account. `ConnectionController` receives this request and transitions to the `connecting` state.

### Phase 2: Session Check
`ConnectionController` queries `SessionManager` to determine whether a valid, persisted session is available for the requested account.

- **If a valid session exists:** Proceed to Phase 4 (Transport Establishment), skipping authentication
- **If no valid session exists or the session is expired:** Proceed to Phase 3 (Authentication)

### Phase 3: Authentication
`ConnectionController` instructs `AuthenticationManager` to authenticate against Facebook.

- **If authentication succeeds:** `AuthenticationManager` delivers the new session state to `SessionManager`. `SessionManager` persists and activates the session. Proceed to Phase 4.
- **If authentication fails:** `ConnectionController` transitions to `disconnected` state and reports the failure. No further automatic action is taken — operator intervention is required.

### Phase 4: Transport Establishment
`ConnectionController` instructs `FacebookTransport` to open the connection using the active session from `SessionManager`.

- **If transport connects successfully:** Proceed to Phase 5.
- **If transport fails to connect:** `ConnectionController` delegates to `ReconnectManager`.

### Phase 5: Ready
`HeartbeatMonitor` begins its keepalive schedule. `ConnectionHealthMonitor` begins aggregating health signals. `EventDispatcher` begins accepting inbound data from `FacebookTransport`. `MessageGateway` begins accepting outbound operations. `ConnectionController` transitions to `connected` state and notifies the Application Layer.

---

## 9. Authentication Lifecycle

Authentication is the process of establishing a verified Facebook identity and producing a usable session.

### Phase 1: Credential Acquisition
`AuthenticationManager` receives the credentials necessary to authenticate. These credentials are provided by the Application Layer at the time of the authentication request — they are not stored by `AuthenticationManager`.

### Phase 2: Authentication Execution
`AuthenticationManager` performs the authentication sequence against Facebook using the provided credentials.

### Phase 3: Result Processing
- **On success:** `AuthenticationManager` receives the resulting session state (including AppState and any tokens). It passes this state immediately to `SessionManager` for encryption and persistence. The credentials are discarded. `AuthenticationManager` signals success to `ConnectionController`.
- **On failure:** `AuthenticationManager` categorizes the failure (invalid credentials, account locked, two-factor required, network error) and reports the categorized failure to `ConnectionController`. Credentials are discarded regardless of outcome.

### Phase 4: Credential Discard
All credential values held by `AuthenticationManager` are explicitly released at the end of Phase 3. No credential value survives beyond a single authentication attempt.

---

## 10. Session Lifecycle

### Phase 1: Creation
A session is created as the output of a successful authentication (`AuthenticationManager` → `SessionManager`). `SessionManager` encrypts the session state and persists it to storage. The session is marked as active and associated with the Void user account and Facebook identity.

### Phase 2: Active Use
During active connection, `SessionManager` maintains the session in memory for fast access. The session's last-used timestamp is updated on each use. The transport uses session state for all Facebook operations.

### Phase 3: Refresh
When the session's token or AppState approaches expiry, `SessionManager` signals that refresh is needed. `ConnectionController` coordinates a refresh through `AuthenticationManager` without interrupting the connection if possible.

### Phase 4: Expiry Detection
`SessionManager` monitors session validity continuously. When a session expires (by time or by Facebook rejection), it emits a session-expired event. `ConnectionController` receives this event and initiates the reconnect/re-authentication sequence.

### Phase 5: Recovery
After a server restart or cache eviction, `SessionManager` attempts to recover the session from persisted, encrypted storage. The recovered state is validated against Facebook before being marked as active. An unvalidatable recovered session is treated as expired.

### Phase 6: Destruction
A session is destroyed when: the user explicitly disconnects their Facebook account, the session is permanently invalidated by Facebook, or an operator manually revokes it. `SessionManager` removes the session from memory and deletes the persisted state from storage.

---

## 11. Message Lifecycle

Every outbound Facebook message follows this path without exception:

```
Application Layer
       ↓ send request
  MessageGateway (validates session availability, translates to operation format)
       ↓ enqueue
   RequestQueue (holds in ordered queue)
       ↓ "is rate OK?" query
  RateLimitController (gates dequeue)
       ↓ approved — dequeue and execute
   [Execution against FacebookTransport]
       ↓ on failure
   RetryController (eligibility check → backoff delay → re-enqueue)
       ↓ on permanent failure
   MessageGateway (notify Application Layer of failure)
```

No step in this path may be skipped. An operation that bypasses `RequestQueue` or `RateLimitController` is an architectural violation.

---

## 12. Event Lifecycle

Every inbound Facebook event follows this path without exception:

```
FacebookTransport (receives raw data from Facebook connection)
       ↓ raw data
  EventDispatcher (parses raw data into typed event)
       ↓ typed event (delivered to all registered subscribers)
  Application Layer subscribers (handle specific event types)
  PresenceManager (if presence event)
```

No inbound event may reach the Application Layer through a path that bypasses `EventDispatcher`. No component within the Facebook Layer may take action on event content without receiving it through the `EventDispatcher` subscription mechanism.

---

## 13. Reconnect Lifecycle

### Phase 1: Trigger
`ConnectionHealthMonitor` detects that health has fallen below the threshold — due to silence from `HeartbeatMonitor`, sustained retry failures from `RetryController`, or a transport-level disconnection event. It triggers reconnection through `ConnectionController`.

### Phase 2: State Preparation
`ConnectionController` transitions to `reconnecting` state. `MessageGateway` suspends acceptance of new operations (or queues them if the operation type supports queuing). `HeartbeatMonitor` pauses its schedule.

### Phase 3: Session Recovery Attempt
`ReconnectManager` requests session recovery from `SessionManager`. If a valid persisted session is available, it is loaded. If not, `ReconnectManager` requests re-authentication from `AuthenticationManager`.

### Phase 4: Transport Re-establishment
`ReconnectManager` signals `ConnectionController` to re-establish the transport using the recovered or new session. `ConnectionController` instructs `FacebookTransport` to connect.

### Phase 5: Backoff
If the transport connection fails, `ReconnectManager` applies the backoff delay before the next attempt. The backoff increases with each successive failure. The attempt counter is incremented.

### Phase 6: Success or Exhaustion
- **Success:** `ConnectionController` transitions to `connected`. `HeartbeatMonitor` resumes. `MessageGateway` resumes processing. The Application Layer is notified that the connection is restored.
- **Exhaustion (max attempts reached):** `ReconnectManager` signals permanent failure to `ConnectionController`. `ConnectionController` transitions to `disconnected`. The Application Layer is notified. Operator intervention is required.

---

## 14. Shutdown Lifecycle

### Phase 1: Signal Receipt
The process receives a shutdown signal (SIGTERM or equivalent). `ConnectionController` receives the shutdown instruction.

### Phase 2: Graceful Drain
`MessageGateway` stops accepting new operations. `RequestQueue` processes remaining queued operations up to a defined drain timeout. Operations that cannot be completed within the drain window are discarded or returned to their callers.

### Phase 3: Session Persistence
`SessionManager` ensures the current session state is written to persistent storage before the connection is closed. This enables session recovery on the next startup without re-authentication.

### Phase 4: Transport Close
`ConnectionController` instructs `FacebookTransport` to close the connection gracefully (sending a proper close frame if the protocol supports it). `HeartbeatMonitor` halts.

### Phase 5: Resource Release
All components release their resources — timers cancelled, subscriptions removed, in-memory state cleared. `ConnectionController` transitions to `disconnected`.

---

## 15. Error Recovery Lifecycle

Error recovery is the process of returning the system to a stable state after a failure that does not warrant full reconnection.

### Transient Operation Failure
An individual operation fails due to a transient error (network blip, temporary rate limit). `RetryController` determines eligibility and schedules a retry. `ConnectionHealthMonitor` notes the failure but does not trigger reconnection unless failures accumulate beyond the threshold.

### Session Degradation
The session becomes stale or partially invalid (token needs refresh, session state has drifted). `SessionManager` detects this and requests a refresh through `ConnectionController` and `AuthenticationManager`. The connection remains active if possible during the refresh.

### Transport Interruption
The transport disconnects unexpectedly. `FacebookTransport` reports the disconnection to `ConnectionController`. `ConnectionHealthMonitor` is updated. `ReconnectManager` is triggered to restore the connection.

### Permanent Failure
After all retry and reconnect attempts are exhausted, the system enters a stable failure state. The Application Layer is notified. No further automatic recovery is attempted. Human intervention is required to restore the connection.

---

## 16. Component Communication

### 16.1 Communication Mechanisms

Components within the Facebook Layer communicate through the following mechanisms only:

| Mechanism | Usage |
|---|---|
| Direct method call (synchronous) | When a component requests a service from another and needs an immediate result |
| Event emission (asynchronous) | When a component needs to notify others of a state change without knowing who is listening |
| Callback registration | When a component needs to be notified of a future event from a specific other component |
| Query interface (read-only) | When a component needs to read state owned by another component |

### 16.2 No Shared Mutable State

Components must not share mutable state. If one component needs information that another component owns, it must ask for it through a defined interface — not access a shared data structure directly. Shared mutable state creates hidden coupling and race conditions.

### 16.3 Events vs. Direct Calls

Use event emission when:
- The emitting component does not need to know who receives the event
- Multiple components may need to react to the same state change
- The emitting component should not be blocked by receiver processing

Use direct method calls when:
- The calling component needs a return value
- The relationship is 1:1 and clearly defined in this document
- The call is part of a defined lifecycle sequence

---

## 17. Dependency Rules

### 17.1 Layer Boundary Rule

No component outside the Facebook Layer may depend on any component inside the Facebook Layer directly. The Application Layer depends only on the Facebook Layer's public interface — a set of abstractions that hide all internal structure.

### 17.2 Internal Dependency Direction

Dependencies within the Facebook Layer flow in one direction per relationship, as defined in Section 6.1. Circular dependencies between components are forbidden. If two components appear to need each other, one of them is taking on a responsibility it should not have.

### 17.3 Library Dependency Rule

All Facebook library imports and instantiations are confined to the Facebook Layer. No import of any Facebook-specific library may appear in any other layer — not in the Application Layer, not in the Domain Layer, not in Infrastructure components outside the Facebook Layer's boundary.

### 17.4 Configuration Dependency Rule

Only `FacebookConfigurationProvider` reads Facebook-specific configuration. Other components receive what they need from `FacebookConfigurationProvider` at initialization. No component reads environment variables directly.

---

## 18. State Management

### 18.1 State Ownership Is Exclusive

Every piece of state has exactly one owner. The owner is defined in the component specification (Section 7). No state is owned by two components simultaneously. If two components need access to the same state, the state has one owner and the other component queries it.

### 18.2 State Categories

| State Category | Owner | Persistence |
|---|---|---|
| Connection lifecycle state | ConnectionController | In-memory |
| Session state (AppState, tokens) | SessionManager | Encrypted persistent storage |
| Reconnect attempt state | ReconnectManager | In-memory |
| Rate limit counters | RateLimitController | In-memory (or distributed cache) |
| Request queue contents | RequestQueue | In-memory (with optional persistence for durability) |
| Heartbeat timing state | HeartbeatMonitor | In-memory |
| Health assessment state | ConnectionHealthMonitor | In-memory |
| Presence state | PresenceManager | In-memory |
| Configuration | FacebookConfigurationProvider | Environment (read once at init) |

### 18.3 State Must Not Leak Across User Accounts

All stateful components that manage per-account data (primarily `SessionManager` and `PresenceManager`) must enforce account-level isolation. State belonging to one Void user account must never be accessible in the context of another.

---

## 19. Resource Management

### 19.1 Resources Are Owned by the Component That Creates Them

Timers, subscriptions, file handles, and connections created by a component are that component's responsibility to clean up. Resource cleanup must occur during the shutdown lifecycle (Section 14) and on error paths — not only on the happy path.

### 19.2 Resource Limits

Each component must define and enforce limits on the resources it manages:
- `RequestQueue`: maximum queue depth
- `RetryController`: maximum retry count per operation
- `ReconnectManager`: maximum reconnection attempts
- `HeartbeatMonitor`: maximum silence duration before reporting

Unbounded resource growth is an architectural defect.

### 19.3 No Resource Leaks on Reconnect

When a reconnection occurs, resources associated with the previous connection (timers, subscriptions, transport handles) must be explicitly released before the new connection's resources are created. Reconnecting without releasing old resources creates leaks that accumulate over time.

---

## 20. Thread Safety

### 20.1 Assume Concurrent Access

In a Node.js environment, the event loop provides a form of single-threaded concurrency — but asynchronous operations can interleave in ways that create logical race conditions. The Facebook Layer must be designed assuming that multiple operations may be in progress simultaneously.

### 20.2 State Transitions Must Be Atomic

State transitions within a component — particularly in `ConnectionController`, `SessionManager`, and `ReconnectManager` — must be atomic from the perspective of other components. A component that reads state during a transition must see either the old state or the new state — not an intermediate state.

### 20.3 Session Access Must Be Serialized

Concurrent access to the same session must be serialized. If two operations attempt to use or modify the same session simultaneously, one must wait. This is particularly critical during session refresh and reconnection — a fresh session must not be used before the refresh is complete, and a refresh must not be initiated twice concurrently for the same session.

---

## 21. Scalability Strategy

### 21.1 Per-Account Isolation as the Scaling Unit

Each Void user account's Facebook connection is an independent unit. Scaling the Facebook Layer means running more of these independent units — not scaling a single shared connection. The architecture must not create shared state between accounts that would prevent horizontal scaling.

### 21.2 `RateLimitController` Must Be Distributed

When multiple application instances serve the same account's Facebook connection (if applicable), rate limit state must be shared via a distributed cache (Redis). A per-process rate limit counter will allow the combined request rate to exceed Facebook's limits.

### 21.3 `RequestQueue` Durability

For high-reliability deployments, `RequestQueue` may persist its queue to a durable store (Redis, database) so that operations queued before a process restart are not lost. This is an optional capability — the architecture must support it without requiring it in all environments.

---

## 22. Stability Strategy

### 22.1 Connection Stability Is the Primary Metric

The Facebook Layer is successful when connections remain stable for months. Every architectural decision must be evaluated against this metric. Instability sources — memory leaks, timer drift, state corruption, race conditions — must be eliminated systematically.

### 22.2 Proactive Health Management

`ConnectionHealthMonitor` and `HeartbeatMonitor` are the proactive stability mechanisms. They detect degradation before it becomes disconnection. Reactive reconnection (reconnecting after disconnection) is less stable than proactive health management (preventing disconnection).

### 22.3 Isolation Prevents Cascading Failures

Because each component owns exactly one responsibility, a failure in one component does not cascade to others. A `PresenceManager` failure must not affect the ability to send messages. A `RateLimitController` failure must not prevent heartbeats. Isolation is both an architectural clarity principle and a stability strategy.

---

## 23. Replaceability Strategy

### 23.1 The Library Is Behind an Abstraction

The Facebook Layer's internal components interact with the Facebook platform through `FacebookTransport`. `FacebookTransport` is an abstraction — it hides the specific library used. Replacing the library means replacing `FacebookTransport`'s implementation while preserving its interface.

### 23.2 Component-Level Replaceability

Because each component has a single, well-defined responsibility and communicates through explicit interfaces, any component can be replaced without affecting others — provided the new implementation satisfies the same interface and behavioral contract.

### 23.3 No Library Bleed

No Facebook library type, interface, error type, or constant may appear in any component's public interface or in any layer outside the Facebook Layer. If a Facebook library changes its types or errors, only the Facebook Layer must be updated.

---

## 24. Failure Recovery Strategy

### 24.1 Every Component Has a Failure Mode

Each component must define what it does when it fails — not just when it succeeds. Failure modes are part of the design, not exceptions to it.

### 24.2 Failure Classification

| Failure Type | Response Strategy |
|---|---|
| Transient operation failure | Retry with backoff (via RetryController) |
| Session expiry | Refresh or re-authenticate (via SessionManager + AuthenticationManager) |
| Transport disconnection | Reconnect (via ReconnectManager) |
| Rate limit exceeded | Backoff and retry (via RateLimitController + RetryController) |
| Authentication failure | Escalate to operator — no automatic retry with different credentials |
| Permanent connection failure | Enter stable failure state — notify operator |

### 24.3 Failure States Are Stable

When the Facebook Layer reaches a permanent failure state (reconnection exhausted, authentication failed), it must remain stable in that state. It must not loop, thrash, or consume resources attempting to recover. It waits for operator intervention.

---

## 25. Monitoring Strategy

### 25.1 Required Observable Metrics

The Facebook Layer must expose the following metrics at all times:

| Metric | Source Component |
|---|---|
| Connection state (idle / connecting / connected / reconnecting / disconnected) | ConnectionController |
| Session validity (valid / expired / missing) | SessionManager |
| Last heartbeat timestamp | HeartbeatMonitor |
| Heartbeat silence duration | HeartbeatMonitor |
| Current reconnect attempt number | ReconnectManager |
| Request queue depth | RequestQueue |
| Current rate limit usage | RateLimitController |
| Retry queue depth | RetryController |
| Overall health score | ConnectionHealthMonitor |
| Last successful message sent timestamp | MessageGateway |
| Last event received timestamp | EventDispatcher |

### 25.2 Health Endpoint

The Facebook Layer must expose a health status summary to the system's health check infrastructure — indicating for each managed account: connected, degraded, or disconnected.

---

## 26. Extension Strategy

### 26.1 New Capabilities Follow the Single Responsibility Rule

When new Facebook capabilities are added (new message types, new event types, new API features), they must be implemented in the component that owns the relevant responsibility — or in a new component if the capability introduces a genuinely new responsibility.

### 26.2 New Components Must Be Documented Here First

Before a new component is added to the Facebook Layer, it must be specified in this document — including its responsibility, what it owns, what it must not do, and its permitted collaborators. Code that precedes the architectural document is an anti-pattern.

### 26.3 The Public Interface Evolves Deliberately

The Facebook Layer's public interface (the contract exposed to the Application Layer) must change deliberately and with version awareness. Uncontrolled evolution of the public interface breaks the Application Layer.

---

## 27. Architectural Constraints

These constraints are inviolable. No future change to the Facebook Layer may violate them. If a future requirement appears to require violating a constraint, the requirement must be re-examined — not the constraint.

1. **Single entry point for all Facebook operations.** All communication with the Facebook platform passes through the Facebook Layer. No code outside the Facebook Layer may import or instantiate any Facebook library.

2. **Single authentication point.** `AuthenticationManager` is the only component in the system authorized to perform a Facebook login. No second login code path exists anywhere.

3. **Single reconnection point.** `ReconnectManager` is the only component authorized to execute a Facebook reconnection. No second reconnection code path exists anywhere.

4. **Single session authority.** `SessionManager` is the only component authorized to create, read, persist, recover, or destroy a Facebook session. No other component stores or manages session state.

5. **Single event entry point.** `EventDispatcher` is the only entry point through which inbound Facebook events enter the rest of the system. No event reaches the Application Layer through any other path.

6. **Single message exit point.** `MessageGateway` is the only exit point through which outbound operations leave the Application Layer and enter the Facebook Layer's delivery pipeline.

7. **No circular component dependencies.** Component dependencies flow in one direction. If a dependency cycle appears necessary, it indicates a design error that must be resolved architecturally.

8. **No shared mutable state between components.** Each component owns its state exclusively. State is shared only through defined query interfaces — never through shared data structures.

9. **No account state cross-contamination.** Session, presence, and any other per-account state must never be accessible in the context of a different account.

10. **No Facebook library types in external interfaces.** The Facebook Layer's public interface exposes only Void-defined types. No Facebook library type appears in any interface that crosses the Facebook Layer boundary.

11. **Configuration is read once.** `FacebookConfigurationProvider` reads configuration at startup. No component polls configuration at runtime. Configuration changes require a process restart.

12. **Reconnection is bounded.** `ReconnectManager` must have a defined maximum attempt count and must enter a stable failure state upon exhaustion. Infinite reconnection loops are forbidden.

---

## 28. Forbidden Facebook Architecture Practices

The following patterns are categorically forbidden. Any instance found in code review must be rejected and corrected before merge.

### 28.1 Calling a Facebook Library from Outside the Facebook Layer

Any `import` or `require` of a Facebook-specific library in the Application Layer, Domain Layer, Infrastructure Layer, or any other location outside the `facebook/` module boundary is a critical architectural violation. It breaks the encapsulation that makes the Facebook Layer replaceable and creates hidden dependencies that will survive a library change.

### 28.2 Implementing Login in More Than One Location

Authentication logic — the code that presents credentials to Facebook and receives session state — must exist in exactly one place: `AuthenticationManager`. A second login implementation anywhere in the system creates two competing authentication code paths, each potentially managing state independently, resulting in conflicts, race conditions, and unpredictable behavior.

### 28.3 Implementing Reconnection in More Than One Location

Reconnection logic must exist in exactly one place: `ReconnectManager`. A component that detects a connection problem and attempts to reconnect independently — bypassing `ReconnectManager` — will conflict with the authorized reconnect sequence, producing duplicate connection attempts and state corruption.

### 28.4 Creating a Facebook Session Outside of SessionManager

Any code that creates, stores, or manipulates Facebook session state outside of `SessionManager` fragments the session management responsibility. The result is multiple places where session state can diverge, go stale, or conflict — destroying the reliability of session recovery.

### 28.5 Bypassing EventDispatcher for Inbound Events

Any code that reads raw event data from `FacebookTransport` without routing it through `EventDispatcher` creates an untyped, uncontrolled event path. Subscribers registered with `EventDispatcher` will not receive these events. The event system's integrity is broken.

### 28.6 Bypassing MessageGateway for Outbound Operations

Any code that sends a Facebook message by calling `RequestQueue`, `RetryController`, or `FacebookTransport` directly — without going through `MessageGateway` — bypasses the operation acceptance policy, session validation, and the standard delivery pipeline. Rate limiting and retry behavior will be inconsistent.

### 28.7 Sharing Internal State Between Components

Any mechanism by which one component directly accesses or mutates the internal state of another — shared objects, global variables, module-level singletons with mutable state — creates hidden coupling. Component state is private. If another component needs it, it must ask through a defined interface.

### 28.8 Creating Tight Coupling Between Facebook Layer Components

Components within the Facebook Layer may only depend on one another as specified in Section 6.1. A component that depends on another not listed as a permitted collaborator violates the dependency rules. Tight coupling between components prevents independent replacement, independent testing, and independent evolution.

### 28.9 Adding a New Component Without Documenting It First

A new component in the Facebook Layer that is not specified in this document is an undocumented architectural decision. Future engineers cannot know its intended scope, and it may grow beyond its original purpose. Every component must be specified here before it is implemented.

### 28.10 Allowing Facebook Library Types to Escape the Layer Boundary

Any function, class, or interface that forms part of the Facebook Layer's public interface must use only Void-defined types — not types imported from Facebook libraries. If a Facebook library type appears in the Application Layer, replacing the library will require changes in the Application Layer — defeating the purpose of the Facebook Layer's encapsulation.

---

## 29. Common Mistakes

These mistakes are common in systems of this type. Void engineers must actively guard against them.

1. **Conflating connection state with session state.** A transport can be connected while the session is expired. These are independent states managed by different components. Code that treats them as the same will behave incorrectly during session refresh and recovery.

2. **Starting a reconnect from inside an event handler.** Receiving an error event and immediately initiating reconnection from within the event handler bypasses `ReconnectManager` and `ConnectionHealthMonitor`. Event handlers must report — they must not take connection management actions.

3. **Retrying authentication automatically with stored credentials.** When authentication fails, the correct response is to escalate to the operator — not to loop retrying with the same credentials. Automatic retry on authentication failure masks the real problem and may trigger account lockout.

4. **Passing session objects between request contexts.** Session objects must be fetched from `SessionManager` within each operation's context — not passed as function arguments from an outer context. Passed sessions may be stale by the time they are used.

5. **Building rate limit bypass for "urgent" messages.** Rate limits imposed by Facebook apply uniformly. A "bypass" for urgent messages leads to rate limit violations and connection suspension, which harms all messages — urgent and otherwise.

6. **Logging state objects that contain AppState or tokens.** A logging statement that records an entire connection state object may capture AppState or token values. All logging of Facebook Layer state must use sanitized representations.

7. **Treating reconnection success as session validity.** A successful transport reconnect does not guarantee the session is valid. `SessionManager` must validate the session after every reconnect — the reconnect may have used a stale session that Facebook will reject on the first API call.

---

## 30. Anti-Patterns

### 30.1 The God Object

A single component that handles authentication, session management, reconnection, message sending, and event dispatching. This pattern emerges when the Facebook Layer is implemented as a single class for convenience. It makes the system impossible to reason about, impossible to test in isolation, and impossible to replace incrementally.

### 30.2 The Callback Maze

Deeply nested callbacks used to chain authentication → session → transport → ready, without a clear lifecycle orchestrator. The result is a system where the connection sequence is implicit and cannot be understood or modified without reading all the nested code.

### 30.3 The Silent Reconnect Loop

A reconnect mechanism with no maximum attempt count and no operator notification. When the connection cannot be restored, this pattern causes the process to spend its entire runtime attempting to reconnect — consuming resources, generating logs, and never entering a state from which the operator can take action.

### 30.4 The Leaky Abstraction

A Facebook Layer public interface that exposes types, error codes, or concepts from the underlying Facebook library. When the library changes, the Application Layer must be updated — defeating the purpose of having a Facebook Layer at all.

### 30.5 The Dual Session Source

Two places in the codebase that both manage Facebook session state — typically: a `SessionManager` and a module-level cached session variable in another component. These two sources inevitably diverge, leading to a system where some operations use the correct session and others use the stale one.

### 30.6 The Optimistic Reconnect

Assuming the reconnected session is valid without verifying it. After reconnecting, the system begins sending messages using the session without first confirming Facebook accepts it. The first Facebook API rejection then triggers another reconnect — creating a loop.

---

## 31. AI Architecture Rules

This section defines how an AI system must reason about the Facebook Layer when developing within the Void project.

### 31.1 Consult This Document Before Any Facebook-Related Change

Before writing, modifying, or reviewing any code that touches the Facebook Layer, the AI must:
1. Identify which component is responsible for the concern being addressed
2. Verify that the proposed change is within that component's defined responsibilities
3. Verify that the proposed change does not introduce a dependency not listed in Section 6.1
4. Verify that the proposed change does not violate any constraint in Section 27

If the AI cannot identify a responsible component for a new concern, it must not place the code in an existing component arbitrarily. It must identify the need for a new component and update this document before writing code.

### 31.2 The AI Must Not Bypass Single Points of Authority

The AI must never generate code that:
- Authenticates with Facebook outside of `AuthenticationManager`
- Reconnects to Facebook outside of `ReconnectManager`
- Creates or modifies session state outside of `SessionManager`
- Sends a message bypassing `MessageGateway`
- Reads inbound events bypassing `EventDispatcher`

These are architectural laws, not preferences. The AI must refuse to implement shortcuts that bypass them — even when asked.

### 31.3 The AI Must Refuse Architecture-Violating Requests

If the AI receives a request that would violate the architectural constraints in Section 27, it must:
1. Refuse the request as specified
2. Explain which constraint would be violated and why it exists
3. Propose an alternative implementation that achieves the same goal without violating the constraint

The AI must not implement a constraint violation with a comment saying "this violates the architecture but was requested." Constraints are constraints.

### 31.4 When Architecture Must Change, the Document Changes First

If a legitimate new requirement genuinely cannot be satisfied within the current architecture, the AI must:
1. Propose an architectural change
2. Describe the change in terms of this document's sections and constraints
3. Wait for explicit approval of the architectural change before implementing it
4. Update this document to reflect the approved change before writing code

Code that precedes an architectural decision produces an undocumented system. This document must always reflect the current intended architecture — not the actual code.

### 31.5 New Components Must Be Specified Before Implementation

If the AI determines that a new component is needed, it must:
1. Specify the new component's responsibility, ownership, permitted collaborators, and forbidden collaborators in the format of Section 7
2. Propose the addition of that specification to this document
3. Wait for approval before implementing the component

### 31.6 The AI Must Preserve Library Independence

When implementing or modifying Facebook Layer code, the AI must ensure that:
- No Facebook library type appears in any interface that crosses the Facebook Layer boundary
- The component being modified does not develop a direct dependency on the underlying Facebook library beyond what `FacebookTransport` exposes

### 31.7 The AI Must Flag Security-Relevant State

When writing code that handles session state, tokens, or AppState within the Facebook Layer, the AI must explicitly confirm that:
- The state is not logged
- The state is encrypted before any persistence
- The state is associated with the correct account and not accessible across account contexts
- Credentials are discarded after use

### 31.8 The AI Must Identify the Lifecycle Phase

Every significant operation in the Facebook Layer occurs within a defined lifecycle (Sections 8–15). When writing code for a Facebook Layer operation, the AI must identify which lifecycle the operation belongs to and ensure the code's behavior is consistent with that lifecycle's defined phases and transitions.

---

## 32. Review Checklist

Use this checklist for every code review that introduces or modifies Facebook Layer code.

### Architecture
- [ ] The changed code is within the responsible component's defined scope (Section 7)
- [ ] No new dependencies have been introduced beyond those in Section 6.1
- [ ] No Facebook library import appears outside the Facebook Layer
- [ ] The change does not violate any constraint in Section 27
- [ ] If a new component is introduced, it is specified in this document

### Single Points of Authority
- [ ] Authentication is performed only through `AuthenticationManager`
- [ ] Reconnection is performed only through `ReconnectManager`
- [ ] Session creation/modification is performed only through `SessionManager`
- [ ] All outbound operations go through `MessageGateway`
- [ ] All inbound events are routed through `EventDispatcher`

### State Management
- [ ] No new shared mutable state exists between components
- [ ] Session state is isolated per account — no cross-account access
- [ ] State transitions are atomic and consistent

### Security
- [ ] No AppState, token, or session value is logged
- [ ] Credentials are discarded after use
- [ ] Session state is encrypted before persistence
- [ ] Facebook library types do not appear in external interfaces

### Lifecycle Compliance
- [ ] The changed code is consistent with the appropriate lifecycle (Sections 8–15)
- [ ] Failure paths are handled — not only the happy path
- [ ] Resources created in the changed code are released in the shutdown and error paths

### Observability
- [ ] The changed component exposes its relevant state to the monitoring system
- [ ] Health signals are emitted to `ConnectionHealthMonitor` where appropriate

### Documentation
- [ ] If this change modifies a component's responsibilities, this document has been updated
- [ ] If this change adds a new component, it is fully specified in Section 7

---

*This document is the official and sole architectural reference for the Facebook Layer in Void. All engineers, contributors, and AI systems operating on this codebase are bound by the architectural decisions, constraints, and component specifications defined here. No Facebook-related code may be written, modified, or deleted without consulting this document. Architectural changes require updating this document before writing code. Any conflict between this document and the actual codebase is a documentation debt that must be resolved — either by correcting the code or by updating the document with explicit approval.*
