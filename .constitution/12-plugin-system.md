# 12 — Plugin System Architecture

> **Status:** Official  
> **Scope:** All plugin-related design decisions in Void — plugin discovery, registration, loading, initialization, execution, communication, isolation, versioning, security, and removal  
> **Authority:** This document is the single source of truth for the plugin system architecture in Void. No plugin subsystem code may be written, modified, or deleted without consulting this document. New plugin capabilities require updating this document before implementation.

---

## Table of Contents

1. [Plugin Philosophy](#1-plugin-philosophy)
2. [Plugin Objectives](#2-plugin-objectives)
3. [Plugin Lifecycle](#3-plugin-lifecycle)
4. [Plugin Registration](#4-plugin-registration)
5. [Plugin Discovery](#5-plugin-discovery)
6. [Plugin Loading](#6-plugin-loading)
7. [Plugin Initialization](#7-plugin-initialization)
8. [Plugin Context](#8-plugin-context)
9. [Plugin Metadata](#9-plugin-metadata)
10. [Plugin Configuration](#10-plugin-configuration)
11. [Plugin Permissions](#11-plugin-permissions)
12. [Plugin Dependencies](#12-plugin-dependencies)
13. [Plugin Isolation](#13-plugin-isolation)
14. [Plugin Communication](#14-plugin-communication)
15. [Plugin Events](#15-plugin-events)
16. [Plugin Services](#16-plugin-services)
17. [Plugin Resource Management](#17-plugin-resource-management)
18. [Plugin Shutdown](#18-plugin-shutdown)
19. [Plugin Reload Strategy](#19-plugin-reload-strategy)
20. [Plugin Versioning](#20-plugin-versioning)
21. [Plugin Compatibility](#21-plugin-compatibility)
22. [Plugin Security](#22-plugin-security)
23. [Plugin Error Handling](#23-plugin-error-handling)
24. [Plugin Performance](#24-plugin-performance)
25. [Best Practices](#25-best-practices)
26. [Anti-Patterns](#26-anti-patterns)
27. [Forbidden Plugin Practices](#27-forbidden-plugin-practices)
28. [AI Plugin Rules](#28-ai-plugin-rules)
29. [Review Checklist](#29-review-checklist)

---

## 1. Plugin Philosophy

### 1.1 The Plugin Contract

A plugin is an independent, self-contained unit that adds a specific capability to Void without modifying the Core. This is not merely a design preference — it is the foundational contract that makes the plugin system viable. The moment a plugin must modify Core to function, the plugin system has failed its primary purpose.

The plugin contract has two sides:

**Core's obligation to plugins:** The Core exposes a stable, well-defined set of interfaces — a Plugin API — through which plugins may request services, subscribe to events, and interact with the system. This API is versioned, documented, and backward-compatible within a major version. Plugins may rely on this API without knowing how the Core works internally.

**Plugins' obligation to Core:** A plugin operates exclusively through the Plugin API. It does not access internal Core components directly. It does not assume anything about Core's internal structure. It does not modify global state. It does not reach into layers that are not exposed to it. A plugin that violates this contract is not a plugin — it is a patch.

### 1.2 Extension Without Modification

The Open-Closed Principle applied at the system level: the Core is open for extension through plugins, and closed to direct modification by plugins. A plugin that needs to change how the Core works in order to add its feature is a signal that the Plugin API needs to be extended — not that the plugin should be allowed to modify the Core.

### 1.3 Isolation as a Design Requirement

Every plugin operates within an isolation boundary. A plugin that crashes must not crash the Core. A plugin that consumes excessive resources must not starve other plugins or the Core. A plugin that produces incorrect output must not corrupt Core state. Isolation is what makes it safe to extend the system with third-party or user-developed plugins.

### 1.4 Plugins Are Guests

A plugin is a guest in the Void system. The Core is the host. The host defines the rules: what resources the guest may use, which rooms the guest may enter, and what happens when the guest misbehaves. The guest does not rewrite the house rules — it works within them.

### 1.5 Capability Through Composition

Powerful plugin behavior is achieved by composing the capabilities offered by the Plugin API — subscribing to events, invoking services, publishing results. A plugin that needs to bypass the Plugin API to achieve its goal is attempting to do something the system was not designed to support. Before bypassing the API, the correct question is: should the Plugin API be extended to support this capability?

---

## 2. Plugin Objectives

The plugin system is designed to achieve the following concrete goals:

### 2.1 Core Integrity
No plugin may modify, corrupt, or interfere with Core behavior. The Core must behave identically whether zero plugins are loaded or one hundred plugins are loaded (within resource limits).

### 2.2 Capability Extensibility
New message processing behaviors, integrations, automated responses, content transformations, and operational tools can be added via plugins without touching the Core codebase.

### 2.3 Failure Isolation
A plugin failure — crash, timeout, resource exhaustion, logic error — is contained within the plugin's isolation boundary. It must not propagate to the Core or to other plugins.

### 2.4 Operational Manageability
Plugins can be installed, enabled, disabled, updated, and removed without restarting the Core. The system can manage its plugin inventory dynamically.

### 2.5 Security Enforcement
The permission system ensures that plugins access only the capabilities they declared they need. A plugin that did not declare permission to read message history cannot read message history, regardless of what its code attempts.

### 2.6 Stable Extension Points
Plugin developers can build against a stable Plugin API that does not change unexpectedly. The Plugin API is versioned and changes are managed with backward compatibility in mind.

---

## 3. Plugin Lifecycle

Every plugin progresses through a defined set of lifecycle states. The plugin system enforces this lifecycle — no state may be skipped and no unauthorized transitions occur.

```
         ┌──────────────────────────────────────────────────────┐
         │                                                      │
         ▼                                                      │
    [UNDISCOVERED]                                              │
         │                                                      │
    Discovery scan                                              │
         │                                                      │
         ▼                                                      │
    [DISCOVERED]                                                │
         │                                                      │
    Validation passes                                           │
         │                                                      │
         ▼                                                      │
    [REGISTERED]                                                │
         │                                                      │
    Load requested                                              │
         │                                                      │
         ▼                                                      │
     [LOADING] ─── Load fails ──────────────────────► [FAILED]
         │                                                │
    Load succeeds                                   (remains)
         │
         ▼
   [LOADED] ─── Init fails ──────────────────────────► [FAILED]
         │
    Init succeeds
         │
         ▼
    [ACTIVE] ◄─────────────── Reload succeeds ──── [RELOADING]
         │                                              ▲
         ├── Disable requested ───────────────► [DISABLING]    │
         │         │                                │           │
         │    Disable complete                      │           │
         │         └────────────────────────► [DISABLED]       │
         │                   │                                  │
         │              Enable requested                        │
         │                   └─────────────────────────────────┘
         │
         ├── Reload requested ────────────────────── [RELOADING]
         │
         └── Uninstall requested ──────────────► [UNINSTALLING]
                                                       │
                                              All resources released
                                                       │
                                               [UNINSTALLED]
```

### State Definitions

| State | Meaning |
|---|---|
| `UNDISCOVERED` | The plugin exists on disk or in the registry but has not been found by the discovery process |
| `DISCOVERED` | The plugin has been found — its manifest has been read but not yet validated |
| `REGISTERED` | The plugin's manifest has passed validation and it is known to the system |
| `LOADING` | The plugin module is being loaded into the runtime |
| `LOADED` | The plugin module is in memory but initialization has not yet run |
| `ACTIVE` | The plugin is fully initialized and responding to events and requests |
| `DISABLING` | The plugin is in the process of being disabled — ongoing operations are completing |
| `DISABLED` | The plugin is loaded in memory but not processing any events or requests |
| `RELOADING` | The plugin is being reloaded (new version or configuration) — temporarily unavailable |
| `FAILED` | The plugin has encountered an unrecoverable error during loading or initialization |
| `UNINSTALLING` | The plugin is being removed — resources are being released and state is being cleaned up |
| `UNINSTALLED` | The plugin has been fully removed |

### Lifecycle Ownership

The Plugin Manager owns all lifecycle state transitions. No plugin may advance its own state. A plugin that calls a shutdown function does not move itself to `DISABLED` — it signals its intent, and the Plugin Manager makes the state transition.

---

## 4. Plugin Registration

Registration is the process of making the Core aware of a plugin and recording it in the plugin registry.

### 4.1 The Plugin Registry

The Plugin Registry is the authoritative record of all known plugins — discovered, registered, active, disabled, or failed. It is maintained by the Plugin Manager. The registry records:

| Field | Description |
|---|---|
| `pluginId` | Unique, stable identifier for this plugin |
| `name` | Human-readable plugin name |
| `version` | Current installed version |
| `state` | Current lifecycle state |
| `installedAt` | Timestamp of installation |
| `enabledAt` | Timestamp of most recent activation |
| `manifest` | Reference to the validated manifest |
| `declaredPermissions` | The permissions this plugin declared in its manifest |
| `grantedPermissions` | The permissions actually granted (may be a subset of declared) |
| `loadErrors` | Error records from failed loading or initialization attempts |

### 4.2 Registration Is Idempotent

Registering a plugin that is already registered has no effect beyond updating the registration if the manifest has changed. Registration never duplicates plugin entries.

### 4.3 Registration Requires Valid Manifest

A plugin cannot be registered without a valid, fully-parsed manifest. Manifest validation (Section 9) must pass before registration. An invalid manifest produces a registration failure — the plugin is not added to the registry.

### 4.4 Registration Does Not Load

Registration records the plugin's existence in the registry. It does not load the plugin into memory. Loading is a separate, explicit action. The registration-to-loading distinction allows the system to know about plugins without running their code.

---

## 5. Plugin Discovery

Discovery is the process by which the Plugin Manager finds plugins that are available to be registered.

### 5.1 Discovery Sources

Plugins may be discovered from the following sources, in order of precedence:

| Source | Description |
|---|---|
| **Local directory** | A designated plugin directory on the local filesystem — used for development and self-hosted deployments |
| **Plugin registry** | A centrally managed catalog of approved plugins, accessible via the Plugin Registry API |
| **Inline configuration** | Plugins declared explicitly in the system configuration — used for built-in or preloaded plugins |

### 5.2 Discovery Triggers

Discovery runs at:
- System startup (always)
- Plugin directory watch event (when a new plugin is added to the local directory)
- Manual trigger by an operator
- Scheduled interval (for registry-sourced plugins)

### 5.3 Discovery Is Read-Only

Discovery reads manifests and records plugin existence. It does not load, initialize, or execute any plugin code. The plugin's code must not run as a side effect of discovery.

### 5.4 Discovery Does Not Imply Loading

A discovered plugin is known to the system but not necessarily active. Operators or system configuration determine which discovered plugins are loaded and enabled. Discovery and activation are separate concerns.

### 5.5 Discovery Failure Is Non-Fatal

If discovery of a specific plugin fails (malformed manifest, inaccessible directory), that failure must not prevent the discovery of other plugins. Each plugin is discovered independently.

---

## 6. Plugin Loading

Loading is the process of bringing the plugin's code into the application runtime.

### 6.1 Loading Is Controlled by the Plugin Manager

Only the Plugin Manager may initiate a plugin load. Plugins cannot self-load or trigger the loading of other plugins. External components (the Application Layer, operators) request loading through the Plugin Manager's interface.

### 6.2 Pre-Load Validation

Before loading a plugin, the Plugin Manager verifies:
- The plugin is in `REGISTERED` state
- All declared dependencies are available (Section 12)
- The declared permissions have been reviewed and granted (Section 11)
- The plugin's code has passed integrity verification (hash, signature, or equivalent)

### 6.3 Integrity Verification

Before executing any plugin code, the Plugin Manager must verify the integrity of the plugin's code artifact. The verification method (cryptographic hash comparison, digital signature verification, or equivalent) is determined by the deployment environment. A plugin that fails integrity verification must not be loaded — regardless of how it was obtained.

### 6.4 Load Isolation

Plugin loading must not affect the Core or other plugins. If a plugin module fails to load (syntax error, missing native dependency, corrupted file), the failure must be caught and contained. The plugin transitions to `FAILED` state. The Core continues operating.

### 6.5 Load Timeout

Plugin loading must complete within a defined timeout. A plugin that does not complete loading within this period is treated as failed. Infinite loading loops must not be possible.

### 6.6 Load Order

When multiple plugins are loaded (e.g., at startup), the Plugin Manager loads them in dependency order — plugins with no dependencies first, then plugins whose dependencies have been loaded. A plugin must not be loaded before its declared dependencies.

---

## 7. Plugin Initialization

Initialization is the phase during which a loaded plugin performs its setup — acquiring resources, registering handlers, subscribing to events — before becoming active.

### 7.1 Initialization Is the Plugin's Setup Phase

During initialization, the plugin receives its Plugin Context (Section 8) and uses it to:
- Register event subscriptions
- Register service implementations (if the plugin provides services)
- Load its configuration
- Acquire resources (timers, caches, connection pools — all through the Plugin API)
- Validate that its required configuration is present

### 7.2 Initialization Must Be Bounded

Plugin initialization must complete within a defined timeout. A plugin that does not complete initialization within this period is failed. There is no exception for "heavy" or "complex" plugins — if initialization is slow, it must be restructured to defer work to the active phase.

### 7.3 Initialization Errors

If a plugin throws an error during initialization:
- The Plugin Manager catches the error
- The plugin is transitioned to `FAILED` state
- The error is recorded in the plugin's registry entry
- The event subscription and service registrations made during the failed initialization are rolled back
- No partial initialization state is allowed to persist

### 7.4 Initialization Is Not Activation

A plugin in `LOADED` state has been initialized but is not yet receiving events or processing requests. The Plugin Manager activates the plugin (transitions to `ACTIVE`) after confirming initialization completed successfully.

### 7.5 Initialization Must Not Perform Business Operations

Plugin initialization may not send messages, read message history, access session state, or perform any business-level operation. Initialization is for setup only — declaring capabilities and acquiring resources. Business operations begin in the `ACTIVE` state.

---

## 8. Plugin Context

The Plugin Context is the controlled interface through which a plugin interacts with the Void system. It is the implementation of the Plugin API boundary.

### 8.1 The Context Is the Boundary

The Plugin Context is the only sanctioned bridge between a plugin and the Core. It exposes exactly the capabilities a plugin is permitted to use — no more. Capabilities not exposed through the Context are not available to the plugin, regardless of how the plugin's code is written.

### 8.2 Context Is Scoped to a Single Plugin

Each plugin receives its own Context instance, scoped to its `pluginId` and its granted permissions. A plugin cannot access another plugin's Context. A plugin cannot obtain a Context with different permissions than what was granted to it.

### 8.3 Context Is Provided, Not Constructed

A plugin does not construct its own Context. The Plugin Manager creates the Context and provides it to the plugin during initialization. A plugin that attempts to construct its own Context — or obtain one through any means other than initialization — will not receive a valid Context.

### 8.4 Context Capabilities

The Plugin Context exposes capabilities organized into namespaces:

| Namespace | Capabilities Available to Plugin |
|---|---|
| `context.events` | Subscribe to system events; publish plugin-defined events |
| `context.services` | Invoke registered system services; register the plugin's own services |
| `context.config` | Read the plugin's own configuration |
| `context.storage` | Read and write plugin-scoped storage |
| `context.logger` | Structured logging within the plugin's log namespace |
| `context.scheduler` | Schedule periodic or deferred tasks |
| `context.resources` | Allocate managed resources (timers, caches) |
| `context.messaging` | Send messages through the sanctioned messaging interface (if permitted) |

### 8.5 Context Capabilities Are Permission-Gated

Each Context capability is available only if the plugin holds the corresponding permission. A plugin that does not hold `permission.messaging.send` cannot call `context.messaging.send`. The Context enforces this at the call site — not at the plugin's discretion.

### 8.6 Context Is Invalidated on Plugin Shutdown

When a plugin is disabled or uninstalled, its Context is invalidated. Any call to the Context after invalidation fails with a clear error. This prevents stale plugin code from continuing to interact with the system after it has been shut down.

---

## 9. Plugin Metadata

Plugin metadata is the formal declaration of a plugin's identity, capabilities, requirements, and constraints. It is expressed in the plugin manifest.

### 9.1 The Plugin Manifest

Every plugin must have a manifest — a structured document that the Plugin Manager reads before any code is executed. The manifest is the plugin's contract with the system.

### 9.2 Required Manifest Fields

| Field | Description | Rules |
|---|---|---|
| `id` | Unique plugin identifier | Lowercase, alphanumeric with hyphens; globally unique within the installation |
| `name` | Human-readable name | Non-empty, display purposes only |
| `version` | Plugin version | Semantic versioning (MAJOR.MINOR.PATCH) |
| `apiVersion` | The Plugin API version this plugin was written for | Must be compatible with the current Core's Plugin API version |
| `description` | What this plugin does | Required; must be accurate and honest |
| `author` | Plugin author identity | Required |
| `permissions` | List of permissions the plugin requests | See Section 11 |
| `entryPoint` | The module path that the Plugin Manager loads | Must point to a valid file within the plugin bundle |
| `configSchema` | JSON Schema describing the plugin's expected configuration | Required — even if the plugin has no configuration (provide an empty schema) |

### 9.3 Optional Manifest Fields

| Field | Description |
|---|---|
| `dependencies` | Plugin dependencies — other plugins that must be loaded before this one |
| `minCoreVersion` | Minimum Core version required |
| `maxCoreVersion` | Maximum Core version supported |
| `tags` | Categorization tags for registry browsing |
| `homepage` | URL to documentation or source repository |
| `supportedEvents` | Events this plugin produces (for documentation and tooling) |
| `providedServices` | Services this plugin registers (for dependency resolution) |

### 9.4 Manifest Validation

Before registration, the Plugin Manager validates the manifest:
- All required fields are present and correctly typed
- `id` is unique and follows the naming convention
- `version` is valid semantic version
- `apiVersion` is compatible with the running Core
- `permissions` contains only recognized permission names
- `entryPoint` exists within the plugin bundle
- `configSchema` is valid JSON Schema

A manifest that fails validation is rejected. The plugin cannot be registered.

---

## 10. Plugin Configuration

Configuration is the mechanism through which operators customize plugin behavior without modifying the plugin's code.

### 10.1 Configuration Is Plugin-Scoped

Each plugin has its own configuration namespace. Plugin A cannot read Plugin B's configuration. Plugin configurations do not share a namespace. Configuration keys for Plugin A cannot collide with configuration keys for Plugin B.

### 10.2 Configuration Is Declared in the Manifest

The `configSchema` in the manifest defines the complete set of configuration keys a plugin may read, their types, their defaults, and their validation rules. A plugin may not read configuration keys that are not declared in its `configSchema`.

### 10.3 Configuration Is Read Through Context

Plugins access their configuration exclusively through `context.config`. They do not read environment variables directly, access global configuration, or read configuration files from the filesystem. The Context provides a validated, scoped configuration view.

### 10.4 Configuration Is Validated on Load

Before a plugin is initialized, the Plugin Manager validates the operator-provided configuration against the plugin's `configSchema`. If the configuration is invalid (missing required keys, wrong types, values outside allowed ranges), the plugin fails to load with a clear error describing the validation failure.

### 10.5 Configuration Changes

When an operator changes a plugin's configuration:
- The Plugin Manager validates the new configuration against the `configSchema`
- If valid: the plugin is reloaded (Section 19) to apply the new configuration
- If invalid: the change is rejected with a validation error; the plugin continues running with the previous configuration

### 10.6 Secrets in Configuration

Plugin configuration must not contain raw secret values (API keys, passwords, tokens). Secrets required by plugins are provided through a dedicated secrets interface exposed by the Context. The secrets interface ensures that secret values are not logged, not serialized into configuration records, and are treated with the same care as Core secrets.

---

## 11. Plugin Permissions

The permission system is the enforcement mechanism that ensures plugins access only what they declared they needed and what was explicitly granted.

### 11.1 Permission Declaration Is Mandatory

Every capability a plugin needs must be declared in its manifest's `permissions` field. A plugin that does not declare a permission does not receive it — even if the plugin's code attempts to use the corresponding Context capability.

### 11.2 Permission Principle of Least Privilege

Plugins must declare the minimum set of permissions required for their stated purpose. A plugin that declares every available permission "just in case" is violating the principle of least privilege and will be subject to review. The permission list is a promise to the operator: "I will only do these things."

### 11.3 Permission Categories

Permissions are organized into categories. The following permission categories exist:

| Category | Controls Access To |
|---|---|
| `events.subscribe.*` | Subscribing to specific event types |
| `events.publish.*` | Publishing specific event types |
| `services.invoke.*` | Invoking specific system services |
| `services.register.*` | Registering plugin services for other components to use |
| `messaging.send` | Sending messages through the messaging interface |
| `messaging.read` | Reading message history |
| `storage.read` | Reading from plugin-scoped persistent storage |
| `storage.write` | Writing to plugin-scoped persistent storage |
| `scheduler.create` | Creating scheduled tasks |
| `contacts.read` | Reading contact information |

### 11.4 Permission Granting

When a plugin is registered, the operator reviews its declared permissions:
- Permissions that are deemed acceptable are granted
- Permissions that are deemed excessive or unsafe may be denied
- A plugin whose required permissions are denied cannot be activated

The granted permissions are recorded in the registry and enforced by the Context at runtime.

### 11.5 Permission Escalation Is Forbidden

A plugin cannot acquire permissions at runtime beyond what was granted at registration time. There is no "request additional permission" mechanism during plugin execution. If a plugin needs more permissions, the operator must update the permission grant and the plugin must be reloaded.

### 11.6 Permission Auditing

All permission usage is auditable. The system records which plugins invoked which permissions and when. This audit trail supports security review and incident investigation.

---

## 12. Plugin Dependencies

A plugin may declare dependencies on other plugins or on system services. These dependencies are resolved before the dependent plugin is loaded.

### 12.1 Plugin-to-Plugin Dependencies

A plugin that requires the services or events of another plugin must declare that dependency in its manifest. The Plugin Manager loads dependencies before the dependent plugin. If a dependency is not available, the dependent plugin cannot be loaded.

### 12.2 System Service Dependencies

A plugin that requires a system service (exposed by the Core through the Plugin API) declares this in its manifest. The Plugin Manager verifies that the declared system services are available before loading the plugin.

### 12.3 Dependency Resolution Order

At startup or when loading a set of plugins, the Plugin Manager computes the dependency graph and loads plugins in topological order. Circular dependencies are detected during registration and result in a registration failure for all plugins in the cycle.

### 12.4 Circular Dependencies Are Forbidden

Plugin A depending on Plugin B which depends on Plugin A is an architectural error. Plugins with circular dependencies cannot be loaded. The correct resolution is to extract the shared capability into a separate plugin that both A and B depend on.

### 12.5 Dependency Failure Propagation

If a plugin fails to load, all plugins that depend on it must also be failed. A plugin that declares a dependency on a failed plugin cannot be activated — its dependency contract cannot be satisfied.

### 12.6 Weak Dependencies

Plugins may declare weak dependencies — capabilities they will use if available but do not require. Weak dependencies do not affect load order. If a weak dependency is not available, the plugin loads without it and adapts its behavior accordingly.

---

## 13. Plugin Isolation

Isolation ensures that a plugin's failures, resource consumption, and state cannot affect the Core or other plugins.

### 13.1 Execution Isolation

Plugin code executes in an environment that limits its ability to affect the broader system. The degree of isolation is determined by the deployment environment's capabilities. At minimum, the following isolation properties must hold regardless of implementation mechanism:

- **Error containment:** An uncaught exception in plugin code must not crash the Core process
- **State containment:** A plugin's in-memory state is not accessible to other plugins or the Core's internal components
- **Global mutation prevention:** A plugin cannot modify global variables, built-in prototypes, or global event emitters in a way that affects other components

### 13.2 Storage Isolation

Plugin storage (Section 16) is namespace-scoped. Plugin A cannot read or write Plugin B's storage. Plugin storage cannot access Core database tables or operational data stores.

### 13.3 Resource Limits

Each plugin operates within resource limits enforced by the Plugin Manager:

| Resource | Limit Type |
|---|---|
| CPU time per operation | Per-invocation timeout |
| Memory allocation | Per-plugin memory cap |
| Storage consumption | Per-plugin storage quota |
| Event handler execution time | Per-handler timeout |
| Outbound request rate | Per-plugin rate limit |
| Scheduled task frequency | Minimum interval between scheduled executions |

When a plugin exceeds a resource limit:
- The current operation is terminated
- The violation is recorded
- If violations exceed a threshold, the plugin is automatically disabled
- The operator is notified

### 13.4 Network Isolation

Plugins may not make direct network connections unless `network.outbound` permission is declared and granted. Even with permission, outbound connections from plugins must be made through the Context's network interface — not through raw socket APIs. The Context's network interface enforces allowed domains, rate limits, and connection timeouts.

---

## 14. Plugin Communication

Plugins communicate with the rest of the system and with each other exclusively through defined channels.

### 14.1 No Direct Plugin-to-Plugin Calls

Plugins must not call each other's code directly. Plugin A must not import Plugin B's module and call its functions. All inter-plugin communication must go through:
- The event system (Plugin A emits an event; Plugin B subscribes to it)
- The service registry (Plugin A registers a service; Plugin B invokes it through the Context)

### 14.2 No Direct Plugin-to-Core Calls

Plugins must not import or call Core modules directly. All plugin-to-Core communication goes through the Plugin Context. The Plugin Context is the only sanctioned interface.

### 14.3 Communication Is Asynchronous by Default

Plugin event subscriptions and service invocations are asynchronous. Plugins must not assume synchronous side effects from emitting an event. An event is a notification — the plugin that emits it does not control or observe the processing.

### 14.4 Message Passing Is Unidirectional for Events

When a plugin publishes an event, it does not receive a response. Events are one-way notifications. If a plugin needs a response, it must use the service invocation mechanism — which is a request-response interaction.

### 14.5 Communication Is Logged

All cross-plugin and plugin-to-Core communication through the Context is logged at the appropriate level (at minimum, at `debug` level). This provides a complete audit trail of plugin interactions for debugging and security review.

---

## 15. Plugin Events

The event system is the primary mechanism for plugins to react to things that happen in the system and to notify others of things they have produced.

### 15.1 System Events Are Read-Only for Plugins

System events — events produced by the Core (message received, session changed, connection state changed) — may be subscribed to by plugins but not published by plugins. Plugins may not emit system events.

### 15.2 Plugin Events Are Namespaced

Events published by plugins are namespaced under the plugin's ID: `plugin.<pluginId>.<eventName>`. This prevents event name collisions between plugins and between plugins and the Core.

### 15.3 Event Subscription Requires Permission

A plugin must hold `events.subscribe.<eventType>` permission to subscribe to a given event type. Subscribing to an event type without permission results in a permission error — the subscription is not registered.

### 15.4 Event Handlers Must Be Fast

Event handler execution is time-limited. A handler that exceeds its time limit is terminated and the violation is recorded. Handlers that need to perform slow work (I/O, computation) must initiate that work asynchronously and return immediately.

### 15.5 Event Handler Failures Are Isolated

If a plugin's event handler throws an error, that error is caught by the Plugin Manager. The error is logged in the plugin's error record. The event is still delivered to other subscribers — a handler failure in one plugin does not prevent other subscribers from receiving the event.

### 15.6 Event Ordering

Plugins receive events in the order they were emitted. Across multiple subscribers to the same event, delivery order between subscribers is not guaranteed. Plugins must not depend on receiving events in a specific order relative to other plugins.

---

## 16. Plugin Services

The service system allows plugins to register capabilities that other plugins (or Core components) can invoke.

### 16.1 Service Registration

A plugin that provides a service registers it during initialization through `context.services.register`. The registration records:
- Service name (namespaced under the plugin's ID)
- Service interface description (inputs, outputs, error types)
- Service implementation reference

### 16.2 Service Discovery

Other plugins discover available services through `context.services.list` or by declaring service dependencies in their manifest. A service is only visible to a plugin if that plugin holds the appropriate `services.invoke.*` permission.

### 16.3 Service Invocation

Service invocation is a request-response interaction. The calling plugin sends a request (typed input) and receives a response (typed output or error). Service invocations are asynchronous and time-limited.

### 16.4 Service Versioning

Services may be versioned. When a plugin updates a service's interface in a breaking way, the new service version must be registered under a new service name or version identifier. Old service consumers continue using the old version until they are updated.

### 16.5 Service Failure Handling

If a service provider plugin fails or is disabled while a service call is in progress:
- The call returns an error to the caller
- The caller is responsible for handling the service-unavailable error gracefully
- The Plugin Manager does not automatically redirect service calls to another provider

---

## 17. Plugin Resource Management

Every resource a plugin acquires must be managed — allocated intentionally, used within limits, and released completely on shutdown.

### 17.1 Resources Are Acquired Through Context

A plugin acquires managed resources through `context.resources`. Managed resources include:
- Timers and intervals
- In-memory caches
- Connection pools
- File handles

Resources acquired through the Context are tracked by the Plugin Manager. When the plugin is shut down, any unreleased resources are automatically cleaned up.

### 17.2 Plugins Must Not Acquire Unmanaged Resources

A plugin that creates a timer using a raw system API (rather than through the Context) creates an unmanaged resource that the Plugin Manager cannot track or clean up. This is forbidden. All resources must be allocated through the Context.

### 17.3 Plugin Storage

Plugins that require persistent storage access it through `context.storage`. Plugin storage is:
- Namespace-isolated (no plugin can access another's storage)
- Quota-limited (each plugin has a maximum storage allocation)
- Automatically cleaned up when a plugin is uninstalled

Plugin storage must not be used for operational data that belongs to the Core (message history, session state, user records). It is for plugin-specific state only.

### 17.4 Resource Limits Are Enforced, Not Trusted

A plugin's declared resource expectations (in its manifest) are informational. Actual resource limits are enforced by the Plugin Manager regardless of what the plugin declares. A plugin that consumes more than its limit — whether declared or not — is subject to resource limiting and potential disabling.

---

## 18. Plugin Shutdown

Shutdown is the process of bringing a plugin from `ACTIVE` (or `DISABLED`) to `UNINSTALLED`, releasing all resources and removing all registrations.

### 18.1 Shutdown Is Initiated by the Plugin Manager

No plugin initiates its own shutdown. Shutdown is always initiated by the Plugin Manager — in response to an operator action, a dependency failure, a resource violation, or a system shutdown.

### 18.2 Shutdown Sequence

The Plugin Manager follows this sequence when shutting down a plugin:

1. **Stop accepting new work:** Event delivery to the plugin stops; new service requests are rejected
2. **Complete in-flight work:** Ongoing event handlers and service calls are allowed to complete, up to a drain timeout
3. **Call plugin cleanup:** The plugin's registered cleanup function is called, giving it the opportunity to release resources and flush state
4. **Release Context:** The plugin's Context is invalidated
5. **Roll back registrations:** All event subscriptions and service registrations made by the plugin are removed
6. **Release managed resources:** Any resources tracked by the Plugin Manager that the plugin did not release are released
7. **Clean up storage:** For uninstall (not just disable): plugin storage is deleted
8. **Update registry:** Plugin state is set to `DISABLED` or `UNINSTALLED`

### 18.3 Cleanup Function Contract

The plugin's cleanup function must:
- Complete within the defined cleanup timeout
- Release all resources the plugin owns
- Flush any pending writes to plugin storage
- Not initiate new operations
- Not communicate through the Context (the Context is being invalidated)

A cleanup function that times out is terminated. The Plugin Manager proceeds with forced cleanup.

### 18.4 Disable vs. Uninstall

| Aspect | Disable | Uninstall |
|---|---|---|
| Plugin code | Remains in memory | Removed from memory |
| Plugin storage | Preserved | Deleted |
| Registry entry | Remains (state: DISABLED) | Deleted |
| Re-enablement | Possible without reload | Requires re-discovery and re-registration |

---

## 19. Plugin Reload Strategy

Reload is the process of updating a plugin in place — applying a new version or new configuration — without uninstalling and reinstalling.

### 19.1 When Reload Is Used

Reload is triggered when:
- A new version of the plugin is available and an in-place update is requested
- The plugin's configuration has been changed and must be applied
- The plugin has encountered a recoverable failure and recovery requires a fresh initialization

### 19.2 Reload Sequence

1. The plugin is transitioned to `RELOADING` state — event delivery and service requests are suspended
2. In-flight operations are drained (up to a drain timeout)
3. The plugin's cleanup function is called
4. The old plugin module is removed from memory
5. The new plugin version (or the same version with new configuration) is loaded
6. Initialization is run
7. If initialization succeeds: the plugin is transitioned to `ACTIVE`
8. If initialization fails: the plugin is transitioned to `FAILED` and the operator is notified

### 19.3 Rollback on Reload Failure

When a reload fails, the Plugin Manager must attempt to restore the previous version. If the previous version can be restored successfully, it is activated. If the previous version cannot be restored, the plugin is failed and the operator must intervene.

### 19.4 State During Reload

During reload, dependent plugins continue running. If they attempt to call a service provided by the reloading plugin, they receive a service-temporarily-unavailable error. They must handle this gracefully.

---

## 20. Plugin Versioning

Plugin versioning enables the system to manage multiple versions of a plugin over time.

### 20.1 Semantic Versioning Is Required

Every plugin version is a semantic version (MAJOR.MINOR.PATCH):
- **MAJOR** increment: breaking change in the plugin's interface or behavior
- **MINOR** increment: backward-compatible new capability
- **PATCH** increment: backward-compatible bug fix

### 20.2 The Plugin API Version Is Separate from the Plugin Version

The plugin's version describes the plugin itself. The `apiVersion` in the manifest describes which Plugin API version the plugin was written against. These are independent — a plugin at version 3.2.1 may target Plugin API version 2.

### 20.3 Version Records

The Plugin Registry records the history of installed versions for each plugin. When a plugin is updated, the previous version record is retained (with its `UNINSTALLED` state) for audit purposes.

### 20.4 Downgrade Policy

Downgrading a plugin to a previous version is permitted through the same mechanism as upgrading (reload). The Plugin Manager does not distinguish between upgrades and downgrades — both result in the same reload sequence.

---

## 21. Plugin Compatibility

Compatibility governs which plugins can operate together and with which versions of the Core.

### 21.1 Plugin API Compatibility

A plugin declares the Plugin API version it targets (`apiVersion` in the manifest). The Core's Plugin Manager evaluates this against the current Plugin API version:

| Relationship | Result |
|---|---|
| Plugin `apiVersion` matches current Core API version | Compatible |
| Plugin `apiVersion` is an older MINOR version of the same MAJOR | Compatible (Core maintains backward compatibility within MAJOR) |
| Plugin `apiVersion` is a different MAJOR version | Incompatible — plugin cannot be loaded |
| Plugin `apiVersion` is newer than the current Core API version | Incompatible — Core does not know this API version |

### 21.2 Core Version Requirements

A plugin may declare `minCoreVersion` and `maxCoreVersion` in its manifest. If the running Core version is outside this range, the plugin is not loaded. This allows plugin authors to express which Core versions their plugin has been tested against.

### 21.3 Inter-Plugin Compatibility

Plugin dependencies declare version constraints on their dependencies. If Plugin A requires Plugin B at version `>=2.0.0 <3.0.0`, and Plugin B is installed at version `1.9.0`, Plugin A's dependency constraint is not satisfied and it cannot be loaded.

### 21.4 Breaking Changes in the Plugin API

When the Core's Plugin API changes in a breaking way (MAJOR version increment), existing plugins targeting the old MAJOR version continue to work until they are explicitly updated. The Core may support multiple Plugin API MAJOR versions simultaneously for a defined transition period.

---

## 22. Plugin Security

Plugin security encompasses all measures that prevent plugins from becoming a vector for data exfiltration, unauthorized access, system compromise, or abuse.

### 22.1 Plugins Are Not Trusted by Default

A plugin from an external source — even if it appears benign — is treated as untrusted code. The permission system, isolation mechanisms, resource limits, and integrity verification collectively ensure that untrusted code cannot exceed its sanctioned scope.

### 22.2 Code Integrity Before Execution

No plugin code is executed before its integrity is verified. This verification confirms that the code being loaded is exactly what the plugin author published — it has not been modified in transit or at rest.

### 22.3 Dependency Supply Chain

Plugins that bundle third-party libraries extend trust to those libraries. The Plugin Manager's integrity verification covers the entire plugin bundle — including bundled dependencies. A plugin that dynamically downloads code at runtime is categorically forbidden.

### 22.4 No Dynamic Code Execution

Plugins must not evaluate code strings at runtime. Dynamic execution bypasses integrity verification and the permission system. Any plugin found to use dynamic code execution is considered a security violation and must be immediately disabled and reviewed.

### 22.5 Sensitive Data Handling

Plugins must not log, expose via service responses, or emit in events any sensitive data — session tokens, AppState, cookies, authentication credentials, or personally identifiable information beyond what is explicitly permitted. A plugin's log output is visible to operators; sensitive data in logs is a data exposure.

### 22.6 Security Incident Response

If a plugin is found to be performing unauthorized operations:
1. The plugin is immediately disabled
2. The audit log is reviewed for the plugin's complete activity history
3. The operator is notified with a full incident report
4. No other plugins that depended on the compromised plugin are automatically trusted

---

## 23. Plugin Error Handling

### 23.1 Errors in Plugins Do Not Crash the Core

All plugin code execution is wrapped by the Plugin Manager in error boundaries. An unhandled error in a plugin is caught, logged, and attributed to the plugin. The Core continues operating.

### 23.2 Error Classification

Plugin errors are classified by severity:

| Severity | Definition | Response |
|---|---|---|
| **Warning** | Non-critical deviation — plugin continues operating | Log and record; no automatic action |
| **Error** | Operation failed — current operation is aborted | Log, record, increment error counter |
| **Critical** | Repeated failures or resource limit exceeded | Automatic disable; operator notification |
| **Security** | Permission violation or unauthorized behavior detected | Immediate disable; security alert |

### 23.3 Error Rate Monitoring

The Plugin Manager tracks each plugin's error rate. If a plugin's error rate exceeds the defined threshold within a rolling window, the plugin is automatically disabled to prevent it from destabilizing the system.

### 23.4 Plugin Error Reporting to Operators

Plugin errors above the Warning level are surfaced to operators through the monitoring system. Operators can view a plugin's error history, see the error messages (without sensitive content), and take action (reload, disable, uninstall).

### 23.5 Plugins Must Not Swallow All Errors

A plugin's internal error handling must not suppress all errors — particularly errors that indicate the plugin is not functioning correctly. Suppressing errors prevents the Plugin Manager's error rate monitoring from working and hides failures from operators.

---

## 24. Plugin Performance

### 24.1 Plugins Must Not Block the Event Loop

In an event-driven runtime, a plugin handler that performs blocking I/O, executes a long synchronous computation, or enters an infinite loop blocks the entire system. All plugin operations that require I/O or significant computation must be performed asynchronously.

### 24.2 Plugin Startup Must Be Fast

Plugin initialization is on the critical path of system startup. A plugin that performs slow operations during initialization delays the system's readiness. Initialization must perform only what is necessary to declare the plugin's capabilities — all other work begins in the active phase.

### 24.3 Event Handler Overhead Must Be Minimal

High-frequency events (message received, heartbeat) may be delivered hundreds of times per minute. Event handlers attached to these events must be extremely lightweight. Heavy processing triggered by high-frequency events must be deferred and batched.

### 24.4 Resource Usage Must Be Proportional to Value

A plugin that consumes significant CPU, memory, or I/O must provide proportional value. Resource-intensive plugins must justify their consumption. The Plugin Manager's resource limits enforce a ceiling, but plugin authors must design for proportional consumption from the start.

---

## 25. Best Practices

1. **Declare the minimum necessary permissions.** Overly broad permissions reduce trust, invite scrutiny, and create unnecessary risk. If a permission is not needed for the current feature, do not declare it.

2. **Make cleanup functions reliable.** The cleanup function is called during shutdown, disable, and reload. If it fails, resources may leak. Cleanup functions must be written defensively — they must work even if the plugin's state is partially corrupt.

3. **Treat every Context call as potentially failing.** The Context can be invalidated, the network can be unavailable, a service can be down. Plugin code that assumes Context calls always succeed will fail unpredictably.

4. **Keep event handlers fast.** If an event handler needs to do significant work, queue the work and return immediately. Processing in the background; not in the handler.

5. **Use plugin-scoped storage for plugin state only.** Plugin storage is not a general-purpose database. It is for state that the plugin itself produced and that only the plugin needs to read.

6. **Version manifests carefully.** Once a plugin is in use, its manifest is part of its public contract. Version changes that break existing configurations must increment the MAJOR version.

7. **Log at the appropriate level.** `debug` for execution traces, `info` for significant state changes, `warn` for recoverable anomalies, `error` for operation failures. Never log sensitive data at any level.

8. **Test plugin lifecycle transitions.** Initialize, disable, re-enable, and uninstall paths must be explicitly tested. These paths are less exercised in normal operation and are prone to bugs.

9. **Write plugins to be stateless when possible.** Stateless plugins are simpler, more reliable, and easier to reload. State that must survive plugin reloads should be in plugin storage.

10. **Document what each permission is used for.** In the manifest or accompanying documentation, explain why each declared permission is needed. This enables informed operator review.

---

## 26. Anti-Patterns

### 26.1 The God Plugin

A single plugin that handles multiple unrelated concerns — message transformation, analytics collection, external API integration, and scheduling — to avoid the overhead of managing multiple plugins. God plugins become impossible to maintain, too large to review, and too tightly coupled to specific Core behaviors.

### 26.2 The Core-Reaching Plugin

A plugin that imports Core modules directly, reads global variables, or calls internal APIs that are not part of the Plugin Context. This plugin will break silently when Core internals change and creates hidden dependencies that cannot be managed through the permission system.

### 26.3 The Side-Effect Initializer

A plugin that performs business operations (sends messages, updates records, triggers external calls) during initialization. Initialization is for setup — side effects during initialization cannot be rolled back cleanly if initialization later fails.

### 26.4 The Silent Error Consumer

A plugin that wraps all its logic in a broad try-catch and suppresses every error with an empty handler. This hides failures from the Plugin Manager's error rate monitoring, prevents operators from knowing about problems, and masks bugs that accumulate silently.

### 26.5 The Ambient State Plugin

A plugin that stores references to Context objects, session data, or system events in module-level variables accessible across requests. Module-level state in a plugin survives reloads incorrectly, may be shared across account contexts, and creates hidden state that is difficult to reason about.

### 26.6 The Tight-Coupled Pair

Two plugins that must always be loaded together because they call each other's internal APIs directly — not through the service registry. This defeats plugin independence and creates a fragile compound that behaves like a single module split across two files.

### 26.7 The Permission-Inflated Plugin

A plugin that requests every available permission in its manifest to avoid thinking carefully about what it actually needs. Permission inflation makes the plugin impossible to review meaningfully and grants unnecessary access surface.

---

## 27. Forbidden Plugin Practices

The following practices are categorically forbidden. Any instance found in code review must be rejected before merge.

### 27.1 Direct Access to Facebook Layer

A plugin must not import, instantiate, or call any component of the Facebook Layer — `FacebookTransport`, `SessionManager`, `AuthenticationManager`, `ReconnectManager`, `EventDispatcher`, `MessageGateway`, or any other Facebook Layer component. If a plugin needs to send a message, it uses `context.messaging`. It must never touch the Facebook Layer directly.

### 27.2 Direct Access to the Database

A plugin must not connect to or query the application database directly. Database access is a Core operation. Plugins that need to persist or retrieve data use `context.storage` (plugin storage) or invoke a sanctioned system service. A plugin with a direct database connection bypasses all access controls and can corrupt Core data.

### 27.3 Creating Managers

A plugin must not instantiate or operate its own Manager classes — SessionManager, ConnectionController, ReconnectManager, or any other manager that is a Core component. These components are the Core's internal machinery. A plugin that creates them is creating a shadow system that conflicts with the authoritative Core.

### 27.4 Creating Sessions

A plugin must not create, modify, or destroy Facebook sessions. Sessions are managed exclusively by `SessionManager`, which is an internal Core component that is not accessible to plugins. A plugin that needs session information receives it through explicitly defined, permission-gated interfaces — not by creating sessions.

### 27.5 Executing Login

A plugin must not perform a Facebook login — initiate authentication, present credentials to Facebook, or produce session state. Authentication is performed exclusively by `AuthenticationManager`. This is an absolute constraint with no exceptions.

### 27.6 Modifying Global Configuration

A plugin must not modify environment variables, global configuration objects, or any configuration state that applies to the entire system. A plugin's configuration scope is limited to its own namespace. Modifying global configuration affects every part of the system and all other plugins.

### 27.7 Downloading Code at Runtime

A plugin must not download and execute code at runtime — from a CDN, from an API response, from any external source. All code must be part of the plugin bundle that was integrity-verified at load time. Dynamically downloaded code bypasses security controls.

### 27.8 Spawning Persistent Background Processes

A plugin must not spawn child processes, worker threads, or persistent background tasks outside the Context's resource management. Unmanaged background processes survive plugin shutdown, continue consuming resources, and cannot be tracked or terminated by the Plugin Manager.

### 27.9 Accessing Another Plugin's Storage

A plugin must not read from or write to another plugin's storage namespace. Plugin storage namespacing is enforced by the Context, but plugins must not attempt to construct another plugin's storage key and use it through any available interface.

### 27.10 Bypassing the Event System for Plugin-to-Plugin Communication

Plugins must not import each other's code for direct function calls. All inter-plugin communication uses the event system or the service registry. Direct imports create tight coupling, bypass permission enforcement, and prevent independent plugin management.

---

## 28. AI Plugin Rules

This section defines how an AI system must reason about the plugin system when developing within the Void project.

### 28.1 Identify Whether the Feature Belongs in a Plugin

Before writing any plugin-related code, the AI must determine whether the requested feature belongs in:
- **Core:** A fundamental capability that all users of the system rely on and that requires deep access to internal components
- **Plugin:** An optional, additive capability that can be expressed through the Plugin API without Core access

If the feature requires direct access to Core internals (Facebook Layer, Database, Session management), it cannot be implemented as a plugin under the current Plugin API. The AI must either:
- Implement it in Core (if appropriate)
- Propose extending the Plugin API to expose the needed capability, then implement the extension and the plugin separately

### 28.2 The AI Must Not Generate Code That Violates Plugin Boundaries

The AI must never generate plugin code that:
- Imports Core modules
- Accesses the Facebook Layer
- Connects to the database directly
- Creates or modifies sessions
- Performs authentication
- Modifies global state

When a feature request would require any of these, the AI must explain the constraint and propose a compliant alternative.

### 28.3 The AI Must Verify Permission Coverage

Before generating code that calls a Context capability, the AI must verify that the capability's corresponding permission is declared in the manifest. Generating code that uses `context.messaging.send` without `messaging.send` in the manifest produces a plugin that will fail at runtime.

### 28.4 The AI Must Design Cleanup Functions

Whenever the AI generates plugin initialization code that acquires resources, it must simultaneously generate the corresponding cleanup code. Resource acquisition without cleanup is a resource leak. The AI must never write initialization code and leave cleanup as "to be done later."

### 28.5 The AI Must Respect Lifecycle States

When writing plugin code that interacts with the system (calling services, subscribing to events), the AI must ensure the code is appropriate for the plugin's current lifecycle state. A plugin must not attempt to call Context capabilities after its cleanup function has been called.

### 28.6 When the Plugin API Must Be Extended

If the AI determines that a legitimate plugin feature cannot be implemented with the current Plugin API, it must:
1. Document the capability gap
2. Propose an extension to the Plugin API (new Context capability, new event type, new service)
3. Wait for the architectural approval of the extension
4. Update this document to reflect the new capability
5. Only then implement the extension and the plugin

The AI must not implement workarounds (direct Core access, database connections) as substitutes for proper Plugin API extensions.

### 28.7 The AI Must Generate Complete Manifests

When generating a new plugin, the AI must produce a complete, valid manifest including all required fields. A plugin generated without a complete manifest will fail registration. Incomplete manifests must not be left for the developer to "fill in later."

### 28.8 Security Review for Sensitive Permissions

When a plugin requests sensitive permissions (`messaging.read`, `storage.write`, `network.outbound`), the AI must explain in its output why each sensitive permission is necessary for the plugin's stated purpose. Generating permission declarations without explanation is insufficient.

---

## 29. Review Checklist

Use this checklist for every code review that introduces or modifies plugin-related code.

### Manifest Completeness
- [ ] All required manifest fields are present and correctly typed
- [ ] `pluginId` follows the naming convention and is unique
- [ ] `version` is a valid semantic version
- [ ] `apiVersion` is compatible with the current Core Plugin API version
- [ ] `configSchema` is present and is valid JSON Schema
- [ ] `permissions` lists only recognized permission names
- [ ] Declared permissions are the minimum necessary

### Plugin Boundaries
- [ ] No Core module is imported or called directly
- [ ] No Facebook Layer component is accessed
- [ ] No direct database connection exists
- [ ] No session is created, modified, or destroyed
- [ ] No authentication is performed
- [ ] No global configuration is modified
- [ ] No code is downloaded or evaluated at runtime

### Lifecycle Compliance
- [ ] Initialization code acquires resources only — no business operations
- [ ] Initialization completes quickly — no slow synchronous operations
- [ ] A cleanup function is present
- [ ] Cleanup function releases all resources acquired during initialization
- [ ] Cleanup function does not make Context calls (Context is being invalidated)

### Resource Management
- [ ] All timers and intervals are created through `context.resources`
- [ ] All storage access uses `context.storage` (namespaced)
- [ ] No unmanaged background processes or child processes are spawned
- [ ] Resource usage is proportional to the plugin's purpose

### Communication
- [ ] All inter-plugin communication uses events or the service registry
- [ ] No other plugin's module is imported directly
- [ ] All system interaction goes through the Plugin Context
- [ ] Event handlers are fast — heavy work is deferred asynchronously

### Security
- [ ] No sensitive data appears in log statements
- [ ] Permission declarations cover all Context capabilities used
- [ ] Plugin storage is used only for plugin-specific state
- [ ] No session data, tokens, or AppState is read, stored, or emitted

### Error Handling
- [ ] Errors are caught and handled — not suppressed silently
- [ ] Error handling does not mask failures from the Plugin Manager
- [ ] Context calls are handled as potentially failing operations

### AI-Generated Code Specific
- [ ] Permission list was verified to cover all Context calls
- [ ] Cleanup function was generated alongside initialization code
- [ ] No boundary violations are present
- [ ] Manifest is complete — no fields left as placeholders

---

*This document is the official and sole architectural reference for the Void plugin system. Every plugin — whether built by the core team, a third party, or an AI system — must comply with the architecture, constraints, and policies defined here. No plugin system code may be written without consulting this document. Changes to the plugin system architecture require updating this document before any implementation work begins.*
