# 13 — Command System Architecture

> **Status:** Official  
> **Scope:** All command-related design decisions in Void — command discovery, registration, parsing, permission validation, execution delegation, middleware, response handling, and error management  
> **Authority:** This document is the single source of truth for the command system architecture in Void. No command system code may be written, modified, or deleted without consulting this document. Changes to command system design require updating this document before implementation.

---

## Table of Contents

1. [Command Philosophy](#1-command-philosophy)
2. [Command Lifecycle](#2-command-lifecycle)
3. [Command Discovery](#3-command-discovery)
4. [Command Registration](#4-command-registration)
5. [Command Metadata](#5-command-metadata)
6. [Command Parsing](#6-command-parsing)
7. [Prefix Resolution](#7-prefix-resolution)
8. [Alias Resolution](#8-alias-resolution)
9. [Permission Validation](#9-permission-validation)
10. [Cooldown Strategy](#10-cooldown-strategy)
11. [Middleware Integration](#11-middleware-integration)
12. [Command Context](#12-command-context)
13. [Command Execution](#13-command-execution)
14. [Error Handling](#14-error-handling)
15. [Command Response](#15-command-response)
16. [Command Categories](#16-command-categories)
17. [Admin Commands](#17-admin-commands)
18. [User Commands](#18-user-commands)
19. [Plugin Commands](#19-plugin-commands)
20. [Performance](#20-performance)
21. [Security](#21-security)
22. [Best Practices](#22-best-practices)
23. [Anti-Patterns](#23-anti-patterns)
24. [Forbidden Command Practices](#24-forbidden-command-practices)
25. [AI Command Rules](#25-ai-command-rules)
26. [Review Checklist](#26-review-checklist)

---

## 1. Command Philosophy

### 1.1 The Command as an Entry Point

A command is an entry point — nothing more. It is the moment the system recognizes that a message contains a structured instruction and begins the chain of processing that fulfills that instruction. The command itself does not fulfill the instruction. It identifies the instruction, validates the right to issue it, constructs the context required to execute it, and delegates execution to a Service.

This distinction is not academic. A command that contains business logic — that performs database operations, makes decisions, computes results — is a command that has exceeded its mandate. Business logic belongs in Services. Commands belong at the boundary: receiving, validating, routing, and responding.

### 1.2 Thinness as a Design Constraint

Every command must be thin. Thin means:
- The command's handler reads the incoming context and arguments
- It validates permission and structural requirements that are command-specific
- It calls the appropriate Service with the validated inputs
- It formats and returns the Service's result

A command handler that is more than a few conceptual steps is almost certainly doing too much. When a command grows, the correct response is to identify what belongs in a Service and move it there — not to restructure the command to accommodate more logic.

### 1.3 Delegation as the Core Pattern

The relationship between a command and a Service is one of delegation. The command is the delegator — it knows who to call and what to pass. The Service is the delegate — it knows how to fulfill the request. This separation means:
- Services can be tested independently of commands
- Services can be called from multiple entry points (commands, scheduled tasks, API endpoints) without duplication
- Business logic changes are made in one place — the Service — not scattered across commands

### 1.4 Commands Are User-Facing Contracts

A command's name, prefix, arguments, and response format are visible to users. They are a public contract. Changing a command's name, removing an alias, or altering the expected argument format is a breaking change from the user's perspective. Command interfaces must be managed with the same deliberateness as API contracts.

### 1.5 Consistency Over Cleverness

The command system must behave consistently and predictably. A user who learns how one command works should be able to correctly anticipate how another command works — same prefix conventions, same argument patterns, same error message structure, same response format. Consistency is the foundation of usability.

---

## 2. Command Lifecycle

Every command request — from the arrival of a message to the delivery of a response — follows a defined sequence. No step may be skipped and no step may be reordered.

```
  Inbound Message Arrives
          │
          ▼
  ┌─────────────────┐
  │  Message Router │  — Is this message a candidate for command processing?
  └────────┬────────┘
           │ Yes — passes to Command Pipeline
           │ No — exits to standard message handling
           ▼
  ┌─────────────────┐
  │  Prefix Parser  │  — Does the message begin with a recognized prefix?
  └────────┬────────┘
           │ Yes
           │ No — exits (not a command)
           ▼
  ┌─────────────────┐
  │  Command Parser │  — Extract command name and raw arguments
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Alias Resolver  │  — Resolve aliases to canonical command name
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │Command Registry │  — Does a registered command match this name?
  └────────┬────────┘
           │ Found
           │ Not found — respond with "unknown command" and exit
           ▼
  ┌─────────────────────────────────┐
  │         Middleware Chain        │
  │  ┌────────────────────────┐     │
  │  │  Permission Validator  │     │
  │  └──────────┬─────────────┘     │
  │             │ Permitted         │
  │             │ Denied — respond  │
  │             ▼ with error & exit │
  │  ┌────────────────────────┐     │
  │  │   Cooldown Checker     │     │
  │  └──────────┬─────────────┘     │
  │             │ Allowed           │
  │             │ On cooldown —     │
  │             │ respond & exit    │
  │             ▼                   │
  │  ┌────────────────────────┐     │
  │  │  Argument Validator    │     │
  │  └──────────┬─────────────┘     │
  │             │ Valid             │
  │             │ Invalid — respond │
  │             │ with usage & exit │
  │             ▼                   │
  │  ┌────────────────────────┐     │
  │  │  Context Builder       │     │
  │  └──────────┬─────────────┘     │
  └────────────┼────────────────────┘
               │
               ▼
  ┌─────────────────┐
  │ Command Handler │  — Receives context; delegates to Service
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │    Service      │  — Executes business logic; returns result or error
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │Response Builder │  — Formats result into user-facing response
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │Message Gateway  │  — Delivers the response to the originating conversation
  └─────────────────┘
```

The lifecycle has three distinct zones:
- **Recognition zone** (Prefix Parser → Command Registry): Determine whether and which command is being invoked
- **Validation zone** (Middleware Chain): Determine whether this invocation is permitted and structurally correct
- **Execution zone** (Command Handler → Response Builder): Execute the intent and return the result

---

## 3. Command Discovery

Discovery is the process by which the command system becomes aware of commands that are available to be registered.

### 3.1 Discovery Sources

Commands are discovered from the following sources:

| Source | Description |
|---|---|
| **Core command modules** | Built-in commands defined within the Core — loaded unconditionally at startup |
| **Plugin registrations** | Commands registered by plugins through the Plugin API during plugin initialization |
| **Configuration-declared commands** | Commands enabled or disabled via operator configuration (typically for optional Core commands) |

### 3.2 Discovery at Startup

At startup, the Command Manager executes discovery in source order:
1. Core commands are discovered and registered first — they have the highest priority and cannot be overridden
2. Plugin commands are discovered and registered as plugins are initialized — in dependency order
3. Configuration adjustments are applied — enabling or disabling specific commands per environment

### 3.3 Discovery Is Passive

Discovery reads command definitions. It does not execute any command handler, validate any argument, or process any message. Discovery is strictly declarative — commands declare their existence; the Command Manager records it.

### 3.4 Dynamic Discovery

When a plugin is loaded after startup, it may register new commands through the Plugin API. These commands become available immediately upon successful plugin initialization. When a plugin is disabled or uninstalled, all commands it registered are automatically deregistered.

---

## 4. Command Registration

Registration is the act of making a command available for invocation — recording it in the Command Registry with its full metadata and handler reference.

### 4.1 The Command Registry

The Command Registry is the authoritative catalog of all currently available commands. It is maintained by the Command Manager. The registry supports:
- Lookup by canonical name
- Lookup by alias
- Lookup by category
- Listing all commands available to a given permission level

### 4.2 Registration Requirements

Before a command is registered, the Command Manager verifies:
- The command's metadata is complete and valid (Section 5)
- The command's canonical name is unique — no existing command uses the same name
- The command's aliases do not conflict with existing command names or aliases
- The command's handler function is present and callable
- The command's permission declaration references a recognized permission level

### 4.3 Registration Conflicts

If a plugin attempts to register a command whose name conflicts with an existing Core command, the registration is rejected. Core commands are protected. Plugin commands may not shadow, override, or replace Core commands.

Plugin-to-plugin command name conflicts are also rejected. The second plugin to register a conflicting name fails registration for that command. This encourages plugins to use namespaced command names (e.g., `pluginid-commandname`).

### 4.4 Deregistration

Commands are deregistered when:
- The plugin that registered them is disabled or uninstalled
- An operator explicitly disables a command through configuration

Deregistration removes the command from all lookup indices. Any in-flight invocation of the command that has already reached the execution zone is allowed to complete. New invocations of the command after deregistration return an "unknown command" response.

---

## 5. Command Metadata

Command metadata is the formal declaration of a command's identity, behavior, and requirements. Every command must declare complete metadata at registration.

### 5.1 Required Metadata Fields

| Field | Description | Rules |
|---|---|---|
| `name` | Canonical command name | Lowercase, alphanumeric with hyphens; unique across all registered commands |
| `description` | What this command does | Non-empty; accurate; shown in help output |
| `category` | Command category | One of the defined categories (Section 16) |
| `permission` | Required permission level to invoke | One of the defined permission levels (Section 9) |
| `arguments` | Argument definitions | List of argument descriptors; may be empty for no-argument commands |
| `handler` | The function invoked when the command is executed | Must delegate to a Service; must not contain business logic |
| `source` | Origin of the command | `core`, `plugin:<pluginId>` |

### 5.2 Optional Metadata Fields

| Field | Description |
|---|---|
| `aliases` | Alternative names that invoke this command |
| `usage` | Usage example string shown in error and help responses |
| `cooldown` | Cooldown configuration (Section 10) |
| `hidden` | If true, command does not appear in help listings — still invocable |
| `deprecated` | If true, command is functional but users are warned it will be removed |
| `deprecationMessage` | Message shown when a deprecated command is invoked |
| `examples` | List of example invocations shown in help output |
| `middlewareOverrides` | Middleware configuration overrides specific to this command |

### 5.3 Argument Descriptors

Each argument in the `arguments` list declares:

| Field | Description |
|---|---|
| `name` | Argument name — used in usage strings and error messages |
| `description` | What this argument represents |
| `type` | Argument type (`string`, `number`, `boolean`, `user`, `duration`) |
| `required` | Whether the argument must be present |
| `default` | Default value when the argument is absent (only for non-required arguments) |
| `validator` | Optional additional validation rule beyond type checking |

---

## 6. Command Parsing

Parsing is the process of extracting structured information from a raw inbound message.

### 6.1 Parsing Is the First Transformation

The raw message text is an unstructured string. Parsing produces a structured representation: the prefix, the command name, and the raw argument tokens. This structured representation is what subsequent pipeline stages work with.

### 6.2 Parsing Sequence

1. **Strip leading whitespace** from the message
2. **Extract the prefix** — verify the message begins with a recognized prefix (Section 7)
3. **Tokenize** the remainder of the message by whitespace (with support for quoted strings)
4. **Extract the command name** — the first token after the prefix
5. **Collect remaining tokens** as raw argument tokens
6. **Pass structured result** to the Alias Resolver

### 6.3 Quoted String Handling

Arguments enclosed in quotation marks are treated as a single token, even if they contain whitespace. This allows arguments with spaces (e.g., a message to send, a display name) without requiring special escaping.

### 6.4 Parsing Must Not Interpret

The parser extracts tokens — it does not interpret them. The parser does not know whether the command name is valid. It does not know whether the argument count is correct. It does not know whether the first argument should be a number or a string. Those determinations belong to subsequent stages.

### 6.5 Parsing Failures

Parsing can fail only for structural reasons — a prefix is partially recognized, tokenization produces an invalid structure. Parsing failure results in the message being released from the command pipeline and treated as a normal message. No error is returned to the user for parsing failures.

---

## 7. Prefix Resolution

A command prefix is the character or character sequence that signals the beginning of a command. Prefix resolution determines whether a message is a command invocation at all.

### 7.1 Prefix as the Command Trigger

No message is processed as a command unless it begins with a recognized prefix. The prefix is the first discriminator in the command pipeline. A message without a recognized prefix exits the pipeline immediately and is processed as a normal message.

### 7.2 Prefix Configuration

Prefixes are configurable per deployment, per conversation, or per account — depending on the operator's configuration. The default prefix is defined in Core configuration and applies to all conversations unless overridden.

### 7.3 Prefix Lookup Is Exact

Prefix matching is exact — the message must begin with the prefix exactly as configured, including case sensitivity if the prefix contains letters. Partial prefix matches are not recognized.

### 7.4 Multiple Prefixes

A deployment may configure multiple valid prefixes. If any recognized prefix matches the message's start, prefix resolution succeeds and the matched prefix is stripped before the message is passed to the Command Parser.

### 7.5 Prefix Conflicts

If two configured prefixes share a common start (e.g., `!` and `!!`), the longer prefix takes priority. Ambiguous prefix configuration must be validated at startup and rejected if it would produce unpredictable behavior.

### 7.6 Prefix Is Not a Security Mechanism

The prefix is a user convenience feature — it signals intent. It is not an authorization mechanism. Authorization is handled by the Permission Validator in the middleware chain. A valid prefix does not imply the invoker has permission to run the command.

---

## 8. Alias Resolution

An alias is an alternative name that can be used to invoke a command. Alias resolution converts an alias to its canonical command name before the registry lookup.

### 8.1 Aliases Are Shortcuts, Not Separate Commands

An alias is not a separate command — it is a pointer to a canonical command. When an alias is used, the system resolves it to its canonical command and proceeds exactly as if the canonical name had been used. Aliases have no independent behavior.

### 8.2 Alias Uniqueness

An alias must be unique across all registered commands and all other aliases. A name cannot be both a canonical command name and an alias for another command. A name cannot be an alias for two different commands.

### 8.3 Alias Resolution Is Transparent

After alias resolution, the remaining pipeline uses the canonical command name. The user-provided alias is retained in the Command Context for logging purposes, but all processing occurs against the canonical name.

### 8.4 Aliases Are Declared in Metadata

Aliases are declared in the command's metadata at registration time. They cannot be added or removed from a running command without re-registering the command. Dynamic alias manipulation at runtime is not supported.

### 8.5 Core Commands May Not Be Aliased to Plugin Commands

A Core command's canonical name may not be used as an alias for a plugin command. This would allow a plugin to intercept invocations intended for a Core command — an unacceptable security risk.

---

## 9. Permission Validation

Permission validation determines whether the invoking entity — the user, the account, the context — is authorized to execute the resolved command.

### 9.1 Every Command Has a Permission Level

Every registered command declares a required permission level in its metadata. There are no commands without a permission level. Commands with no access restrictions still declare a permission level — they declare the lowest tier, which all valid invokers hold.

### 9.2 Permission Levels

Permission levels form a hierarchy. Higher levels include all permissions of lower levels:

| Level | Description |
|---|---|
| `public` | Any message sender may invoke — no role restriction |
| `user` | Authenticated Void users only |
| `operator` | Account operators — those managing the Void account |
| `admin` | System administrators — cross-account administrative access |
| `system` | Internal system only — cannot be invoked by any human user |

### 9.3 Permission Validation Is Always Performed

Permission validation is a mandatory middleware step. It runs for every command invocation, every time, without exception. There is no bypass, no "fast path," and no trust assumption that allows permission validation to be skipped.

### 9.4 Permission Failure Response

When permission validation fails:
- A clear, appropriately worded response is returned to the invoker
- The response does not reveal information about the command's existence or nature beyond what the invoker's permission level would permit
- The failed invocation is logged with the invoker's identity, the command name, and the permission outcome

### 9.5 Permission Evaluation Is Contextual

Permission evaluation considers not just the invoker's role but the context of the invocation:
- Which conversation the command was sent in
- Which account the conversation belongs to
- Whether the invoker has a relationship to that account that grants elevated permissions

A user who is an operator for Account A is not automatically an operator for Account B. Permission evaluation is always account-scoped.

---

## 10. Cooldown Strategy

A cooldown is a minimum interval between successive invocations of the same command by the same invoker. Cooldowns prevent command flooding and protect system resources.

### 10.1 Cooldowns Are Per-Command and Per-Invoker

A cooldown is specific to a command-invoker pair. User A's cooldown for the `status` command does not affect User B's ability to invoke `status`. Cooldowns are not global — they are per-user, per-command.

### 10.2 Cooldown Declaration

Commands declare their cooldown in their metadata. The declaration specifies:
- The cooldown duration (minimum time between invocations)
- Whether the cooldown applies per-user, per-conversation, or globally
- Whether the cooldown is bypassed for certain permission levels (e.g., admins are exempt from cooldowns)

### 10.3 Cooldown State

Cooldown state is stored in a fast-access store (in-memory or cache). It records the timestamp of the last successful invocation for each command-invoker pair. On each invocation, the current time is compared to the stored timestamp plus the cooldown duration.

### 10.4 Cooldown Enforcement

When an invoker's cooldown has not yet elapsed:
- A response is returned indicating the cooldown status and remaining wait time
- The invocation is not processed
- The cooldown timer is not reset — attempting to invoke during cooldown does not extend the cooldown

### 10.5 Cooldown and Failures

A failed command invocation — one that results in an error from the Service — does not consume the cooldown. The cooldown is only consumed by invocations that proceed to the execution zone. A command rejected in the validation zone does not trigger a cooldown.

### 10.6 Cooldown Storage

Cooldown state is ephemeral — it does not need to survive process restarts. An in-memory store with a TTL equal to the cooldown duration is sufficient. Cooldowns reset naturally on restart.

---

## 11. Middleware Integration

Middleware is the mechanism by which cross-cutting concerns — permission validation, cooldown enforcement, argument validation, logging, rate limiting — are applied uniformly to every command without being embedded in each command's handler.

### 11.1 The Middleware Chain

Command invocations pass through an ordered chain of middleware before reaching the command handler. Each middleware in the chain:
1. Receives the partially-constructed Command Context
2. Performs its specific concern
3. Either allows the invocation to proceed (calls the next middleware) or terminates the invocation (returns a response without calling further middleware)

### 11.2 Middleware Order

The middleware order is fixed and defined by the Command Manager. The canonical order is:

| Position | Middleware | Purpose |
|---|---|---|
| 1 | Permission Validator | Is the invoker authorized? |
| 2 | Cooldown Checker | Is the invoker within their rate limit? |
| 3 | Argument Validator | Are the provided arguments structurally valid? |
| 4 | Context Builder | Construct the full Command Context |
| 5 | Logging Middleware | Record the invocation for audit |

### 11.3 Middleware Is Not Command Logic

Middleware handles concerns that apply across commands uniformly. Command-specific logic — even validation logic specific to one command's arguments — belongs in the command's handler or the Service it delegates to, not in middleware.

### 11.4 Custom Middleware for Commands

Specific commands may declare middleware overrides in their metadata — adding command-specific middleware or adjusting the behavior of standard middleware (e.g., longer cooldown, stricter rate limit). These overrides are merged with the standard chain, not replacements for it.

### 11.5 Middleware Failures Are Final

If middleware terminates an invocation, the command handler is not called. The termination response is sent directly to the invoker. There is no way for the command handler to "override" a middleware termination.

### 11.6 Middleware Is Composable and Testable

Each middleware unit must be independently testable — given a Command Context, it produces a deterministic outcome. Middleware that cannot be tested without a full system context has absorbed too much concern and must be refactored.

---

## 12. Command Context

The Command Context is the complete, validated, structured description of a command invocation — built by the middleware chain and provided to the command handler.

### 12.1 Context Is Built, Not Received

The Command Context is not what the handler receives from the message directly. It is constructed progressively as the invocation passes through the middleware chain. By the time the handler receives it, the context is:
- Fully validated
- Enriched with invoker identity, permissions, and resolved account information
- Populated with typed, validated arguments

### 12.2 Context Contents

The Command Context includes:

| Field | Description |
|---|---|
| `commandName` | The canonical command name being invoked |
| `aliasUsed` | The alias or canonical name as typed by the invoker |
| `invoker` | The invoking entity — user ID, conversation ID, account context |
| `invokerPermissions` | The resolved permissions of the invoker in this context |
| `arguments` | Validated, typed argument values — keyed by argument name |
| `rawArguments` | The original unparsed argument string — for commands that need it |
| `conversation` | The conversation context — ID, type, participants |
| `account` | The Void account context — for account-scoped operations |
| `timestamp` | The exact timestamp of command receipt |
| `correlationId` | A unique identifier for this invocation — used in logging and tracing |
| `services` | A scoped accessor for the Services the handler is permitted to call |

### 12.3 Context Is Read-Only for Handlers

The Command Context provided to a handler is immutable from the handler's perspective. The handler reads from it — it does not write to it. If a handler needs to pass modified information to a Service, it constructs new arguments — it does not modify the Context.

### 12.4 Context Is Scoped

The `services` accessor on the Context provides access only to Services relevant to this command's category and permission level. A command handler does not receive unrestricted access to all system Services — it receives a scoped view appropriate to what the command is authorized to do.

---

## 13. Command Execution

Execution is the phase in which the command handler receives the Command Context, delegates to a Service, and returns the result.

### 13.1 The Handler Is the Boundary, Not the Logic

The command handler's sole function is:
1. Read the validated arguments and context
2. Call the appropriate Service with the necessary inputs
3. Return the Service's result to the Response Builder

Everything else — data retrieval, computation, state changes, external calls — happens inside the Service. The handler knows *what* to call and *what to pass*. The Service knows *how* to fulfill the request.

### 13.2 Handlers Are Stateless

A command handler must not maintain state between invocations. It receives a Context, produces a result, and finishes. Any state that needs to persist between invocations lives in a Service or in storage — not in the handler.

### 13.3 Handler Timeout

Every handler execution is bounded by a timeout. A handler that does not complete within the timeout is terminated. The invoker receives a timeout error response. The handler timeout is distinct from Service timeouts — a handler should not be waiting long because it should not be doing work.

### 13.4 Handler Failures

If a handler throws an error — because a Service returned an error, because argument processing failed, or because an unexpected condition was encountered — the error is caught by the Error Handler (Section 14). The handler does not produce a user-facing response directly on error — it propagates the error for centralized handling.

### 13.5 One Handler Per Command

Every command has exactly one handler. There are no conditional handlers, no handler chains per command, and no dynamic handler selection at runtime. If a command needs to behave differently in different contexts, the difference is expressed in the Service layer — not by having multiple handlers.

### 13.6 Handlers Are Not Responsible for Response Formatting

The handler returns a result object — it does not format a user-facing message string. The Response Builder (Section 15) converts the handler's result into the appropriate response format. A handler that constructs the response string itself bypasses the Response Builder and produces inconsistent responses.

---

## 14. Error Handling

### 14.1 Errors Are Centralized

Every error that occurs in the command pipeline — parsing failures, permission denials, validation failures, handler exceptions, Service errors — is handled by the centralized Error Handler. Individual pipeline stages do not format their own error responses except where termination with an immediate standard response is more appropriate (e.g., permission denied, unknown command).

### 14.2 Error Classification

Errors in the command pipeline are classified into the following categories:

| Category | Examples | User Response | Logging |
|---|---|---|---|
| **Not a command** | No prefix match | None — message exits pipeline silently | Not logged |
| **Unknown command** | Command name not in registry | "Unknown command: X" | Debug |
| **Permission denied** | Invoker lacks required permission | "You do not have permission to use this command" | Info |
| **On cooldown** | Cooldown has not elapsed | "Please wait N seconds before using this command again" | Debug |
| **Invalid arguments** | Wrong argument count, type mismatch | Usage string with description of the error | Info |
| **Service error** | Service returned a business-level error | User-facing description of what went wrong | Warn |
| **System error** | Unexpected exception, Service unavailable | "An error occurred. Please try again" | Error |
| **Timeout** | Handler or Service did not complete in time | "The command timed out. Please try again" | Warn |

### 14.3 Error Responses Must Not Expose Internals

Error responses sent to users must not include:
- Stack traces
- Internal error codes or IDs from infrastructure systems
- Database query details
- File paths or module names
- Session or connection state information

User-facing error messages describe the problem at the level of the user's action — not the system's internal state.

### 14.4 Errors Are Correlated

Every error is logged with the invocation's `correlationId`. This allows an operator who receives a user complaint to locate the exact invocation in the logs and trace the complete error chain from handler through Service and back.

### 14.5 System Errors Require Monitoring Signals

A system error (unexpected exception, infrastructure unavailability) must emit a monitoring signal — not just a log entry. Repeated system errors from a command are a signal that something is wrong and must surface to the operator's attention.

---

## 15. Command Response

The response is the system's reply to the invoker — delivered through the Message Gateway to the originating conversation.

### 15.1 Response Builder Responsibility

The Response Builder converts the handler's result object into a formatted response. It:
- Applies the system's standard response format for the command's category
- Truncates or paginates responses that exceed the message length limit
- Wraps error results in the standard error format

### 15.2 Response Consistency

All responses from the same category of command must look and feel consistent:
- Same terminology for similar operations
- Same format for lists, counts, and status indicators
- Same vocabulary for success and failure acknowledgements

Users must not have to learn a new response pattern for every command.

### 15.3 Response Length Management

Facebook messages have maximum length constraints. Responses that exceed the limit must be handled:
- **Truncation with continuation:** The response is split across multiple messages in sequence
- **Summary mode:** A long result is summarized with an offer to retrieve full details
- **Pagination:** Results are delivered page by page in response to navigation commands

The strategy is declared per command category in the Command Manager's configuration.

### 15.4 Response Delivery Is Through MessageGateway

Responses are sent through the `MessageGateway` — the same path as all outbound Facebook messages (per `10-facebook-architecture.md`). The command system does not have its own response delivery mechanism. It uses the same message delivery pipeline as all other outbound content.

### 15.5 Response Is Not the Handler's Responsibility

The handler returns a result. The Response Builder produces the response. The Message Gateway delivers it. These are three distinct steps handled by three distinct components. A handler that calls the Message Gateway directly bypasses the Response Builder and produces unformatted, inconsistent responses.

---

## 16. Command Categories

Every command belongs to exactly one category. Categories determine:
- Where the command appears in help listings
- What default middleware configuration applies
- What response format is expected
- What permission tier anchors the category

### 16.1 Category Definitions

| Category | Purpose | Default Permission |
|---|---|---|
| `system` | Internal system operations — health, diagnostics, state inspection | `system` |
| `admin` | Cross-account administrative operations | `admin` |
| `operator` | Account management operations for the connected account | `operator` |
| `user` | User-facing feature commands — the primary public interface | `user` or `public` |
| `utility` | General-purpose helper commands — help, status, feedback | `public` |
| `plugin` | Commands registered by plugins | Declared by the plugin |

### 16.2 Category Is Not a Permission Level

A command's category describes its functional domain — not its access control. Permission is declared explicitly per command. A command in the `operator` category must still declare a specific permission level. The category is not a substitute for the permission declaration.

---

## 17. Admin Commands

Admin commands are restricted to system administrators — entities with cross-account authority.

### 17.1 Admin Command Constraints

Admin commands:
- Require the `admin` permission level — verified by the Permission Validator on every invocation
- Must be audited — every invocation, successful or failed, is logged with full invoker identity and argument details
- Must not be listed in public help output — they are `hidden: true`
- Must execute through Services that enforce their own authorization check (defense in depth)

### 17.2 Admin Command Scope

Admin commands operate on the system — not on behalf of a specific user or conversation. They manage accounts, inspect system state, force resource releases, and perform operational tasks.

### 17.3 Admin Command Error Handling

Admin commands receive more detailed error information in their responses than user commands — because the audience (administrators) can act on the detail. However, even admin responses must not expose raw internal state, stack traces, or credential material.

---

## 18. User Commands

User commands are the primary interface through which end users interact with Void's capabilities.

### 18.1 User Command Design Principles

User commands must be:
- **Discoverable:** Available in help listings with clear descriptions
- **Forgiving:** Accept reasonable variations in argument format
- **Informative on failure:** When invalid arguments are provided, the error message explains what was wrong and provides the correct usage
- **Fast:** Users expect commands to respond quickly — if the underlying Service is slow, the command should acknowledge receipt and respond asynchronously

### 18.2 User Commands and Scope

A user command operates in the scope of the conversation where it was invoked. It may act on behalf of the invoking user — it does not have cross-account or cross-conversation access unless explicitly designed for it and permission-gated accordingly.

### 18.3 User Command Discoverability

Every user command appears in the help system. The help system is itself a command (`utility` category) that lists available commands with their descriptions and usage. Commands declared `hidden: true` do not appear in help but remain invocable if the invoker knows the name.

---

## 19. Plugin Commands

Plugin commands are commands registered by plugins through the Plugin API. They extend the command system without modifying it.

### 19.1 Plugin Commands Follow All Command Rules

A plugin command is subject to the same architecture, lifecycle, and constraints as any Core command. It must:
- Have complete metadata
- Be thin — delegate to a Service (provided by the plugin or by the system)
- Not contain business logic in the handler
- Respect the permission system
- Provide a cleanup path (deregistered when the plugin is disabled or uninstalled)

### 19.2 Plugin Command Naming

Plugin commands must use a namespace prefix to prevent name collisions with Core commands and other plugins. The convention is `<pluginId>-<commandname>`. A plugin that registers a command named `status` (without a namespace prefix) risks conflicting with Core or other plugin commands.

### 19.3 Plugin Command Permissions

Plugin commands declare their permission level in their metadata. The Plugin Manager verifies that the declared permission is appropriate for the plugin's granted permissions. A plugin cannot register a command with a higher permission level than it was granted.

### 19.4 Plugin Command Isolation

Plugin command handlers execute within the plugin's isolation boundary. A plugin command handler that crashes does not crash the Command Manager. The error is caught, attributed to the plugin, and the invoker receives a system error response.

---

## 20. Performance

### 20.1 The Command Pipeline Must Be Low-Latency

The recognition zone (prefix parsing through registry lookup) must complete in milliseconds. It runs for every inbound message — even those that are not commands. Its performance directly affects the system's ability to process message throughput.

### 20.2 Middleware Must Be Fast

Each middleware in the chain adds latency. Permission validation must not make database queries on every invocation — permissions are resolved from a fast-access cache. Cooldown checks must use an in-memory store — not a database query. Middleware that is slow degrades every command invocation.

### 20.3 Handlers Must Not Block

Command handlers must not perform synchronous blocking operations. A handler that waits for a Service to return before continuing blocks the execution environment. All Service calls from handlers are asynchronous.

### 20.4 Service Latency Is the Handler's Responsibility to Acknowledge

If a Service is expected to take significant time, the command handler must acknowledge receipt before awaiting the result:
1. Handler sends an immediate acknowledgement to the invoker ("Processing your request...")
2. Handler awaits the Service result
3. Handler sends the result as a follow-up message

This pattern prevents the invoker from experiencing silence that looks like failure.

### 20.5 Command Registry Lookups Are O(1)

The Command Registry must be implemented as a hash map (or equivalent constant-time lookup structure). A linear scan through registered commands on every message is unacceptable as the number of commands grows.

---

## 21. Security

### 21.1 Commands Are Not a Privilege Escalation Vector

The command system must not be a path through which an invoker gains capabilities beyond their permission level. Permission validation is mandatory, non-bypassable, and account-scoped. No command handler executes without the Permission Validator having run.

### 21.2 Argument Injection Prevention

Command arguments are user-supplied strings. They must be treated as untrusted input. The Argument Validator enforces type constraints, maximum lengths, and format rules before arguments are passed to the handler or Service. A Service that receives arguments from a command handler must not assume the arguments were sanitized by the handler — Services apply their own input validation.

### 21.3 Command Name Injection

The command name extracted by the parser is looked up in the registry by exact match — not evaluated, not passed to a shell, not used in a dynamic require/import. Command names are identifiers — they must never be treated as executable content.

### 21.4 Admin Command Audit Trail

Every invocation of an `admin` or `operator` category command is written to an audit log — including the invoker's identity, the full argument list (excluding any secret values), and the outcome. This audit trail is retained per the audit log retention policy in `09-security-policy.md`.

### 21.5 Rate Limiting at the System Level

Beyond per-command cooldowns, the command system applies system-level rate limiting: a maximum number of command invocations per invoker per time window. This prevents a single invoker from consuming disproportionate system resources even with commands that have no cooldown.

---

## 22. Best Practices

1. **Write handlers that can be read in one screen.** If a handler takes more than a screen to read, it is doing too much. Extract the excess to a Service.

2. **Name commands for what they do, not how they work.** `account-status` is better than `fetch-account-data`. Users interact with command names — they should describe intent.

3. **Make usage strings precise.** A usage string should be sufficient for a user who has never seen the command to understand how to invoke it correctly. Vague usage strings lead to invalid argument invocations.

4. **Validate arguments early.** The Argument Validator in middleware catches structural problems (wrong type, missing required argument). Semantic validation (does this user ID exist?) belongs in the Service — but structural validation must not reach the Service.

5. **Design for idempotency where possible.** A user who sends the same command twice (due to uncertainty about whether it worked) should not produce double-execution side effects. Services invoked by commands should be idempotent where the domain permits.

6. **Separate read commands from write commands conceptually.** Commands that read state should be fast, freely accessible, and have minimal cooldowns. Commands that change state should be carefully permission-gated and fully audited.

7. **Deprecate before removing.** Never remove a command without a deprecation period. Mark it deprecated, inform users in the response, and set a clear removal timeline. Surprise command removal breaks user workflows.

8. **Test the handler in isolation.** The handler must be testable without the full middleware chain — given a constructed Command Context, it produces a deterministic result. If it cannot be tested this way, it is too coupled to infrastructure.

---

## 23. Anti-Patterns

### 23.1 The Business Logic Handler

A command handler that queries a database, applies filtering logic, formats data, and sends the result directly. This handler contains an entire feature implementation. It cannot be tested independently, cannot be reused from other entry points, and will grow indefinitely as the feature evolves.

### 23.2 The God Command

A command that takes a variable first argument (`action`) that changes the entire meaning of the remaining arguments — effectively implementing multiple commands as one. The help documentation for this command is impossible to write clearly, and the handler becomes a nested conditional tree.

### 23.3 The State-Carrying Handler

A handler that stores data in module-level variables to share state between invocations. Module-level state in a command handler is shared across all concurrent invocations — producing unpredictable behavior when multiple users invoke the same command simultaneously.

### 23.4 The Self-Responding Handler

A handler that sends its own response directly to the Message Gateway, bypassing the Response Builder. Responses are inconsistent with other commands, length limits are not enforced, and error paths do not produce responses at all (because the handler sent its own).

### 23.5 The Argument-Parsing Handler

A handler that re-parses `rawArguments` instead of using the validated, typed arguments provided in the Command Context. This bypasses the Argument Validator, re-introduces the possibility of injection, and produces inconsistent behavior.

### 23.6 The Silent Failure Handler

A handler that catches all errors internally and returns a generic success response regardless of outcome. Users have no way to know their command did not produce the expected effect. Monitoring cannot detect failure rates.

### 23.7 The Admin-Checking Handler

A command that performs its own permission check inside the handler because the developer did not trust the middleware. This creates two permission checks that can diverge — and when they diverge, the handler's check shadows the middleware check, potentially with different logic.

---

## 24. Forbidden Command Practices

The following practices are categorically forbidden and must be rejected in code review.

### 24.1 Business Logic in Handlers

A handler must not perform database queries, make external API calls, execute conditional business logic, or perform any computation beyond reading the Context, calling a Service, and returning the result. Business logic in handlers is a primary architectural violation.

### 24.2 Bypassing Permission Validation

Any command invocation path that does not pass through the Permission Validator middleware is forbidden. There is no "internal" or "trusted" invocation path that skips permission validation. Commands invoked from other commands still pass through the full middleware chain.

### 24.3 Direct Facebook Layer Access from Handlers

Command handlers must not import or call any Facebook Layer component. If a handler needs to send a Facebook message, it calls a Service. The Service may eventually route through `MessageGateway` — but the handler is not aware of this.

### 24.4 Registering Commands Without Complete Metadata

A command registered without all required metadata fields is not a valid command. The registration must be rejected. Partial metadata is not accepted with the expectation that the rest will be added later.

### 24.5 Overriding Core Commands from Plugins

A plugin must not register a command whose canonical name or alias conflicts with any Core command name or alias. Attempts to override Core commands are rejected at registration. This prevents plugins from intercepting commands intended for Core functionality.

### 24.6 Performing Authentication in Command Handlers

Command handlers must not perform Facebook authentication, create sessions, or interact with the authentication system. Authentication is handled by `AuthenticationManager` (as defined in `10-facebook-architecture.md`). A command that initiates authentication calls a Service that coordinates with the authentication system through the appropriate interfaces.

### 24.7 Stateful Handlers

Handler functions must not maintain state between calls using module-level variables, closures that capture mutable state, or any other mechanism. Handlers are stateless functions. All state that influences command behavior is in the Command Context (input) or in Services (persistent state).

---

## 25. AI Command Rules

This section defines how an AI system must reason about the command system when developing within Void.

### 25.1 Identify Handler vs. Service Responsibility

Before writing any command-related code, the AI must explicitly classify each piece of logic:
- **Handler territory:** Reading context, calling one Service, returning the result
- **Service territory:** Everything else — data access, computation, state changes, external calls, conditional logic

If the AI finds itself writing logic in a handler beyond these three operations, it must stop and relocate that logic to a Service.

### 25.2 The AI Must Generate Complete Metadata

When generating a new command, the AI must produce complete metadata — all required fields with valid values. A command generated without complete metadata fails registration. The AI must not generate metadata with placeholder values ("TODO", "replace this") that are expected to be filled in later.

### 25.3 The AI Must Not Generate Bypass Paths

The AI must never generate code that:
- Invokes a command handler without passing through the middleware chain
- Constructs a Command Context manually and calls a handler directly (bypassing validation)
- Implements permission checks inside a handler as a substitute for middleware

If a feature requires bypassing the standard pipeline, the AI must identify that this represents a system design issue and propose a proper architectural solution rather than a bypass.

### 25.4 The AI Must Match Response Format to Category

When generating a command handler, the AI must ensure the handler returns a result object in the format expected by the Response Builder for the command's declared category. Handlers that return raw strings or unstructured objects will not be formatted correctly.

### 25.5 Plugin Command Naming Enforcement

When generating commands for a plugin, the AI must apply the namespace prefix convention (`<pluginId>-<commandname>`). Generating plugin commands without namespace prefixes produces registration conflicts and must be rejected in code review.

### 25.6 When Architecture Must Change

If a feature request cannot be implemented as a thin command with a delegating handler — because the required Service does not exist, because the Plugin API does not expose the needed capability, or because the permission model does not accommodate the access pattern — the AI must:
1. Identify the gap
2. Propose the architectural addition needed (new Service, new permission level, new Plugin API capability)
3. Wait for approval
4. Update this document and relevant other documents
5. Only then implement the command

The AI must not implement workarounds (logic in handlers, direct layer access) as substitutes for proper architectural extensions.

### 25.7 Audit Requirements for Administrative Commands

When generating admin or operator category commands, the AI must ensure the audit logging is present — invocation details logged with the `correlationId`, full argument list (excluding secret values), and outcome. Administrative commands without audit logging are incomplete.

---

## 26. Review Checklist

Use this checklist for every code review that introduces or modifies command system code.

### Command Handler
- [ ] The handler reads context, calls one Service, and returns the result — nothing more
- [ ] No database query, external API call, or business logic is present in the handler
- [ ] The handler is stateless — no module-level variables are used
- [ ] The handler returns a result object in the expected format — it does not format a response string
- [ ] The handler does not call MessageGateway directly
- [ ] The handler does not access the Facebook Layer

### Command Metadata
- [ ] All required metadata fields are present with valid values
- [ ] The canonical name is unique and follows the naming convention
- [ ] All aliases are unique (no conflict with other names or aliases)
- [ ] The permission level is appropriate for the command's category
- [ ] The `arguments` list accurately describes all accepted arguments
- [ ] Plugin commands use the `<pluginId>-` namespace prefix
- [ ] The `source` field correctly identifies Core or plugin origin

### Permission and Security
- [ ] The command passes through the full middleware chain — no bypass
- [ ] The permission level requires the minimum access needed for this command's function
- [ ] Admin and operator commands are declared `hidden: true`
- [ ] Admin and operator commands have audit logging in place
- [ ] Arguments are validated in the middleware — the handler does not re-validate

### Response
- [ ] The handler returns a result object — not a formatted string
- [ ] The Response Builder is used for all response formatting
- [ ] Long responses have a defined truncation or pagination strategy
- [ ] Error responses do not expose internal details

### Performance
- [ ] The handler is asynchronous — no synchronous blocking operations
- [ ] Slow commands acknowledge receipt before awaiting the Service result
- [ ] Registry lookups are O(1) — no linear scan introduced

### Lifecycle
- [ ] Plugin commands are deregistered when the plugin is disabled or uninstalled
- [ ] Deprecated commands have a deprecation message and a removal timeline
- [ ] No command is removed without a prior deprecation period

---

*This document is the official and sole architectural reference for the Void command system. All commands — Core and plugin — must conform to the architecture, lifecycle, and constraints defined here. No command may be written, modified, or removed without consulting this document. Business logic belongs in Services. Commands are entry points only.*
