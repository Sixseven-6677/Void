# 14 — Event System Architecture

> **Status:** Official  
> **Scope:** All event-related design decisions in Void — event sources, dispatching, queuing, prioritization, propagation, handler isolation, middleware, cancellation, and error management  
> **Authority:** This document is the single source of truth for the event system architecture in Void. It is read in conjunction with `10-facebook-architecture.md`, `12-plugin-system.md`, and `13-command-system.md`. No event system code may be written, modified, or deleted without consulting this document. Changes to the event system architecture require updating this document before implementation.

---

## Table of Contents

1. [Event Philosophy](#1-event-philosophy)
2. [Event Lifecycle](#2-event-lifecycle)
3. [Event Sources](#3-event-sources)
4. [Event Dispatcher](#4-event-dispatcher)
5. [Event Queue](#5-event-queue)
6. [Event Context](#6-event-context)
7. [Event Priority](#7-event-priority)
8. [Event Cancellation](#8-event-cancellation)
9. [Event Propagation](#9-event-propagation)
10. [Middleware Integration](#10-middleware-integration)
11. [Plugin Events](#11-plugin-events)
12. [Internal Events](#12-internal-events)
13. [System Events](#13-system-events)
14. [Error Handling](#14-error-handling)
15. [Performance](#15-performance)
16. [Event Isolation](#16-event-isolation)
17. [Best Practices](#17-best-practices)
18. [Anti-Patterns](#18-anti-patterns)
19. [Forbidden Event Practices](#19-forbidden-event-practices)
20. [AI Event Rules](#20-ai-event-rules)
21. [Review Checklist](#21-review-checklist)

---

## 1. Event Philosophy

### 1.1 Events Are Notifications, Not Instructions

An event is a notification that something has happened — a message was received, a connection was restored, a session expired. An event does not instruct any component to do anything specific. It announces a fact. What any given component does in response to that fact is entirely that component's business — the event source does not know and does not care.

This distinction is foundational. A system that conflates events with instructions produces tight coupling: the event producer must know who is listening and what they will do. A system that treats events as pure notifications allows any number of subscribers to respond independently — or for no subscriber to respond at all — without the producer changing.

### 1.2 The Dispatcher Is the Single Gateway

Every event — regardless of source, type, priority, or target — enters the rest of the system through exactly one path: the `EventDispatcher`. There are no side channels. There are no direct handler calls. There are no shortcut delivery paths for "urgent" or "internal" events.

This centralization is not a bottleneck — it is a correctness guarantee. When every event passes through the `EventDispatcher`, the system can enforce middleware uniformly, log all events, apply priority ordering, enforce cancellation, and isolate handler failures — for every event, every time.

### 1.3 Producers Are Decoupled from Consumers

The component that emits an event has no knowledge of which components will handle it. It does not know how many subscribers exist. It does not know what those subscribers will do. It does not wait for subscribers to finish (in the default asynchronous delivery model).

This decoupling is what makes the event system extensible. A new plugin can subscribe to an existing event type without the event producer knowing or changing. An existing subscriber can be removed without the producer knowing or changing.

### 1.4 Handlers Are Independent

Every handler subscribed to an event type processes the event independently. A handler that fails does not affect other handlers. A handler that is slow does not block other handlers. Each handler's outcome is its own.

### 1.5 Events Are Immutable Records

An event, once emitted, is an immutable record of what happened. Handlers receive the event as-is — they may not modify it. If a handler needs to annotate or extend event information for its own purposes, it does so in its own local state — not by modifying the event object.

---

## 2. Event Lifecycle

Every event follows a defined path from its origin to the completion of all handler processing. No stage may be skipped.

```
  Event Source
  (Facebook Layer, Core Component, Plugin)
          │
          │ emit(eventType, payload)
          ▼
  ┌─────────────────────┐
  │   EventDispatcher   │ ← Single entry point for all events
  │   (receive & enqueue)│
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │     Event Queue     │ ← Priority-ordered; isolated per event type
  └──────────┬──────────┘
             │ Dequeue next event
             ▼
  ┌─────────────────────┐
  │   Event Middleware  │ ← Logging, rate limiting, cancellation checks
  │      Pipeline       │
  └──────────┬──────────┘
             │ Middleware allows propagation
             ▼
  ┌─────────────────────┐
  │   Context Builder   │ ← Enrich raw event payload into full Event Context
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  Subscriber Lookup  │ ← Find all handlers registered for this event type
  └──────────┬──────────┘
             │ One or more subscribers found
             │ No subscribers — event silently consumed
             ▼
  ┌──────────────────────────────────────────────────┐
  │              Handler Delivery                    │
  │  ┌──────────────┐  ┌──────────────┐             │
  │  │  Handler A   │  │  Handler B   │  ...        │
  │  │  (isolated)  │  │  (isolated)  │             │
  │  └──────┬───────┘  └──────┬───────┘             │
  │         │                 │                      │
  │   success/error     success/error                │
  └─────────┼─────────────────┼──────────────────────┘
            │                 │
            ▼                 ▼
  ┌─────────────────────────────────┐
  │      Handler Result Collector   │ ← Aggregate outcomes; log errors
  └─────────────────────────────────┘
             │
             ▼
  ┌─────────────────────┐
  │   Post-Processing   │ ← Emit completion signal if needed; update metrics
  └─────────────────────┘
```

### Lifecycle Phases

| Phase | Description |
|---|---|
| **Emission** | A source emits an event to the `EventDispatcher` |
| **Enqueue** | The `EventDispatcher` places the event in the priority queue |
| **Middleware** | The event passes through the middleware pipeline — may be cancelled here |
| **Context Build** | The raw payload is enriched into a full `EventContext` |
| **Subscriber Lookup** | All registered handlers for the event type are resolved |
| **Delivery** | Each handler receives the event in isolation |
| **Collection** | Handler outcomes are aggregated and errors recorded |
| **Post-Processing** | Completion signals emitted, metrics updated |

---

## 3. Event Sources

An event source is any component authorized to emit events into the `EventDispatcher`. Sources vary in their origin, their event types, and their trust level.

### 3.1 Facebook Layer Sources

The Facebook Layer is the origin of all inbound external events. Events from this source represent things that happened on the Facebook platform and were received through the active Facebook connection.

| Event Type | Description |
|---|---|
| `facebook.message.received` | A new message arrived in a conversation |
| `facebook.message.delivered` | A previously sent message was confirmed delivered |
| `facebook.message.read` | A previously sent message was read |
| `facebook.typing.started` | A contact began typing |
| `facebook.typing.stopped` | A contact stopped typing |
| `facebook.presence.online` | A contact came online |
| `facebook.presence.offline` | A contact went offline |
| `facebook.reaction.added` | A reaction was added to a message |
| `facebook.reaction.removed` | A reaction was removed from a message |

All Facebook Layer events enter the system exclusively through `EventDispatcher`. Per `10-facebook-architecture.md`, no Facebook event bypasses the `EventDispatcher` to reach any other component directly.

### 3.2 Core System Sources

Core components emit internal events to signal state changes within the system. These events describe transitions in the system's own condition — not events from external platforms.

| Event Type | Description |
|---|---|
| `system.connection.established` | A Facebook connection was successfully established |
| `system.connection.lost` | A Facebook connection was lost |
| `system.connection.restored` | A Facebook connection was restored after an interruption |
| `system.session.created` | A new Facebook session was created |
| `system.session.expired` | A session reached its expiry |
| `system.session.invalidated` | A session was forcibly invalidated |
| `system.session.refreshed` | A session was successfully refreshed |
| `system.plugin.loaded` | A plugin was successfully loaded and activated |
| `system.plugin.disabled` | A plugin was disabled |
| `system.plugin.failed` | A plugin failed during loading or initialization |

### 3.3 Plugin Sources

Plugins may emit events through their Plugin Context. Plugin-emitted events are namespaced under the plugin's ID (`plugin.<pluginId>.<eventName>`) to prevent collision with Core events.

Plugins may only emit event types that were declared in their manifest's `supportedEvents` field. Attempting to emit an undeclared event type is rejected by the `EventDispatcher`.

### 3.4 Source Trust Levels

Not all event sources are equally trusted. The `EventDispatcher` assigns a trust level to each event based on its source:

| Source | Trust Level | Implications |
|---|---|---|
| Facebook Layer | `trusted` | Events are processed without additional source validation |
| Core components | `trusted` | Events are processed without additional source validation |
| Plugins | `sandboxed` | Events are subject to plugin permission checks before acceptance |
| External (future) | `external` | Events require signature verification before acceptance |

---

## 4. Event Dispatcher

The `EventDispatcher` is the central hub of the event system. It is the sole authority over event routing, delivery ordering, and handler management.

### 4.1 Single Instance

There is exactly one `EventDispatcher` in the system. It is not replicated, not partitioned, and not distributed across multiple instances within a single process. All event emission and all handler registration flow through this single instance.

### 4.2 Responsibilities

The `EventDispatcher` is solely responsible for:
- Receiving events from authorized sources
- Enqueuing events in priority order
- Running events through the middleware pipeline
- Building the `EventContext` for each event
- Resolving registered handlers for each event type
- Delivering events to handlers in isolated execution contexts
- Collecting handler outcomes
- Maintaining the subscriber registry

### 4.3 What the EventDispatcher Does Not Do

The `EventDispatcher` must not:
- Process event content — it routes events; it does not interpret them
- Apply business logic based on event type — that is the handlers' responsibility
- Store events permanently — it delivers and releases
- Guarantee handler delivery across process restarts — the queue is in-memory

### 4.4 Subscriber Registry

The subscriber registry is the `EventDispatcher`'s record of all registered handler subscriptions. For each event type, it records:
- The list of subscribed handlers, in priority order
- The subscriber's identity (Core component name or plugin ID)
- The subscription options (filter conditions, priority override)

The subscriber registry is modified only through the `EventDispatcher`'s registration interface. No component may directly modify the registry.

### 4.5 Registration Interface

Handler registration occurs through:
- Core component registration: called during system initialization
- Plugin registration: called through the Plugin Context during plugin initialization
- Dynamic registration: an authorized component may register or deregister at runtime

All registrations are recorded in the subscriber registry with their source identity. Registrations made during a plugin's lifecycle are automatically deregistered when the plugin is disabled or uninstalled.

---

## 5. Event Queue

The event queue is the buffer between event emission and event delivery. It decouples the rate of event arrival from the rate of handler execution.

### 5.1 The Queue Is Priority-Ordered

Events are not processed in strict arrival order — they are processed in priority order. Within the same priority level, events are processed in arrival order (FIFO). This ensures that high-priority events (connection state changes, security events) are delivered ahead of lower-priority events (presence updates, typing indicators) even when they arrive later.

### 5.2 Queue Isolation by Event Category

Certain event categories are isolated into separate queue partitions to prevent one category from starving another:

| Queue Partition | Event Categories | Purpose |
|---|---|---|
| **Critical queue** | System events, connection events | Ensures critical state changes are never delayed |
| **Standard queue** | Message events, session events | Primary operational queue |
| **Low-priority queue** | Presence events, typing events, plugin events | Processed when standard queue is drained |

Each partition is processed independently. Critical queue events are always dequeued before standard queue events, regardless of arrival time.

### 5.3 Queue Depth Limits

Each queue partition has a maximum depth. When a queue reaches its maximum depth:
- New events for that queue are subject to the overflow policy
- The overflow policy is one of: `drop-oldest`, `drop-newest`, `reject-emission`
- The overflow condition is immediately signaled to the monitoring system

A queue that grows without bound is a sign of handler processing being slower than event arrival — an architectural concern that must be investigated and resolved.

### 5.4 Queue Draining on Shutdown

When the system receives a shutdown signal, the queue transitions to draining mode:
- No new events are accepted
- Existing events are processed up to a drain timeout
- Events that cannot be processed within the drain timeout are discarded
- The queue size at drain time is logged for operational awareness

### 5.5 Queue Is In-Memory

The event queue is in-memory and not persisted. Events that are in the queue when the process crashes are lost. The system is designed to tolerate this — the Facebook Layer will re-deliver some events through reconnection; others are ephemeral by nature (typing indicators, presence events) and losing them is acceptable.

---

## 6. Event Context

The `EventContext` is the enriched, structured description of an event that is provided to handlers. It is distinct from the raw event payload emitted by the source.

### 6.1 Context Construction

The raw event payload contains only what the source knew at emission time. The `EventContext` adds:
- Resolved account and conversation context (if applicable to the event type)
- Timestamp of receipt by the `EventDispatcher`
- Timestamp of emission by the source
- A unique event ID (for correlation and deduplication)
- The source identity and trust level
- The event's position in the processing sequence

### 6.2 Context Contents

| Field | Description |
|---|---|
| `eventId` | Unique identifier for this event instance — globally unique within the process lifetime |
| `eventType` | The event type name (e.g., `facebook.message.received`) |
| `source` | Identity of the emitting component — Facebook Layer, Core component name, or plugin ID |
| `trustLevel` | The trust classification of the source |
| `emittedAt` | Timestamp when the source emitted the event |
| `receivedAt` | Timestamp when the `EventDispatcher` received the event |
| `queuedAt` | Timestamp when the event was placed in the queue |
| `deliveredAt` | Timestamp when delivery to this handler began |
| `payload` | The typed event payload — the data specific to this event type |
| `accountContext` | The Void account context, if the event is account-scoped |
| `conversationContext` | The conversation context, if the event is conversation-scoped |
| `correlationId` | Links this event to a broader operation chain (e.g., a command that triggered it) |
| `priority` | The resolved priority level at which this event is being delivered |

### 6.3 Context Is Read-Only

Handlers receive the `EventContext` as a read-only structure. Handlers may not modify any field of the `EventContext`. If a handler needs to annotate an event for its own processing, it uses local variables — not the context.

### 6.4 Context Is Handler-Scoped

Each handler receives its own view of the `EventContext`. While the underlying event data is the same for all handlers, the `deliveredAt` timestamp is specific to each handler's invocation. Modifications to local handler state do not bleed into other handlers' context views.

---

## 7. Event Priority

Priority determines the order in which events are dequeued and delivered when multiple events are waiting.

### 7.1 Priority Levels

| Level | Name | Used For |
|---|---|---|
| 0 | `critical` | Connection state changes, session invalidation, security events |
| 1 | `high` | Inbound Facebook messages, authentication events |
| 2 | `standard` | Message delivery receipts, read receipts, session refresh events |
| 3 | `low` | Presence events, typing indicators, plugin-defined events |
| 4 | `background` | Analytics events, metrics collection, cleanup signals |

### 7.2 Default Priority by Event Category

Each event type has a default priority defined in the event type registry. Sources that emit an event may not override its default priority downward — they may request a higher priority if justified, but the `EventDispatcher` validates and caps priority requests.

Plugin events default to `low` priority. Plugins may not request `critical` or `high` priority — those levels are reserved for Core events.

### 7.3 Priority Is Not a Bypass

Priority determines dequeue order — it does not bypass the middleware pipeline, skip handler isolation, or modify delivery behavior in any other way. A `critical` priority event still passes through all middleware. Its handlers are still isolated. Its errors are still caught.

### 7.4 Priority Starvation Prevention

Lower-priority queues must not be completely starved by continuous high-priority event arrival. The `EventDispatcher` implements a weighted dequeue strategy: after delivering N high-priority events, it delivers at least one lower-priority event before returning to high-priority. The weight ratio is configurable.

---

## 8. Event Cancellation

Cancellation is the mechanism by which a middleware component or a high-priority handler can prevent an event from being delivered to subsequent subscribers.

### 8.1 Cancellation Is a Middleware Power

Cancellation is primarily a middleware capability. Middleware that determines an event should not be delivered — because it violates a rate limit, because it is a duplicate, because it fails a security check — cancels the event. Cancelled events are not delivered to any handler.

### 8.2 Handler-Level Cancellation

Handlers may signal cancellation to prevent delivery to subsequent lower-priority handlers of the same event. Handler cancellation is opt-in — only handlers that are explicitly designed as cancellable interceptors may do this. Most handlers do not and should not attempt to cancel event propagation.

### 8.3 Cancellation Is Not Rollback

Cancelling an event stops its forward propagation — it does not undo side effects produced by handlers that already executed before cancellation was signalled. Cancellation is a delivery control mechanism, not a transaction control mechanism.

### 8.4 Cancellation Must Be Logged

Every event cancellation — whether by middleware or by a handler — must be logged with:
- The event ID
- The event type
- The cancelling component's identity
- The reason for cancellation

Unexplained cancellations are operational anomalies that must be visible to operators.

### 8.5 Core Events Cannot Be Cancelled by Plugin Handlers

Plugins may not cancel Core events. A plugin handler that signals cancellation for a Core event type has its cancellation signal silently discarded. Core event propagation is not subject to plugin interference.

---

## 9. Event Propagation

Propagation describes how an event moves from the queue through the middleware and then through the ordered list of subscribers.

### 9.1 Propagation Is Sequential Within Priority

Within a single event's delivery, handlers are invoked in the order determined by their registration priority. A handler registered at priority 1 runs before a handler registered at priority 5. If a handler at priority 2 signals cancellation, handlers at priority 3 and beyond do not receive the event.

### 9.2 Propagation Is Not Parallel by Default

Handlers for a single event are invoked sequentially by default — in priority order. Parallel delivery (all handlers invoked simultaneously) is available for specific event types where:
- Handler independence is guaranteed (no handler can affect another's processing)
- Completion time is more important than ordered execution
- All handlers are read-only with respect to the event

Parallel delivery must be explicitly declared in the event type's configuration. It is not the default.

### 9.3 Event Propagation Across System Boundaries

When an event crosses a system boundary — from Core to Plugin — the `EventDispatcher` enforces the boundary:
- The event is provided to plugins only if they hold the appropriate subscription permission
- The event payload is filtered to exclude fields that plugins are not permitted to see
- The event trust level is adjusted to reflect the cross-boundary context

### 9.4 No Event Loops

An event handler must not emit the same event type it is handling. An event loop — where handling `event.X` causes `event.X` to be emitted again — produces infinite recursion. The `EventDispatcher` detects same-type re-emission within the same propagation chain and rejects it with an error.

---

## 10. Middleware Integration

Event middleware applies cross-cutting concerns uniformly to every event before it reaches handlers.

### 10.1 Middleware Chain for Events

Every event passes through the following middleware chain, in order:

| Position | Middleware | Purpose |
|---|---|---|
| 1 | **Source Validator** | Verify the emitting source is authorized to emit this event type |
| 2 | **Deduplication Filter** | Detect and discard duplicate events (same event ID or same payload hash within a window) |
| 3 | **Rate Limiter** | Enforce per-event-type and per-source emission rate limits |
| 4 | **Cancellation Checker** | Check whether the event type or source is currently suppressed |
| 5 | **Audit Logger** | Record the event's receipt and metadata for the audit trail |
| 6 | **Context Builder** | Enrich the raw payload into a full `EventContext` |

### 10.2 Middleware Cannot Access Event Content

Middleware operates on event metadata — event type, source, timestamps, event ID, trust level. It does not process the event payload's content. A middleware that needs to inspect payload content has absorbed business logic and must be refactored.

### 10.3 Middleware Execution Is Bounded

Each middleware component must complete within a defined timeout. A slow middleware component delays every event in the system. Middleware that performs I/O must use asynchronous patterns.

### 10.4 Custom Middleware for Event Types

Specific event types may declare additional middleware in the event type registry. This allows event-type-specific concerns (specialized deduplication for message events, specialized rate limiting for Facebook events) without cluttering the global middleware chain.

---

## 11. Plugin Events

Plugin events are events emitted by plugins and consumed by the rest of the system through the standard event pipeline.

### 11.1 Plugin Events Are Namespaced

Plugin events are named `plugin.<pluginId>.<eventName>`. This namespace prevents collision with Core event types. The `EventDispatcher` validates the namespace on every plugin-emitted event — a plugin emitting an event without its own namespace prefix is rejected.

### 11.2 Plugin Events Are Declared in Advance

A plugin may only emit event types that were declared in its manifest's `supportedEvents` field. Undeclared event types are rejected at emission time. This prevents plugins from emitting unexpected events to intercept or manipulate the system's behavior.

### 11.3 Plugin Events Require Permission

Emitting events requires the `events.publish.<namespace>` permission. A plugin that did not declare this permission cannot emit events. The `EventDispatcher` enforces this at the call site.

### 11.4 Plugin Events Are Delivered to All Eligible Subscribers

Plugin events are delivered to all subscribers — both Core components and other plugins — that have subscribed to the event type and hold the necessary `events.subscribe.*` permission. The `EventDispatcher` does not treat plugin events differently in delivery — the source is metadata, not a delivery modifier.

### 11.5 Plugin Events Are Low Trust

Plugin events carry `sandboxed` trust. Subscribers that conditionally act on trust levels must treat plugin events as untrusted input — not as authoritative signals from the Core.

---

## 12. Internal Events

Internal events are emitted by Core components to communicate state changes within the system.

### 12.1 Internal Events Are Core-Only by Default

Internal events are emitted and consumed within the Core. They are not published to plugins by default. A plugin that subscribes to a Core internal event receives it only if:
- The event type is designated as externally visible in the event type registry
- The plugin holds the corresponding subscription permission

### 12.2 Internal Events Communicate Facts, Not Commands

A Core component emits an internal event to announce that something happened — not to instruct another component to do something. `system.session.expired` announces expiry; it does not instruct `ReconnectManager` to reconnect. `ReconnectManager` subscribes to this event and decides independently what to do.

### 12.3 Internal Event Payload Standards

Internal event payloads follow a strict schema defined per event type in the event type registry. Adding fields to a payload is a backward-compatible change. Removing or renaming fields is a breaking change that requires an event type version bump.

---

## 13. System Events

System events are a subset of internal events that describe the highest-level state transitions — connection changes, session lifecycle milestones, and security events.

### 13.1 System Event Characteristics

System events are distinguished by:
- Priority `critical` or `high` — they are processed before most other events
- Mandatory audit logging — every system event is written to the audit log
- Mandatory monitoring signal — every system event updates the health monitoring dashboard
- Restricted subscription — only components with explicit authorization may subscribe to system events

### 13.2 System Event Catalog

| Event | Priority | Description |
|---|---|---|
| `system.connection.established` | `critical` | A Facebook connection has been successfully established |
| `system.connection.lost` | `critical` | A Facebook connection has been lost — reconnect process begins |
| `system.connection.restored` | `critical` | A Facebook connection has been restored after interruption |
| `system.connection.failed` | `critical` | All reconnect attempts have been exhausted — operator action required |
| `system.session.created` | `high` | A new Facebook session has been created |
| `system.session.expired` | `high` | A session has expired — re-authentication required |
| `system.session.invalidated` | `critical` | A session was forcibly invalidated |
| `system.session.refreshed` | `standard` | A session was successfully refreshed |
| `system.security.violation` | `critical` | A security constraint was violated — immediate operator notification |

### 13.3 System Events Are Immutable After Emission

Once a system event is emitted, its payload cannot be modified or retracted. It is a permanent record of what happened and when. If subsequent processing reveals the event was erroneous (e.g., a false connection-lost detection), a corrective system event is emitted — the original is not retracted.

---

## 14. Error Handling

### 14.1 Handler Errors Are Isolated

A handler that throws an unhandled error does not affect:
- Other handlers subscribed to the same event
- The `EventDispatcher`'s ability to process subsequent events
- The Core system's operation

The `EventDispatcher` wraps each handler invocation in an error boundary. An error from Handler A is caught, logged, and attributed to Handler A. Handler B still receives the event.

### 14.2 Error Classification for Event Handlers

| Error Type | Description | Response |
|---|---|---|
| **Transient handler error** | Handler threw due to a temporary condition (service unavailable, timeout) | Log at `warn`; record in handler error counter |
| **Logic error** | Handler threw due to a bug or unexpected input | Log at `error`; increment error counter |
| **Resource error** | Handler exceeded memory, time, or I/O limits | Log at `error`; apply resource enforcement |
| **Security violation** | Handler attempted a forbidden operation | Log at `error`; disable the plugin if plugin handler; immediate alert |

### 14.3 Error Rate Monitoring for Handlers

The `EventDispatcher` tracks error rates per handler (identified by subscriber identity and event type). When a handler's error rate exceeds the configured threshold:
- The handler is temporarily suspended — it stops receiving events
- The operator is notified
- After a cooling period, the handler resumes if the error rate has recovered

### 14.4 Middleware Errors

A middleware component that throws an error causes the event to be dropped — it does not reach handlers. This is conservative by design: an event that cannot safely pass through middleware must not reach handlers in an unknown state. Middleware errors are logged at `error` level and trigger a monitoring alert.

### 14.5 Queue Overflow as an Error Condition

When the event queue reaches its maximum depth, the overflow is an error condition — not a normal operational state. It triggers:
- Immediate monitoring alert
- Application of the overflow policy (drop-oldest, drop-newest, or reject-emission)
- Logging of the dropped events (event type, event ID, source) for forensic review

---

## 15. Performance

### 15.1 Emission Must Be Non-Blocking for the Source

When a component emits an event, it must complete the emission call without waiting for handlers to finish. Emission enqueues the event and returns immediately. A source that blocks on event emission is a source that can be deadlocked by slow handlers.

### 15.2 Handler Execution Is Time-Bounded

Every handler invocation is subject to a per-handler timeout. A handler that does not complete within its timeout is terminated. The timeout is configured per event type and may be overridden per handler registration.

| Event Category | Default Handler Timeout |
|---|---|
| Critical system events | 500ms |
| Standard message events | 2000ms |
| Low-priority events | 5000ms |
| Background events | 10000ms |

### 15.3 Handlers Must Not Block the Event Loop

Handlers that perform synchronous blocking operations — synchronous file I/O, synchronous network calls, CPU-intensive loops — block the runtime's event loop and delay all other processing. All handler I/O must be asynchronous.

### 15.4 High-Frequency Events Require Lightweight Handlers

Some event types (typing indicators, presence updates) may be emitted hundreds of times per minute. Handlers subscribed to these events must be extremely lightweight — microseconds of processing, not milliseconds. Handlers that need to do real work in response to high-frequency events must debounce or batch the work outside the handler.

### 15.5 Subscriber Count Affects Delivery Time

Each subscriber adds to the total delivery time for an event. A single event with fifty subscribers takes fifty times as long to fully deliver as one with one subscriber. Plugin authors must be selective about which events they subscribe to. The `EventDispatcher` must expose per-event-type subscriber count as an observable metric.

### 15.6 Event Deduplication Is Fast

The deduplication middleware must use an O(1) lookup structure (bloom filter, hash set with TTL) — not a linear scan through recent events. Deduplication that scales linearly with event volume will degrade performance as load increases.

---

## 16. Event Isolation

Isolation ensures that events from one source, and handlers belonging to one component, do not interfere with those of another.

### 16.1 Account-Level Isolation

Events that are scoped to a specific Facebook account must not be delivered to handlers operating in the context of a different account. The `EventContext` carries the account context. The `EventDispatcher` verifies account scope alignment before delivering to each handler.

A handler registered by an account's operator plugin must not receive events belonging to a different account's conversation — even if both conversations are active simultaneously.

### 16.2 Handler State Isolation

Handler state — local variables, closures — is isolated to that handler's invocation. Handlers do not share mutable state through the event system. If two handlers need to share information, they must do so through a Service or a storage layer — not through event payload mutation or shared closures.

### 16.3 Plugin Handler Isolation

Plugin handlers execute within the plugin's isolation boundary. An unhandled error in a plugin handler does not reach the `EventDispatcher`'s core processing loop. The error boundary is enforced by the Plugin Manager's execution wrapper, which wraps every plugin callback before delivering to the handler.

### 16.4 Cross-Plugin Event Boundaries

When a plugin subscribes to another plugin's events, the delivery crosses a plugin boundary. The `EventDispatcher` enforces:
- The subscribing plugin holds the appropriate subscription permission
- The event payload is filtered to remove fields the subscribing plugin is not authorized to see
- The subscribing plugin's handler error does not affect the emitting plugin's operation

---

## 17. Best Practices

1. **Keep handlers focused on a single concern.** A handler that responds to a message received event should process messages — not also update presence, trigger analytics, and send acknowledgements. Each concern belongs in a separate handler.

2. **Make handlers idempotent.** The same event may be delivered more than once under abnormal conditions (reconnection, replay). A handler that produces different effects when called twice for the same event creates inconsistent state.

3. **Subscribe at the most specific event type available.** Subscribing to a broad event type and filtering by payload content in the handler is less efficient than subscribing to the specific sub-type directly. Prefer specific subscriptions.

4. **Deregister subscriptions when they are no longer needed.** A subscription that outlives the component that registered it continues consuming delivery resources and may produce errors when its handler is invoked. Components that register subscriptions dynamically must deregister them explicitly when done.

5. **Use correlation IDs.** Every handler should log the `correlationId` from the `EventContext`. This allows a complete event processing chain to be reconstructed from logs when debugging an incident.

6. **Design for late subscribers.** The system must work correctly even if a subscriber registers after some events of a type have already been delivered. Do not design workflows that assume every subscriber was registered before the first event arrived.

7. **Treat plugin events as untrusted input.** A Core handler that subscribes to plugin events must validate the payload before acting on it. Plugin events carry `sandboxed` trust — their payloads may contain invalid data.

8. **Monitor handler error rates.** A handler whose error rate is rising is a signal of a developing problem — degraded dependency, changing event format, resource exhaustion. Monitor error rates per handler, not just aggregate error counts.

---

## 18. Anti-Patterns

### 18.1 The Direct Handler Call

A component that bypasses the `EventDispatcher` and calls another component's event handler function directly. This defeats isolation, skips middleware, bypasses the subscriber registry, and creates tight coupling. Event propagation must always go through the `EventDispatcher`.

### 18.2 The Omnibus Subscriber

A single handler that subscribes to every event type and routes internally based on `eventType`. This pattern produces a handler that becomes a second, unofficial dispatcher — with no middleware, no priority ordering, no isolation, and no subscriber registry. Each subscription must be registered separately.

### 18.3 The Mutable Event

A handler that casts the `EventContext` to a mutable type and modifies fields before allowing propagation to continue. Events are immutable records. Modifying them produces different realities for different subscribers — a fundamental correctness violation.

### 18.4 The Synchronous Waterfall

A handler that, upon receiving an event, synchronously emits another event and waits for all that event's handlers to complete before returning. This creates a synchronous chain through the event system, which is designed to be asynchronous. Deep synchronous waterfalls exhaust the call stack and produce unpredictable ordering.

### 18.5 The State-Carrying Handler Module

A handler module that maintains state across invocations using module-level variables. When two events of the same type arrive concurrently, they share this state — producing race conditions. Handler invocations must be stateless; state lives in Services.

### 18.6 The Priority Abuser

A plugin that requests `critical` priority for all its events to ensure they are always processed first. Priority is a system resource — overuse by one source degrades the system for all others. Plugin events are `low` priority by default; this is a design constraint, not a preference.

### 18.7 The Missing Deregistration

A component that registers a subscription and never deregisters it, even after the component shuts down or the subscription's purpose has ended. Orphaned subscriptions consume delivery resources and produce delivery errors (the handler no longer exists) that pollute error logs.

---

## 19. Forbidden Event Practices

The following practices are categorically forbidden and must be rejected in code review.

### 19.1 Bypassing the EventDispatcher

Any code that delivers an event to a handler without going through the `EventDispatcher` is an architectural violation of the highest order. There is no legitimate reason to bypass the `EventDispatcher`. "Urgency" is not a valid justification — the critical priority queue exists for urgent events.

### 19.2 Calling Handler Functions Directly

Handler functions are not public APIs. They are registered callbacks. A component that imports another component's handler function and calls it directly bypasses the middleware pipeline, the subscriber registry, the isolation boundary, and the error handling layer. Direct handler calls are forbidden without exception.

### 19.3 Emitting Undeclared Event Types from Plugins

A plugin that emits an event type not declared in its manifest is attempting to inject signals into the system that were not reviewed at installation time. The `EventDispatcher` rejects undeclared plugin event types. Any workaround to bypass this check is doubly forbidden.

### 19.4 Modifying the Event Context

Any modification to the `EventContext` after it has been provided to a handler — including mutations made by the handler itself — is forbidden. The `EventContext` is a read-only snapshot. Modifications produce inconsistent views for other handlers.

### 19.5 Creating an Infinite Emission Loop

A handler that emits the same event type it is handling produces an infinite loop. The `EventDispatcher` detects and rejects this pattern — but writing code that would create this loop is itself a violation, regardless of whether the detection fires.

### 19.6 Subscribing to System Events from Plugins Without Authorization

System events (Section 13) are restricted-access. A plugin that subscribes to system events without being granted the corresponding permission is attempting unauthorized access to sensitive system state. The `EventDispatcher` rejects unauthorized subscriptions; code that attempts such a subscription is a policy violation.

### 19.7 Implementing a Shadow Dispatcher

Any component that maintains its own subscription registry and routes events to handlers outside the `EventDispatcher` is a shadow dispatcher — a second event routing system that operates without middleware, monitoring, or access control. Shadow dispatchers are categorically forbidden.

---

## 20. AI Event Rules

This section defines how an AI system must reason about the event system when developing within Void.

### 20.1 All Event Interactions Go Through the EventDispatcher

When generating code that needs to react to something that happened in the system, the AI must:
1. Identify the appropriate event type in the event catalog
2. Register a subscription through the `EventDispatcher`'s registration interface (or through the Plugin Context for plugin code)
3. Write a handler function that receives the `EventContext`

The AI must never generate code that calls another component's method as a substitute for subscribing to the event that component emits.

### 20.2 The AI Must Not Generate Direct Handler Calls

When the AI identifies that component A needs to notify component B that something happened, the correct pattern is always emission followed by subscription — never a direct function call to B's handler. If B's handler is not accessible through the subscription mechanism, the AI must identify this as a design gap and propose a proper event type, not a workaround.

### 20.3 Verify Event Type Exists Before Subscribing

Before generating a subscription, the AI must verify that the event type exists in the event catalog. If the event type does not exist, the AI must:
1. Determine whether the event type should be added to the catalog
2. Propose the new event type definition — name, payload schema, default priority, trust level
3. Wait for the event type to be approved and added to the catalog
4. Only then generate the subscription code

The AI must not generate subscriptions to event types that do not exist, with the expectation that the type will be defined later.

### 20.4 Handler Timeout Awareness

When generating handler code, the AI must be aware of the handler timeout for the event type's category. If the handler's intended work cannot reasonably complete within the timeout, the AI must restructure the handler to initiate work asynchronously and return within the timeout — not simply write the handler and leave the timeout concern unaddressed.

### 20.5 Idempotency Consideration

When generating handlers for events that could be delivered more than once (all events, in principle), the AI must consider whether the handler's behavior is idempotent. If it is not, the AI must either make it idempotent or explicitly document why non-idempotency is acceptable and how it is managed.

### 20.6 Plugin Event Namespace Enforcement

When generating plugin code that emits events, the AI must use the correct namespace: `plugin.<pluginId>.<eventName>`. The AI must also verify that the event type is declared in the plugin's manifest before generating the emission call.

### 20.7 Account Isolation in Handlers

When generating handler code that responds to account-scoped events, the AI must ensure the handler uses `eventContext.accountContext` to scope its operations to the correct account. Generating handlers that act on account-scoped events without verifying account context is an isolation violation.

### 20.8 When the Event System Must Be Extended

If a feature requires a new event type, a new subscription permission, or a modification to the middleware pipeline, the AI must:
1. Identify the gap in the current design
2. Propose the extension — new event type definition, new permission name, middleware changes
3. Wait for approval
4. Update this document and the event type catalog
5. Only then implement the feature

Event system extensions that are not reflected in this document are undocumented architectural decisions.

---

## 21. Review Checklist

Use this checklist for every code review that introduces or modifies event system code.

### Event Emission
- [ ] Events are emitted through the `EventDispatcher` — never by calling handlers directly
- [ ] The event type exists in the event type catalog
- [ ] Plugin events use the correct namespace prefix (`plugin.<pluginId>.`)
- [ ] Plugin events are declared in the plugin's manifest `supportedEvents`
- [ ] The emitting component holds the `events.publish.*` permission (for plugins)
- [ ] Emission is non-blocking — the source does not wait for handler completion

### Event Subscription
- [ ] Subscriptions are registered through the `EventDispatcher`'s registration interface
- [ ] The event type being subscribed to exists in the catalog
- [ ] The subscribing component holds the `events.subscribe.*` permission (for plugins)
- [ ] A deregistration path exists — subscriptions are cleaned up when the component shuts down
- [ ] System event subscriptions are authorized

### Handler Design
- [ ] The handler function does not call other handlers directly
- [ ] The handler does not modify the `EventContext`
- [ ] The handler is stateless — no module-level or closure-captured mutable state
- [ ] The handler does not emit the same event type it is handling
- [ ] The handler completes within the timeout for its event category
- [ ] Slow work is initiated asynchronously — the handler returns quickly
- [ ] The handler is idempotent, or non-idempotency is explicitly justified

### Account and Context Isolation
- [ ] Account-scoped event handlers verify account context before acting
- [ ] No cross-account state access is present in handlers
- [ ] Plugin handlers are isolated — errors do not propagate to the EventDispatcher

### Error Handling
- [ ] Handler errors are not suppressed — they propagate to the EventDispatcher's error boundary
- [ ] The handler logs the `correlationId` for tracing
- [ ] Error paths produce meaningful log entries

### Plugin Events
- [ ] Plugin events are treated as untrusted input by subscribing Core handlers
- [ ] Plugin event payloads are validated before being acted upon
- [ ] Plugin handlers do not attempt to cancel Core events

### System Events
- [ ] System event subscriptions are authorized
- [ ] New system events are documented in Section 13.2 before implementation
- [ ] System event payloads follow the established schema

---

*This document is the official and sole architectural reference for the Void event system. All event emission, subscription, handler design, and middleware decisions must comply with the architecture defined here. Events enter the system through the `EventDispatcher` exclusively — no exceptions. Handlers are called by the `EventDispatcher` — never directly. This document must be consulted before writing any code that produces, consumes, or routes events within Void.*
