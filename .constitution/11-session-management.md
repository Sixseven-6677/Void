# 11 — Session Management

> **Status:** Official  
> **Scope:** **Facebook Authentication Sessions only** — the AppState, Cookies, and Access Tokens that maintain an authenticated connection to the Facebook platform. This document does NOT cover ConversationSession (user conversation state / currentStep / data), which is defined in `27-roadmap.md` Phase 4 and lives in the Application Layer.  
> **Authority:** This document is the single source of truth for **Facebook Session Management** policy. It is to be read in conjunction with `10-facebook-architecture.md`. Any conflict between this document and other documents is resolved in favor of this document for Facebook session management concerns. Changes to Facebook session management policy require updating this document first.

---

> ### ⚠️ Session Type Disambiguation
>
> Void has two distinct session concepts. Do not confuse them:
>
> | Type | Contents | Layer | Managed By |
> |---|---|---|---|
> | **FacebookSession** | AppState + Cookies + Access Token | Facebook Layer |  (in ) |
> | **ConversationSession** | currentStep + data + TTL | Application Layer |  (in  Phase 4) |
>
> **This file covers FacebookSession only.**

---

## Table of Contents

1. [Session Management Overview](#1-session-management-overview)
2. [Session Philosophy](#2-session-philosophy)
3. [Session Objectives](#3-session-objectives)
4. [Session Lifecycle](#4-session-lifecycle)
5. [Session Creation](#5-session-creation)
6. [Session Initialization](#6-session-initialization)
7. [Session Validation](#7-session-validation)
8. [Session Loading](#8-session-loading)
9. [Session Storage](#9-session-storage)
10. [Session Recovery](#10-session-recovery)
11. [Session Refresh Strategy](#11-session-refresh-strategy)
12. [Session Expiration](#12-session-expiration)
13. [Session Invalidation](#13-session-invalidation)
14. [Session Destruction](#14-session-destruction)
15. [Session Persistence](#15-session-persistence)
16. [Session State Management](#16-session-state-management)
17. [AppState Policy](#17-appstate-policy)
18. [Cookie Policy](#18-cookie-policy)
19. [Authentication State](#19-authentication-state)
20. [Reconnect Strategy](#20-reconnect-strategy)
21. [Session Health Monitoring](#21-session-health-monitoring)
22. [Heartbeat Strategy](#22-heartbeat-strategy)
23. [Multi-Session Support](#23-multi-session-support)
24. [Session Isolation](#24-session-isolation)
25. [Session Synchronization](#25-session-synchronization)
26. [Session Backup Strategy](#26-session-backup-strategy)
27. [Failure Recovery](#27-failure-recovery)
28. [Security Considerations](#28-security-considerations)
29. [Performance Considerations](#29-performance-considerations)
30. [Common Failure Scenarios](#30-common-failure-scenarios)
31. [Best Practices](#31-best-practices)
32. [Forbidden Session Practices](#32-forbidden-session-practices)
33. [Anti-Patterns](#33-anti-patterns)
34. [AI Session Rules](#34-ai-session-rules)
35. [Review Checklist](#35-review-checklist)

---

## 1. Session Management Overview

A Facebook session in Void is the totality of state required to maintain an authenticated, continuous connection to the Facebook platform on behalf of a specific user account. It is the most critical piece of operational state in the system — without a valid session, no Facebook operation can succeed, no message can be sent or received, and no reconnection can be achieved.

Session management is the discipline of governing this state — knowing when it is valid, when it is degraded, when it must be refreshed, when it can be recovered, and when it must be destroyed. Poor session management is the single most common cause of Facebook connection instability in systems of this type. A session that is not actively managed will degrade silently over hours or days, producing increasingly unreliable behavior before eventually failing entirely.

Void's session management is built on a single foundational principle: **one component owns all session state, all the time, for every account.** That component is `SessionManager`. Nothing else creates sessions. Nothing else stores sessions. Nothing else reads or writes session state directly. This centralization is not a convenience — it is a correctness requirement. Distributed session management produces distributed session state, and distributed state produces conflicts.

---

## 2. Session Philosophy

### 2.1 The Session Is a Living Entity

A Facebook session is not a static credential that is obtained once and used indefinitely. It is a living entity with a defined lifecycle, a measurable health, and a finite lifespan. It must be actively maintained — refreshed before it expires, monitored for signs of degradation, and recovered when interrupted. A system that treats its session as a one-time acquisition is a system that will fail unpredictably over time.

### 2.2 Centralization Is Correctness

Any system where session state can be created, read, or modified from multiple places is a system with an undefined source of truth. When the session is good in one place and stale in another, every component that reads it will see a different reality. The result is non-deterministic behavior that cannot be debugged by examining any single component. Centralization in `SessionManager` eliminates this class of problem entirely.

### 2.3 The Session Is Not the Connection

A session represents a Facebook identity relationship — the authenticated link between a Void user account and a Facebook identity. A connection represents an active transport — the live socket or channel over which data flows. These are independent. A session can be valid while the connection is down (during reconnection). A connection can be open while the session is in the process of being refreshed. Conflating these two concepts produces incorrect handling of both.

### 2.4 Recovery Is a Design Requirement

Sessions will be interrupted. Server restarts occur. Network outages occur. Facebook invalidates sessions periodically. The session management system is not designed to prevent these interruptions — it is designed to survive them. Recovery from an interrupted session must be a first-class, explicitly designed capability — not an afterthought.

### 2.5 Security and Stability Are Inseparable

The session contains the most sensitive data in the system. A session that is insecurely stored, transmitted without encryption, or logged in any form is a security vulnerability. A session management system with security deficiencies will eventually produce a breach. Security and stability requirements on the session are not competing concerns — they are aspects of the same requirement.

---

## 3. Session Objectives

The session management system in Void is designed to achieve the following concrete objectives:

### 3.1 Long-Duration Stability
Maintain valid, usable Facebook sessions for months without requiring operator re-authentication, assuming Facebook does not forcibly revoke the session.

### 3.2 Transparent Recovery
Recover from server restarts, cache evictions, and process crashes without user-visible disruption, whenever a recoverable session state exists in persistent storage.

### 3.3 Single Source of Truth
Ensure that at any point in time, there is exactly one authoritative view of each account's session state — maintained exclusively by `SessionManager`.

### 3.4 Proactive Health Management
Detect session degradation — token near-expiry, AppState staleness, Facebook-side session changes — before they cause operational failures, and initiate corrective action proactively.

### 3.5 Secure State Management
Ensure that all session state, particularly AppState and tokens, is encrypted at rest, never logged, and accessible only to authorized components within the Facebook Layer.

### 3.6 Account Isolation
Guarantee that no session state belonging to one Void user account is ever accessible, readable, or inadvertently applied in the context of another account.

---

## 4. Session Lifecycle

Every Facebook session in Void progresses through a defined set of states. These states are not optional — every session follows this lifecycle. No state may be skipped, and no transition may occur that is not defined here.

```
              ┌─────────────────────────────────────────┐
              │                                         │
              ▼                                         │
         [ABSENT]                                       │
              │                                         │
       Authentication                                   │
         succeeds                                       │
              │                                         │
              ▼                                         │
         [CREATING]                                     │
              │                                         │
      Encryption + Storage                              │
         complete                                       │
              │                                         │
              ▼                                         │
         [ACTIVE] ◄─────── Recovery succeeds ────── [RECOVERING]
              │                                         ▲
              ├── Validation fails ──────────────► [DEGRADED]
              │                                         │
              ├── Near expiry ──────────────────► [REFRESHING]
              │         │                              │
              │    Refresh succeeds                    │
              │         └──────────────────────── [ACTIVE]
              │
              ├── Expiry confirmed ─────────────► [EXPIRED]
              │                                         │
              ├── Forced invalidation ──────────► [INVALIDATED]
              │                                         │
              └── Destroy requested ────────────► [DESTROYED]
                                                        │
                                             State purged from
                                            memory and storage
```

### State Definitions

| State | Meaning |
|---|---|
| `ABSENT` | No session exists for this account — never created, or previously destroyed |
| `CREATING` | Authentication has succeeded; session state is being encrypted and persisted |
| `ACTIVE` | Session is valid, persisted, and ready for use in Facebook operations |
| `DEGRADED` | Session exists but has failed validation — may be recoverable |
| `REFRESHING` | A session refresh is in progress; the existing session is still used for non-critical operations during refresh |
| `RECOVERING` | A session restoration is in progress after restart or eviction |
| `EXPIRED` | The session has exceeded its maximum lifetime or has been confirmed invalid by Facebook |
| `INVALIDATED` | The session has been forcibly terminated — by the user, by an admin, or by a security event |
| `DESTROYED` | The session has been permanently deleted from memory and all storage |

### Transition Rules

- Only `SessionManager` may advance a session from one state to another
- No external component may directly trigger a state transition — it may request actions (e.g., "destroy this session") that `SessionManager` processes
- A session in `EXPIRED`, `INVALIDATED`, or `DESTROYED` state must not be used for any Facebook operation
- A session in `REFRESHING` state is still valid for read operations; write operations should be queued until refresh completes

---

## 5. Session Creation

Session creation is the act of converting the output of a successful authentication into a persisted, managed session entity.

### 5.1 Creation Is Triggered by Authentication Success Only

A session is created exclusively as the result of a successful authentication event produced by `AuthenticationManager`. No other trigger is valid. `SessionManager` does not initiate authentication — it receives the authenticated state and takes ownership of it.

### 5.2 Creation Steps

1. **Receive authentication output:** `SessionManager` receives the raw session state (AppState, cookies, tokens) from `AuthenticationManager`
2. **Assign session identity:** A unique session ID is generated for this session — cryptographically random, not predictable
3. **Associate with account:** The session is linked to the exact Void user account ID and Facebook identity that produced it
4. **Record metadata:** Creation timestamp, expected expiry time, associated Facebook Page IDs or identity scope are recorded
5. **Encrypt session state:** All sensitive fields (AppState, cookies, tokens) are encrypted before any persistence
6. **Persist to storage:** The encrypted session record is written to the designated session storage
7. **Load into memory:** The session is loaded into `SessionManager`'s in-memory store for fast access
8. **Transition to ACTIVE:** The session state is set to `ACTIVE`
9. **Notify dependents:** `ConnectionController` is notified that a new active session is available

### 5.3 Creation Is Atomic

Session creation must succeed completely or not at all. A partially created session — one that is in memory but not persisted, or persisted but not in memory — is invalid. If any step in Section 5.2 fails, the entire creation is rolled back and the session is treated as ABSENT.

### 5.4 One Session Per Account Per Facebook Identity

`SessionManager` must enforce uniqueness: at most one active session per Void user account per Facebook identity. If a new session is created for an account that already has an active session, the existing session is invalidated before the new session is activated.

---

## 6. Session Initialization

Session initialization is the process that occurs when `SessionManager` starts up — loading persisted sessions from storage and making them available for use.

### 6.1 Initialization Sequence

At startup, `SessionManager` executes the following:

1. **Load session index:** Read the list of all persisted session records from storage
2. **Decrypt each record:** Decrypt the session payload for each persisted record
3. **Validate each session:** Run validation (Section 7) on each decrypted session
4. **Classify each session:**
   - Valid sessions: loaded into memory as `ACTIVE` (or `RECOVERING` pending live validation)
   - Expired sessions: marked as `EXPIRED`, not loaded into memory
   - Corrupted sessions: logged at `error` level (without exposing content), marked for deletion
5. **Clean up invalid records:** Remove expired and corrupted records from storage
6. **Signal readiness:** Notify the system that session initialization is complete

### 6.2 Initialization Must Complete Before Operations Begin

No Facebook operation may be attempted until `SessionManager` has completed initialization. The Facebook Layer must wait for the session initialization signal before accepting any operation requests from the Application Layer.

### 6.3 Initialization Errors Are Non-Fatal (Per Session)

A failure to load one session must not prevent other sessions from loading. Each session is initialized independently. An error in one session's initialization is logged and that session is marked as failed — but other sessions proceed normally.

---

## 7. Session Validation

Session validation is the process of determining whether a session is currently usable for Facebook operations.

### 7.1 Validation Dimensions

A session is considered valid only when all of the following are true:

| Dimension | Valid Condition |
|---|---|
| **Structural integrity** | The session record is complete — all required fields are present and parseable |
| **Temporal validity** | The session has not exceeded its maximum lifetime |
| **Token validity** | Associated tokens have not expired and have not been revoked |
| **AppState integrity** | The AppState is present, decryptable, and structurally sound |
| **Cookie integrity** | Required cookies are present and not expired |
| **Facebook confirmation** | Facebook's token introspection or equivalent confirms the session is accepted (live validation) |
| **Account association** | The session's account association matches the requesting context |

### 7.2 Levels of Validation

Validation occurs at two levels:

**Local validation** (fast, offline):
- Checks structural integrity, temporal validity, token expiry times, AppState presence
- Performed frequently — before each use, on recovery, at initialization
- Does not require a network call

**Live validation** (slow, online):
- Checks that Facebook still accepts the session
- Performed at initialization, after recovery, after a period of inactivity, and when local validation produces ambiguous results
- Results are cached with a short TTL to avoid excessive API calls

### 7.3 Validation Outcome

| Outcome | Action |
|---|---|
| Valid (local) | Session may be used immediately |
| Valid (live) | Session confirmed — update last-validated timestamp |
| Invalid — expired | Transition to `EXPIRED` — initiate re-authentication |
| Invalid — token revoked | Transition to `INVALIDATED` — notify user to reconnect |
| Invalid — structural corruption | Transition to `DESTROYED` — purge and re-authenticate |
| Invalid — ambiguous | Transition to `DEGRADED` — attempt recovery before failing |

### 7.4 Validation Must Not Be Bypassed

No component may use a session without having passed local validation. Live validation is required at defined intervals. There is no "trusted" path that skips validation for performance reasons. An unvalidated session is an unknown quantity — it must not be used.

---

## 8. Session Loading

Session loading is the process of retrieving a session from persistent storage and making it available in memory.

### 8.1 Loading Is Always Through SessionManager

No component loads a session directly from storage. All session loading goes through `SessionManager`, which handles decryption, validation, and state assignment. A component that loads a session from storage directly bypasses validation and encryption — this is categorically forbidden.

### 8.2 Loading Sequence

1. Retrieve the encrypted session record from storage (keyed by account ID or session ID)
2. Decrypt the session payload using the session encryption key
3. Deserialize the decrypted payload into the session object model
4. Run local validation (Section 7)
5. If valid: load into the in-memory session store, mark as `ACTIVE` (or `RECOVERING` pending live validation)
6. If invalid: handle according to the validation outcome table in Section 7.3

### 8.3 Decryption Failure

If a session record cannot be decrypted — because the encryption key has changed, the record is corrupted, or the format has changed — the session must be treated as unrecoverable. It must be logged at `error` level (without logging any session content) and purged. Re-authentication is required.

### 8.4 Loading Must Be Account-Scoped

When loading a session for an account, `SessionManager` must verify that the loaded session's account association matches the requested account ID before returning it. A session loaded for the wrong account is never returned — it is treated as a loading error.

---

## 9. Session Storage

Session storage is the mechanism by which session state is persisted across server restarts, process crashes, and cache evictions.

### 9.1 Storage Is Mandatory

Session persistence is not optional. A session that exists only in memory is lost on every restart. For a system designed to maintain connections over months, in-memory-only sessions are unacceptable. All active sessions must be persisted.

### 9.2 Storage Tiers

Session state is maintained in two tiers:

| Tier | Technology | Purpose | Lifetime |
|---|---|---|---|
| **Primary (in-memory)** | Application memory (`SessionManager` store) | Fast access during active operation | Process lifetime |
| **Persistent** | Encrypted database record | Survive restarts and crashes | Until explicitly deleted |

An optional intermediate cache tier (Redis) may be used for performance in multi-instance deployments but must never be the only persistent store.

### 9.3 Storage Format

The session record stored in the database must contain:

| Field | Description |
|---|---|
| `sessionId` | Unique session identifier (opaque, randomly generated) |
| `accountId` | The Void user account this session belongs to |
| `facebookIdentity` | The Facebook user or page identity associated with this session |
| `encryptedPayload` | The encrypted session state (AppState, cookies, tokens) |
| `encryptionKeyVersion` | The version of the encryption key used — enables key rotation |
| `createdAt` | Session creation timestamp (ISO 8601 UTC) |
| `lastValidatedAt` | Last time live validation confirmed the session |
| `lastUsedAt` | Last time the session was used for a Facebook operation |
| `expiresAt` | Calculated maximum expiry time |
| `status` | Current session status (mirrors the lifecycle state) |

### 9.4 Storage Writes Are Synchronous for Critical Updates

Session state changes that must survive a crash — creation, validation confirmation, expiry updates, invalidation — must be written to persistent storage synchronously (awaited) before the corresponding action is taken. A session cannot be considered `ACTIVE` until its encrypted record is confirmed written.

### 9.5 Storage Reads Are Verified

After reading a session from storage and decrypting it, the decrypted content must pass local validation before being used. A storage read is not an implicit trust — the stored record may have been written in a previous format, during a previous key version, or may have been corrupted.

---

## 10. Session Recovery

Session recovery is the process of restoring a working Facebook session from persisted state, after an interruption that caused the in-memory session to be lost.

### 10.1 Recovery Triggers

Recovery is triggered when:
- The application process restarts and `SessionManager` finds persisted sessions during initialization
- The in-memory session store is cleared (e.g., memory pressure, deliberate flush)
- A request arrives for an account whose session is not in memory but has a persisted record

### 10.2 Recovery Is Always Validated

Recovery is not simply loading a session from storage and declaring it active. Every recovered session must pass both local validation and live validation before being marked `ACTIVE`. A session that passes local validation but fails live validation has expired or been revoked during the outage — it must not be used.

### 10.3 Recovery Sequence

1. Load the encrypted session record from storage (Section 8)
2. Run local validation
3. If local validation fails: classify the failure and handle per Section 7.3 — do not proceed to live validation
4. Run live validation against Facebook
5. If live validation succeeds: transition to `ACTIVE`, update `lastValidatedAt`, notify `ConnectionController`
6. If live validation fails: classify as `EXPIRED` or `INVALIDATED` based on the failure reason — initiate re-authentication

### 10.4 Recovery Must Be Account-Scoped

A session recovered for account A must never be used for account B. Recovery includes verifying the session's account association at every step.

### 10.5 Partial Recovery Is Acceptable

If only some accounts' sessions can be recovered (e.g., some stored records are corrupted), the successfully recovered sessions must be made available immediately. Failed recoveries must not block the recovery of other sessions. Each session recovers independently.

### 10.6 Recovery Window

If a session was last validated more than a defined maximum age before the recovery attempt, it must be treated as suspect regardless of its stored status. The maximum recovery age represents the longest period after which `SessionManager` can confidently assert the session is still valid without live verification. This window is configurable per deployment.

---

## 11. Session Refresh Strategy

Session refresh is the process of updating session state — renewing tokens, refreshing AppState, extending validity — without destroying and recreating the session.

### 11.1 Refresh Is Proactive

Sessions must be refreshed before they expire — not after. `SessionManager` monitors each active session's expiry time and initiates a refresh when the session enters a defined pre-expiry window. Reactive refresh (waiting for a Facebook API rejection before refreshing) is unreliable and causes visible operation failures.

### 11.2 Pre-Expiry Window

The pre-expiry window is the period before a session's expiry during which refresh is initiated. The window must be long enough that:
- The refresh operation has time to complete before expiry
- If the first refresh attempt fails, at least one retry is possible before expiry

The pre-expiry window must be configured per session type and must not be shorter than the maximum expected refresh duration plus the configured retry delay.

### 11.3 Refresh Without Disruption

When possible, a session refresh must complete without interrupting ongoing Facebook operations. During refresh:
- The existing session remains available for operations
- New operations may be queued briefly while the refresh completes (if refresh requires momentary session unavailability)
- The refreshed session state replaces the old state atomically — there is no moment where neither old nor new state is available

### 11.4 Refresh Atomicity

The transition from old session state to new session state must be atomic. The in-memory session and the persisted session must both be updated in the same operation. A state where one is updated and the other is not is invalid.

### 11.5 Refresh Failure

If refresh fails:
- The existing session remains in use if it has not yet expired
- The refresh is retried according to the retry policy
- If all retries are exhausted before session expiry: `SessionManager` transitions the session to `EXPIRED` and initiates re-authentication
- If all retries are exhausted after session expiry: `SessionManager` immediately transitions to `EXPIRED`

### 11.6 Refresh Is Separate from Re-Authentication

A refresh extends an existing valid session. Re-authentication creates a new session from credentials. These are distinct operations. Refresh is preferred when possible because it does not require user credentials and is less disruptive. Re-authentication is the fallback when refresh cannot succeed.

---

## 12. Session Expiration

Expiration is the natural end of a session's valid lifetime.

### 12.1 Expiry Sources

A session may expire for the following reasons:

| Expiry Source | Description |
|---|---|
| **Absolute TTL** | The session has existed longer than the system's configured maximum session lifetime |
| **Token expiry** | The session's associated access token has passed its expiry time |
| **Inactivity** | The session has not been used within the configured inactivity window |
| **Facebook-side expiry** | Facebook has invalidated the session on its side (detected via live validation or API rejection) |
| **AppState staleness** | The AppState has not been refreshed within the maximum AppState age window |

### 12.2 Expiry Detection

`SessionManager` checks for expiry at three points:
1. **Continuously:** A background process checks active sessions against their expiry times on a defined interval
2. **On use:** Before every Facebook operation, the session is checked against its expiry time
3. **On live validation:** Live validation confirms whether Facebook still considers the session valid

### 12.3 Expiry Transition

When expiry is detected:
1. The session state is transitioned to `EXPIRED`
2. Ongoing operations using the session are allowed to complete if close to finished; new operations are rejected
3. `ConnectionController` is notified
4. The Application Layer is notified that the account requires re-authentication
5. The expired session record is retained in storage for audit purposes for a defined period before deletion

### 12.4 Expiry Is Not Destruction

An expired session is not immediately destroyed. It is marked as `EXPIRED` and retained for a short period. This allows:
- Post-expiry audit trail
- Forensic analysis if the expiry was unexpected
- Graceful user notification without race conditions

---

## 13. Session Invalidation

Invalidation is the forced termination of a session before its natural expiry.

### 13.1 Invalidation Triggers

A session must be invalidated when:
- The associated Void user account disconnects their Facebook account
- An administrator forces a session termination
- A security event requires immediate session revocation (suspected credential theft, account takeover)
- A new session is created for the same account (the old session is invalidated to prevent duplication)
- Facebook reports that the session has been revoked (via API response or webhook)

### 13.2 Invalidation Is Immediate

Unlike expiry (which is a scheduled event), invalidation takes effect immediately. From the moment of invalidation:
- The session may not be used for any new Facebook operation
- In-flight operations already using the session are allowed to complete
- The session is removed from the in-memory store immediately
- The persistent record is updated to `INVALIDATED` status immediately

### 13.3 Invalidation vs. Expiry

| Aspect | Expiry | Invalidation |
|---|---|---|
| Cause | Natural lifetime exceeded | Forced termination |
| Timing | Scheduled, predictable | Immediate, unpredictable |
| Recovery | Re-authentication required | Re-authentication required |
| Audit record | Retained briefly | Retained for security review |
| Notification | Standard lifecycle notification | Security-level notification |

---

## 14. Session Destruction

Destruction is the permanent, irreversible deletion of all session state from memory and all storage.

### 14.1 Destruction Triggers

A session is destroyed when:
- The session has been in `EXPIRED` or `INVALIDATED` state for longer than the retention period
- The associated Void user account is permanently deleted
- An explicit destruction request is received from an authorized actor
- Storage cleanup identifies orphaned session records with no corresponding active account

### 14.2 Destruction Is Complete

Destruction removes all traces of the session:
- In-memory session object is cleared and all references released
- The persistent session record is deleted from the database
- Any cached session data in intermediate tiers is invalidated
- Any associated encryption key material that is session-specific is revoked

### 14.3 Destruction Is Irreversible

A destroyed session cannot be recovered. If reconnection is needed after destruction, re-authentication is the only path. `SessionManager` must confirm destruction is appropriate before executing — there is no "are you sure" step in the automated flow, but destruction cannot be undone.

### 14.4 Audit Record Before Destruction

Before destroying a session, `SessionManager` must write an audit record confirming the destruction event — including: session ID, account ID, destruction reason, and timestamp. The audit record survives the session destruction and is retained per the audit log retention policy.

---

## 15. Session Persistence

Session persistence is the ongoing synchronization between in-memory session state and persistent storage.

### 15.1 Write-Through Policy

Every change to session state is written to persistent storage immediately (write-through) — not batched or deferred. This ensures that a process crash at any moment does not result in lost session state.

### 15.2 What Is Persisted

The following are always persisted synchronously on change:
- Session lifecycle state transitions
- Token values (encrypted)
- AppState (encrypted)
- Cookie state (encrypted)
- `lastUsedAt` and `lastValidatedAt` timestamps
- Expiry time updates

### 15.3 What Is Not Persisted

The following are in-memory only and are not persisted:
- Transient operational state (e.g., whether a refresh is currently in progress)
- In-flight request references
- Subscriber lists

### 15.4 Persistence Failures

If a persistence write fails:
- The in-memory state is still updated (to allow operations to continue)
- The failure is logged at `error` level
- A retry is scheduled immediately
- If the retry fails, an alert is raised — the session is operating without persistence guarantee
- The session is not terminated solely because persistence is temporarily unavailable

---

## 16. Session State Management

### 16.1 SessionManager Is the Single Source of Truth

`SessionManager` holds the authoritative state for every managed session. This is not a preference — it is an invariant. Any component that needs to know the state of a session must query `SessionManager`. Any component that needs to use a session must request it from `SessionManager`. No component maintains its own copy of session state.

### 16.2 State Is Read-Only Outside SessionManager

When `SessionManager` provides session information to a requesting component, it provides a read-only view — a snapshot of the session's current state. The requesting component cannot modify this snapshot. If a component needs to change session state, it must invoke a `SessionManager` operation — not mutate the snapshot directly.

### 16.3 State Consistency

`SessionManager` ensures that the in-memory state and the persisted state are always consistent. There must be no period where the in-memory session is `ACTIVE` and the persisted record is `EXPIRED`, or vice versa. State transitions update both simultaneously.

### 16.4 Concurrent Access Management

Multiple concurrent requests may attempt to use or modify the same session. `SessionManager` must serialize modifications to a given session — not permit two concurrent state transitions on the same session. Reads may be concurrent; writes must be serialized.

---

## 17. AppState Policy

AppState is the serialized Facebook session artifact produced by Facebook's authentication flow. It encapsulates the complete state of an authenticated Facebook session in a format recognized by Facebook's systems.

### 17.1 When AppState Is Used

AppState is used in exactly the following scenarios:
- **Connection establishment:** AppState is the credential used to initiate the Facebook connection after authentication
- **Reconnection:** AppState from the persisted session is used to re-establish a connection after interruption
- **Session validation:** AppState is examined (structurally, not operationally) during validation to confirm it is present and well-formed

### 17.2 When AppState Is Updated

AppState must be updated when:
- A successful authentication produces new AppState
- A successful refresh produces updated AppState
- Facebook's session operations return an updated AppState as part of their response
- The AppState's internal token or cookie references have been refreshed

AppState must be re-encrypted and re-persisted immediately after every update.

### 17.3 When AppState Is Ignored

AppState must be ignored — and the session must be treated as degraded or expired — when:
- The AppState cannot be decrypted (key change, corruption)
- The AppState's internal structure does not match the expected schema
- The AppState's embedded timestamps indicate it is beyond its maximum age
- Live validation with this AppState has failed

### 17.4 When AppState Is Considered Invalid

AppState is invalid when any of the following is true:
- It is absent from a session record that requires it
- It fails structural integrity checks (required fields missing, unexpected format)
- It contains tokens or cookies that are individually expired
- It has not been refreshed within the maximum AppState age window
- Facebook has returned an authentication failure when using it

### 17.5 Handling Corrupted or Expired AppState

When AppState is found to be corrupted or expired:
1. The session is transitioned to `DEGRADED`
2. `SessionManager` attempts to determine if any other component of the session (tokens, cookies independently) allows recovery
3. If recovery is possible: refresh is attempted
4. If recovery is not possible: the session is transitioned to `EXPIRED` and re-authentication is requested
5. The corrupted AppState is never used for a Facebook operation — not even as a "best effort" fallback

### 17.6 AppState Security Requirements (Summary)

- AppState must never be logged at any level
- AppState must be encrypted before any persistence
- AppState must be held in memory only for the duration of the operation that requires it
- AppState must never be passed outside the Facebook Layer boundary
- AppState must never be shared between user accounts

---

## 18. Cookie Policy

### 18.1 The Role of Cookies in Session Lifecycle

Facebook session cookies are a component of the session state — they represent Facebook's browser-side session artifacts. In the context of Void, they are part of the session payload managed by `SessionManager` and used by the Facebook transport layer. They are not HTTP cookies in the traditional web sense — they are session state artifacts stored server-side as part of AppState.

### 18.2 When Cookies Are Used

Session cookies are used when:
- Establishing or reestablishing a Facebook connection (as part of AppState presented to Facebook)
- Refreshing session state (cookies may be updated as part of refresh)
- Live validating the session (cookie presence is checked as part of structural validation)

### 18.3 When Cookies Are Discarded

Session cookies associated with a session must be discarded when:
- The session is invalidated or destroyed
- The cookies are found to be individually expired
- A new authentication produces a new cookie set (the old cookies are replaced, not merged)
- The cookies fail structural integrity validation

Discarded cookies must be removed from the session record and the updated record persisted immediately.

### 18.4 Maintaining Cookie Integrity

Cookie integrity is maintained through:
- **Encryption:** Cookies stored in the session record are encrypted as part of the AppState payload
- **Freshness tracking:** The age of the cookie set is tracked; cookies older than the maximum cookie age are flagged for refresh
- **Consistency checking:** During validation, cookies are checked for internal consistency — required cookies present, none individually expired
- **Atomic replacement:** When cookies are refreshed, the entire cookie set is replaced atomically — partial updates that leave old and new cookies mixed are not permitted

### 18.5 Cookie Isolation

Each account's cookie set belongs exclusively to that account's session. Cookie sets must never be:
- Mixed between accounts
- Applied to a session they were not created for
- Logged in any form (name or value)
- Returned in API responses
- Accessible outside the Facebook Layer

---

## 19. Authentication State

Authentication state is the output of a successful authentication event, before it becomes a persisted session. It exists transiently — produced by `AuthenticationManager` and immediately consumed by `SessionManager`.

### 19.1 Authentication State Is Not Session State

Authentication state and session state serve different purposes:
- **Authentication state:** The raw output of an authentication operation — credentials confirmed, initial AppState received, tokens issued
- **Session state:** The persisted, managed entity that `SessionManager` creates from authentication state

Authentication state exists only between the moment authentication succeeds and the moment `SessionManager` completes session creation. It must not persist beyond this moment.

### 19.2 Separation of Authentication and Session Management

`AuthenticationManager` is responsible for authentication — validating credentials and receiving initial session artifacts from Facebook. `SessionManager` is responsible for session management — taking those artifacts and creating a managed, persisted session.

These responsibilities must not be conflated. `AuthenticationManager` does not store sessions. `SessionManager` does not authenticate. This separation ensures that:
- Authentication logic can change without affecting session management
- Session management logic can change without affecting authentication
- Each component can be tested independently

### 19.3 Authentication State Lifetime

Authentication state exists in memory only, for the duration of the session creation operation. Once `SessionManager` has encrypted and persisted the session, the raw authentication state must be released. It must never be stored, passed to other components, or retained for potential future use.

---

## 20. Reconnect Strategy

Session-aware reconnection is the process of restoring a Facebook connection using existing session state, without requiring re-authentication.

### 20.1 Reconnect Is Session-First

When `ReconnectManager` initiates a reconnect, the first action is always to attempt using the existing session. Re-authentication is the fallback — not the first choice. Using an existing valid session is faster, less disruptive, and does not require user credentials.

### 20.2 Session Assessment Before Reconnect

Before attempting a reconnect, `SessionManager` must assess the current session:

| Assessment Result | Reconnect Action |
|---|---|
| Session is valid (local validation passes) | Attempt reconnect with existing session |
| Session is degraded (needs live validation) | Attempt reconnect; validate live as part of reconnect |
| Session is expired (local validation fails — expired) | Re-authentication required before reconnect |
| Session is absent | Re-authentication required before reconnect |

### 20.3 Reconnect Must Not Create a New Session

`ReconnectManager` uses the existing session — it does not create a new one. Only a successful re-authentication produces a new session. A reconnect that succeeds without re-authentication must update the existing session's metadata (`lastUsedAt`, `lastValidatedAt`) — it must not create a duplicate session.

### 20.4 Post-Reconnect Validation

After a successful reconnect, `SessionManager` must confirm the session is still valid by running live validation. A reconnect that uses a stale session may appear to succeed at the transport level while Facebook will reject the first API call. Live validation catches this before it causes operational failures.

### 20.5 Session State During Reconnect

While reconnection is in progress:
- The session's in-memory state is `RECOVERING`
- No new Facebook operations are accepted (or they are queued pending reconnect)
- The session's persisted record is not modified until reconnect either succeeds (update metadata) or fails (update status)

---

## 21. Session Health Monitoring

Session health monitoring is the ongoing assessment of whether a session is in good condition and likely to remain usable.

### 21.1 Health Dimensions

Session health is assessed across the following dimensions:

| Dimension | Healthy | Degraded | Critical |
|---|---|---|---|
| Time to expiry | > pre-expiry window | Within pre-expiry window | Already expired |
| Last validation age | < max validation interval | Approaching max interval | Exceeded max interval |
| Last use age | Recent activity | Approaching inactivity limit | Inactivity limit exceeded |
| AppState age | < max AppState age | Approaching max AppState age | Exceeded max AppState age |
| Consecutive API failures | 0 | 1–2 | ≥ 3 |

### 21.2 Health Check Frequency

`SessionManager` must perform health checks on all active sessions:
- **High frequency:** Every check interval (configurable, default: every 5 minutes) for active sessions
- **On use:** A lightweight local health check before each session use
- **On recovery:** Full health check (local + live) after every recovery operation
- **On reconnect:** Full health check after every reconnect

### 21.3 Health Check Outcomes

| Health State | Action |
|---|---|
| Healthy | No action required |
| Degraded — approaching expiry | Initiate proactive refresh |
| Degraded — validation stale | Schedule live validation |
| Critical — expired | Transition to `EXPIRED`, initiate re-authentication |
| Critical — consecutive failures | Transition to `DEGRADED`, initiate recovery assessment |

### 21.4 Health Is Reported, Not Acted Upon Directly

`SessionManager` reports session health to `ConnectionHealthMonitor`. `ConnectionHealthMonitor` aggregates session health with other health signals and makes decisions about reconnection and alerts. `SessionManager` initiates refresh and re-authentication — but it reports health rather than triggering reconnection directly.

---

## 22. Heartbeat Strategy

The heartbeat serves as a regular signal that the session and connection remain active and mutually recognized.

### 22.1 Heartbeat as Session Health Signal

A successful heartbeat response from Facebook confirms that:
- The transport connection is alive
- Facebook still recognizes the session

A failed or absent heartbeat response — silence — is a signal that the session or connection may be degraded. This signal is reported to `ConnectionHealthMonitor` for aggregation.

### 22.2 Heartbeat Is Managed by HeartbeatMonitor, Not SessionManager

`SessionManager` does not send heartbeats. `HeartbeatMonitor` manages the heartbeat schedule. However, `SessionManager` must update `lastUsedAt` when a heartbeat is sent — to prevent inactivity-based expiry for sessions that are technically active but not sending application-level messages.

### 22.3 Heartbeat Failure vs. Session Failure

A heartbeat failure is not automatically a session failure. A single missed heartbeat may indicate a momentary network issue. `ConnectionHealthMonitor` determines when accumulated heartbeat failures indicate a session or connection problem requiring action.

---

## 23. Multi-Session Support

Void supports multiple simultaneous Facebook sessions — one per Void user account per connected Facebook identity.

### 23.1 Session Isolation Is the Default

Each session is isolated from every other session. Operations on account A's session have no effect on account B's session. A failure of account A's session does not cause account B's session to fail.

### 23.2 SessionManager Manages All Sessions

`SessionManager` is responsible for all active sessions simultaneously. There is one `SessionManager` — not one per account or per session. A single `SessionManager` instance manages the full collection of sessions with account-level isolation enforced internally.

### 23.3 No Cross-Account Operations

There is no operation that takes state from one account's session and applies it to another. Each session is created, maintained, and destroyed in isolation. `SessionManager` enforces this at every operation.

### 23.4 Resource Allocation Per Session

Each session consumes a defined set of resources (memory, storage records, heartbeat slots, validation slots). When the total number of active sessions approaches the system's resource limits, `SessionManager` must enforce limits — rejecting new session creation or evicting the least recently used sessions — rather than allowing unbounded resource growth.

---

## 24. Session Isolation

Session isolation ensures that one account's session cannot contaminate, interfere with, or be confused with another account's session.

### 24.1 Isolation Guarantees

`SessionManager` guarantees:
- Every session is retrieved by account ID — not by position, sequence, or any other implicit identifier
- No operation on one session modifies any field of another session
- A failure to load or validate one session produces no side effect on other sessions
- Encryption keys are per-session or per-account — not shared across accounts

### 24.2 Context Propagation

Every request that involves session access must carry an account ID. `SessionManager` uses this account ID to scope every operation. A request that arrives without an account ID must be rejected — there is no "current session" concept that applies across accounts.

### 24.3 Isolation in Multi-Instance Deployments

When multiple application instances run concurrently (horizontal scaling), session isolation must be maintained across instances. Concurrent operations from different instances on the same account's session must be coordinated — typically via the distributed session store — to prevent conflicting state transitions.

---

## 25. Session Synchronization

When multiple instances of the application run concurrently, session state must be synchronized to prevent conflicts.

### 25.1 Persistent Storage as the Synchronization Point

The persistent session store (database) is the synchronization point for multi-instance deployments. The in-memory store is a cache. Decisions that affect session state must go through the persistent store.

### 25.2 Optimistic Locking

Session state updates in the persistent store must use optimistic locking — each update includes the version number of the record being updated. If the version has changed since the record was last read (another instance updated it), the update is rejected and the operation is retried with the latest state.

### 25.3 Leader Election for Refresh

If multiple instances may simultaneously detect that a session needs refreshing, only one instance must execute the refresh. Leader election — via a distributed lock or a claim mechanism in the persistent store — ensures that only one instance executes the refresh while others wait for the result.

---

## 26. Session Backup Strategy

Session backup ensures that session state can be recovered from infrastructure failures beyond a single database instance failure.

### 26.1 Session Records in Database Backup

Session records are part of the application database and are therefore included in database backups. The backup policy defined in `09-security-policy.md` applies — specifically, backups must be encrypted and access-controlled.

### 26.2 Post-Restore Session Validation

After a database restore:
- All restored sessions must go through live validation before being used
- Sessions that fail live validation after restore must be treated as `EXPIRED`
- The `lastValidatedAt` timestamp is reset to the restore timestamp — all sessions are treated as needing immediate re-validation

### 26.3 Session State Is Not a Backup Mechanism

The session state is operational state — it must not be used as a mechanism for backing up user data. Session records contain only what is needed to maintain a Facebook connection, not user-facing content.

---

## 27. Failure Recovery

### 27.1 SessionManager Failure

If `SessionManager` itself encounters an unrecoverable error:
- All Facebook operations must be suspended — no operation can proceed without session management
- A restart of the `SessionManager` component must trigger the initialization sequence (Section 6)
- In-flight operations must be treated as failed — callers are notified
- The failure must be logged at `fatal` level and an alert raised

### 27.2 Storage Failure During Operation

If the persistent store becomes unavailable during operation:
- In-memory sessions continue to be used (sessions in memory are still valid)
- State changes that require persistence are queued
- An alert is raised immediately
- If storage is unavailable for longer than the configured maximum, fresh session creation is suspended (cannot create sessions without persistence)

### 27.3 Recovery from Corrupted Storage

If session records in the persistent store are found to be corrupted at initialization:
- Corrupted records are quarantined (not deleted immediately — for forensic review)
- The accounts with corrupted sessions are marked as requiring re-authentication
- Clean records are loaded normally
- An alert is raised for each corrupted record

### 27.4 Key Rotation Recovery

If the session encryption key is rotated and old records cannot be decrypted with the new key:
- `SessionManager` must support key versioning (each record stores the key version used to encrypt it)
- Old records are re-encrypted with the new key in a background process
- Sessions that cannot be re-encrypted (key truly lost) must be treated as unrecoverable

---

## 28. Security Considerations

Session management is the highest-risk operational domain in Void. Security requirements from `09-security-policy.md` apply in full. The following session-specific security requirements supplement the general security policy.

### 28.1 Session IDs Must Be Unpredictable

Session IDs must be generated using a CSPRNG with a minimum of 128 bits of entropy. Sequential, predictable, or user-controlled session IDs are categorically forbidden. A predictable session ID allows an attacker to enumerate sessions.

### 28.2 Session Fixation Prevention

When a user upgrades from an unauthenticated state to an authenticated one, the session must be regenerated. A session established before authentication must not carry over into the authenticated state. This applies equally to Facebook sessions — a pre-authentication transport context must not carry over to a post-authentication session.

### 28.3 Session Hijacking Prevention

The combination of:
- Encrypted session state (prevents reading even if storage is accessed)
- Account-scoped session access (prevents one account accessing another's session)
- Unpredictable session IDs (prevents guessing)
- No logging of session content (prevents exposure via log systems)

...constitutes the primary defense against session hijacking within Void's control boundary.

### 28.4 Session Data Must Not Leave the Facebook Layer

Session state — AppState, cookies, tokens — must never be exposed via an API response, included in a log, passed to a plugin, or accessed by any component outside the Facebook Layer. The Facebook Layer boundary is the session containment boundary.

---

## 29. Performance Considerations

### 29.1 In-Memory Caching Is the Primary Access Path

The primary access path for session state is the in-memory store. Persistent storage is consulted on initialization, recovery, and synchronization — not on every Facebook operation. The in-memory store must be optimized for fast lookup by account ID.

### 29.2 Validation Must Not Block Operations Unnecessarily

Local validation is fast and must be performed before every session use. Live validation is slow (requires a network call) and must not be performed before every session use. Live validation is scheduled based on elapsed time since last validation — not per-operation.

### 29.3 Encryption and Decryption Are Off the Hot Path

Session encryption and decryption occur when state is persisted and loaded — not on every use. The in-memory session object is the decrypted, ready-to-use form. Encrypting and decrypting on every access would create unacceptable latency.

### 29.4 Session Refresh Must Not Block the Application

Session refresh is an asynchronous background operation. It must not block the application from serving requests. The existing session remains available during refresh. Refresh completion triggers an atomic state update, not a blocking transition.

---

## 30. Common Failure Scenarios

Understanding common failure scenarios enables proactive design and faster diagnosis.

### 30.1 Session Expired During Server Downtime

**Scenario:** The server is down for maintenance. When it restarts, persisted sessions are loaded but their tokens have expired during the downtime.  
**Detection:** Live validation fails during recovery.  
**Correct response:** Sessions are marked `EXPIRED`. Re-authentication is required for each affected account. Users are notified.

### 30.2 AppState Corrupted by Storage Failure

**Scenario:** A storage write fails mid-operation, leaving a session record with corrupted AppState.  
**Detection:** Decryption succeeds but structural validation of AppState fails.  
**Correct response:** Session is marked `DEGRADED`. Recovery is attempted using other session components. If unsuccessful, session is marked `EXPIRED` and re-authentication is required.

### 30.3 Facebook Silently Invalidates a Session

**Scenario:** Facebook invalidates a session server-side (due to policy enforcement, account action, or security event) without any notification to Void.  
**Detection:** The next Facebook API call using this session returns an authentication error. Live validation confirms the session is rejected.  
**Correct response:** Session is transitioned to `INVALIDATED`. The account is notified to reconnect.

### 30.4 Clock Skew Causes Premature Expiry

**Scenario:** The server's clock is ahead of Facebook's clock by a significant margin. Tokens appear expired locally but are still valid at Facebook.  
**Detection:** Local validation marks session as `EXPIRED`, but live validation succeeds.  
**Correct response:** Trust live validation over local time-based checks. Update local expiry metadata from the live validation result. Address the clock skew as an infrastructure issue.

### 30.5 Concurrent Refresh Race Condition

**Scenario:** Two instances of the application simultaneously detect that the same session needs refreshing and both begin the refresh operation.  
**Detection:** The second refresh operation finds the session has already been updated (optimistic lock version mismatch).  
**Correct response:** The second instance detects the version conflict, loads the already-refreshed session, and proceeds without executing its own refresh.

### 30.6 Session Storage Exhaustion

**Scenario:** The session storage runs out of capacity (disk space, row limits, connection limits).  
**Detection:** Write operations to the session store begin failing.  
**Correct response:** Alert raised. New session creation is suspended. Expired and destroyed sessions are cleaned up aggressively to free space. Existing in-memory sessions continue to operate.

---

## 31. Best Practices

1. **Monitor session health proactively.** Do not wait for Facebook API failures to discover that a session has expired. Health monitoring must detect approaching expiry and trigger refresh before the session becomes unusable.

2. **Always validate after recovery.** A recovered session must never be trusted solely on the basis of what was stored. Live validation confirms Facebook's current view of the session.

3. **Refresh early, not at the last moment.** A refresh initiated 48 hours before expiry has time to fail and retry. A refresh initiated 5 minutes before expiry may not.

4. **Treat refresh failure as a signal, not just an error.** Repeated refresh failures may indicate that Facebook has changed its session handling, that the account has been restricted, or that a security event has occurred. Escalate to the operator rather than indefinitely retrying.

5. **Never skip encryption.** Even in development and test environments, session state must be encrypted before storage. Developing with unencrypted sessions creates habits and code paths that may leak into production.

6. **Audit session destruction events.** Every session destruction must produce an audit record. Unexpected session destructions — ones not initiated by user action or operator command — are security signals.

7. **Implement and test recovery regularly.** Session recovery is a critical path that is rarely exercised in normal operation. If it is never tested, it may fail when it is needed most. Regular simulated restarts should confirm that recovery works as designed.

8. **Document session dependencies explicitly.** Every component that depends on sessions must declare that dependency clearly. Hidden dependencies on session state create fragility.

---

## 32. Forbidden Session Practices

The following practices are categorically forbidden. Any instance found in code review must be rejected and corrected before merge.

### 32.1 Creating a Session Outside of SessionManager

Any code that creates a Facebook session — encrypts session state, writes a session record to storage, or registers a session in memory — outside of `SessionManager` is an architectural violation. There is one session creation path and it is `SessionManager`.

### 32.2 Modifying AppState Directly

AppState is an internal artifact of the session. No component — not even within the Facebook Layer — may modify AppState directly. AppState is updated only as part of a `SessionManager`-managed session update operation. Direct modification bypasses encryption, validation, and persistence.

### 32.3 Modifying Cookies from Outside the Facebook Layer

Cookie state associated with Facebook sessions is managed exclusively within the Facebook Layer, through `SessionManager`. No component outside the Facebook Layer may read, write, or modify these cookies. They are not accessible at the HTTP middleware layer, the application layer, or any other layer.

### 32.4 Maintaining a Second Source of Session State

Any component that maintains its own copy of session state — a cached session object, a module-level session variable, a request-context session reference held beyond a single operation — creates a second source of truth. This second source will inevitably diverge from `SessionManager`'s authoritative state. All session access must go through `SessionManager` for every operation.

### 32.5 Storing Invalid Sessions

`SessionManager` must not persist a session that has failed validation. Persisting an invalid session creates a record that will fail on every recovery attempt, consuming storage and producing misleading audit trails. Only sessions that pass creation validation are persisted.

### 32.6 Sharing Session Data Between Components Without Defined Interfaces

Session data — session objects, AppState snapshots, token values — must not be passed between components as raw objects. All session data shared between components must go through `SessionManager`'s defined interfaces. Passing session data directly couples the receiving component to the session's internal structure.

### 32.7 Bypassing the Session Lifecycle

Transitions that skip lifecycle states are forbidden. A session cannot go from `ABSENT` to `ACTIVE` without passing through `CREATING`. A session cannot be used after being marked `EXPIRED` or `INVALIDATED`. The lifecycle is the definition of what is valid — bypassing it produces undefined behavior.

### 32.8 Using Sessions Across Account Contexts

A session belonging to account A must never be used in the context of account B, even temporarily, even for "compatibility" purposes, and even if both sessions appear identical. Account context is verified at every session access.

---

## 33. Anti-Patterns

### 33.1 The Ambient Session

A module-level or globally-accessible session variable used for "convenience" across multiple operations. This pattern emerges when developers want to avoid the overhead of querying `SessionManager` repeatedly. The result is a session reference that becomes stale without the using component knowing, leading to operations using an expired or invalidated session.

### 33.2 The Optimistic Reconnect

Reconnecting to Facebook and immediately beginning operations without first validating that the session is still accepted. This pattern produces a brief period of apparent success followed by immediate API failures as Facebook rejects the stale session.

### 33.3 The Session-as-Config Pattern

Storing non-session configuration (feature flags, account preferences, operational settings) inside the session record for convenience. Session records are designed for session state — they have a defined lifecycle and may be destroyed at any time. Operational configuration stored in session records is lost when the session is destroyed.

### 33.4 The Silent Session Use

Using a session without performing local validation, on the assumption that "it was valid 30 seconds ago." Session validity can change at any time — Facebook can invalidate a session server-side at any moment. Every use must pass at least local validation.

### 33.5 The Parallel SessionManager

Instantiating multiple `SessionManager` instances, each managing a subset of accounts. This pattern is introduced to improve performance or scalability. The result is that different instances may have conflicting views of the same session, and there is no single authoritative source of truth. Scalability must be achieved through other means — not by fragmenting `SessionManager`.

### 33.6 The Eager Session Load

Loading all sessions for all accounts into memory at startup, regardless of whether those sessions will be used. This pattern degrades startup time, consumes excessive memory, and produces unnecessary live validation calls. Sessions should be loaded on demand — when an account's Facebook connection is first needed.

---

## 34. AI Session Rules

This section defines how an AI system must reason about session management when developing within the Void project.

### 34.1 Identify the Session Concern Before Writing Code

Before writing any code that involves session state, the AI must identify:
1. Which lifecycle phase does this code operate in? (Creation, initialization, validation, loading, storage, recovery, refresh, expiration, invalidation, destruction)
2. Is this code within `SessionManager`? If not, why is it touching session state?
3. What session data does this code need, and how should it obtain it (through `SessionManager`'s interfaces)?

### 34.2 The AI Must Not Create Session State Outside SessionManager

The AI must never generate code that:
- Creates a session object outside of `SessionManager`
- Writes session data (AppState, cookies, tokens) to any storage directly
- Maintains a local copy of session state across multiple operations
- Modifies session state by reference received from `SessionManager`

If a requested feature appears to require creating session state outside `SessionManager`, the AI must refuse and propose an implementation that works within `SessionManager`'s boundaries.

### 34.3 The AI Must Not Generate a Second SessionManager

The AI must not create a second component that takes on session management responsibilities — even if it is named differently, even if it manages only a subset of sessions, and even if performance is cited as the motivation. If `SessionManager` has a performance problem, the solution is to optimize `SessionManager` — not to fragment its responsibility.

### 34.4 When to Refuse and Escalate

The AI must refuse to implement — and must request architectural review first — when:
- The requested change would create a second source of session state
- The requested change would modify the session lifecycle (add states, change transitions)
- The requested change would expose session state outside the Facebook Layer
- The requested change would bypass session validation for any use case

### 34.5 The AI Must Respect Account Isolation

Every code path generated by the AI that accesses session state must include account ID scoping. The AI must never generate session access code that is not scoped to a specific account context.

### 34.6 The AI Must Not Log Session Content

When generating logging statements near session management code, the AI must ensure that AppState, cookies, token values, and raw session objects are explicitly excluded from all log calls. If a session-related log is needed, the AI must log only metadata (session ID, account ID, lifecycle state, timestamps) — never session content.

### 34.7 The AI Must Recognize Session Lifecycle Boundaries

When generating code that interacts with sessions, the AI must verify that the operation is appropriate for the session's current lifecycle state. Generating code that sends a Facebook message using a session without first checking the session's lifecycle state is an error — expired and invalidated sessions must not be used.

### 34.8 Document Before Extending

If the AI identifies a genuine gap in the session management design — a lifecycle state not covered, a failure scenario not addressed, a recovery path not defined — it must first propose an extension to this document. Only after the extension is approved may the AI implement the corresponding code.

---

## 35. Review Checklist

Use this checklist for every code review that introduces or modifies session management code.

### Session Creation and Storage
- [ ] Sessions are created only within `SessionManager`
- [ ] Session creation is atomic — partial sessions are not possible
- [ ] Sessions are encrypted before any persistence
- [ ] Session records include all required metadata fields (Section 9.3)
- [ ] Session creation enforces one-session-per-account uniqueness

### Session Validation
- [ ] Local validation is performed before every session use
- [ ] Live validation is performed at the required intervals
- [ ] Validation failures result in correct lifecycle transitions (Section 7.3)
- [ ] Validation is not bypassed for any code path

### Session Lifecycle
- [ ] All lifecycle state transitions are performed only by `SessionManager`
- [ ] No lifecycle states are skipped
- [ ] Expired and invalidated sessions are never used for Facebook operations
- [ ] Destruction events produce audit records before deletion

### AppState and Cookie Handling
- [ ] AppState is never logged (any field, any level)
- [ ] AppState is encrypted before any persistence
- [ ] Cookies are managed only within the Facebook Layer
- [ ] Cookie state is not exposed outside the Facebook Layer boundary

### Session Isolation
- [ ] All session access is scoped by account ID
- [ ] No session data is shared between accounts
- [ ] No cross-account session operations are present

### Recovery and Refresh
- [ ] Recovered sessions are validated (local + live) before use
- [ ] Session refresh is proactive — initiated before expiry
- [ ] Refresh atomically updates both in-memory and persistent state
- [ ] Refresh failure falls back correctly without data loss

### Security
- [ ] Session IDs are generated with sufficient entropy
- [ ] No session content appears in any log statement
- [ ] Session data does not appear in API responses
- [ ] Concurrent session access is serialized for writes

### AI-Generated Code
- [ ] No session creation code exists outside `SessionManager`
- [ ] No raw session objects are passed between components
- [ ] No session state is modified directly by the receiving component
- [ ] Account ID scoping is present on all session access operations

---

*This document is the official and sole session management reference for the Void project. It is authoritative for all decisions related to session creation, lifecycle, storage, recovery, refresh, expiration, invalidation, destruction, AppState management, and cookie management. All engineers, contributors, and AI systems are bound by the policies defined here. This document must be consulted before any code is written that touches session state in any form. Changes to session management policy require updating this document before implementing code.*
