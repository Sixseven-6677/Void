# 09 — Security Policy

> **Status:** Official  
> **Scope:** All layers of Void — API, Domain, Infrastructure, Plugins, Commands, Schedulers, Cache, Facebook Integration, Session Management, Authentication, Authorization  
> **Authority:** This document is the single source of truth for all security decisions across the entire Void project. No layer, module, subsystem, contributor, or AI system is exempt. Security is not optional and not negotiable.

---

## Table of Contents

1. [Security Philosophy](#1-security-philosophy)
2. [Security Objectives](#2-security-objectives)
3. [Security Principles](#3-security-principles)
4. [Threat Model](#4-threat-model)
5. [Defense in Depth](#5-defense-in-depth)
6. [Least Privilege Principle](#6-least-privilege-principle)
7. [Sensitive Data Classification](#7-sensitive-data-classification)
8. [Authentication Security](#8-authentication-security)
9. [Authorization Security](#9-authorization-security)
10. [Session Security](#10-session-security)
11. [Facebook Security](#11-facebook-security)
12. [AppState Security](#12-appstate-security)
13. [Cookie Security](#13-cookie-security)
14. [Access Token Security](#14-access-token-security)
15. [Refresh Strategy](#15-refresh-strategy)
16. [Environment Variables Policy](#16-environment-variables-policy)
17. [Secret Management](#17-secret-management)
18. [Encryption Policy](#18-encryption-policy)
19. [Hashing Policy](#19-hashing-policy)
20. [Input Validation](#20-input-validation)
21. [Output Sanitization](#21-output-sanitization)
22. [Injection Prevention](#22-injection-prevention)
23. [Rate Limiting Strategy](#23-rate-limiting-strategy)
24. [Replay Attack Prevention](#24-replay-attack-prevention)
25. [Brute Force Protection](#25-brute-force-protection)
26. [Dependency Security](#26-dependency-security)
27. [File System Security](#27-file-system-security)
28. [Network Security](#28-network-security)
29. [Logging Security](#29-logging-security)
30. [Error Message Security](#30-error-message-security)
31. [Backup Security](#31-backup-security)
32. [Recovery Strategy](#32-recovery-strategy)
33. [Incident Response](#33-incident-response)
34. [Security Monitoring](#34-security-monitoring)
35. [Common Vulnerabilities](#35-common-vulnerabilities)
36. [Forbidden Security Practices](#36-forbidden-security-practices)
37. [AI Security Rules](#37-ai-security-rules)
38. [Security Review Checklist](#38-security-review-checklist)

---

## 1. Security Philosophy

Security in Void is a design discipline — not a feature, not an afterthought, and not a checklist applied at the end of development. Every architectural decision, every API contract, every data model, and every line of code is made with security as a first-class constraint alongside correctness and performance.

The fundamental premise is this: **the system will be attacked.** Not might be. Will be. Automated scanners, credential stuffing bots, API abuse, and targeted attacks are not exceptional events — they are the ambient background of operating any internet-connected service. The question is not whether someone will attempt to compromise Void, but whether they will succeed when they do.

### Core Security Axioms

1. **Security is built in, not bolted on.** A system that was designed without security cannot be made secure by adding checks at the edges. Security constraints must shape the architecture from the beginning.

2. **All external input is hostile until proven otherwise.** Data from users, clients, third-party APIs, webhooks, environment files, and even internal services must be validated before it influences system behavior. Trust is earned per input, per operation — never assumed.

3. **The principle of least surprise cuts both ways.** Systems that behave predictably are easier to reason about for developers. Systems that behave predictably are also easier to exploit. Predictability in security boundaries must be balanced with unpredictability in attack surfaces.

4. **Data has gravity.** Sensitive data that enters the system tends to propagate — into logs, error messages, audit records, caches, and exports. Every place sensitive data is allowed to flow must be an explicit, deliberate decision.

5. **A security failure is not just a technical event.** It is a breach of trust with every user whose data is affected. That trust, once broken, is extremely difficult to rebuild. The cost of a breach — regulatory, legal, reputational — far exceeds the cost of prevention.

6. **Security debt compounds like financial debt.** A shortcut taken today creates a vulnerability that will exist until it is fixed — and it may be exploited before it is found. Security shortcuts must not be accepted under schedule pressure.

---

## 2. Security Objectives

The Void security program has the following concrete objectives:

### 2.1 Confidentiality
Sensitive data — user credentials, authentication tokens, Facebook access tokens, session state, personal information — must be accessible only to systems and users with an explicit, verified need. Data at rest and in transit must be protected from unauthorized access.

### 2.2 Integrity
Data must not be modified by unauthorized parties. Operations that mutate state must be authenticated, authorized, and validated. The system must detect and reject attempts to tamper with data, tokens, or session state.

### 2.3 Availability
The system must resist denial-of-service conditions — whether from malicious abuse, accidental misuse, or cascading infrastructure failure. Rate limiting, graceful degradation, and recovery mechanisms are security controls as much as operational ones.

### 2.4 Authenticity
Every operation performed on behalf of a user or system must be traceable to a verified identity. Impersonation, session hijacking, and token forgery must be technically impossible or immediately detectable.

### 2.5 Non-repudiation
The audit log (defined in `08-logging-policy.md`) must provide a tamper-evident record of all security-relevant actions. No party should be able to perform an action and then credibly deny having done so.

### 2.6 Least Exposure
The system's attack surface — the set of interfaces, inputs, and entry points an attacker can target — must be minimized deliberately and continuously. Every exposed endpoint, every accepted input, and every granted permission that is not necessary is a liability.

---

## 3. Security Principles

These principles govern all security decisions in Void and take precedence over convenience, development speed, and individual preference.

### 3.1 Security Is Part of Design

Security constraints are established at the design phase — before implementation begins. Any feature, endpoint, or data flow that introduces a security concern must have a documented security design before code is written.

### 3.2 All Sensitive Data Is Confidential

All data classified as sensitive (Section 7) must be treated as confidential by default. This means:
- It must not appear in logs (any level)
- It must not appear in error messages returned to clients
- It must not be stored in plaintext in the database or cache
- It must not be committed to version control
- It must not be transmitted over unencrypted connections
- It must not be included in API responses unless explicitly required and scoped

### 3.3 Passwords Are Never Stored or Transmitted in Plaintext

Passwords must be hashed using an approved algorithm (Section 19) before any form of persistence. Plaintext passwords must be discarded immediately after hashing. Temporary passwords, reset tokens, and one-time codes have the same protection requirements as primary passwords.

### 3.4 All External Input Is Validated

Every value that enters the system from outside — HTTP request bodies, query parameters, headers, webhook payloads, file uploads, command arguments, environment-sourced configuration — must be validated against an explicit schema before use. "Outside" includes authenticated users, internal services, and third-party APIs.

### 3.5 All Output Is Contextualized

Output produced for clients — API responses, error messages, redirects — must be reviewed to ensure it does not leak internal state, sensitive data, or exploitable information.

### 3.6 Every Component Has the Minimum Necessary Permissions

No module, service, plugin, job, or user account is granted permissions beyond what is strictly required for its defined function. Permissions are granted per-operation, not per-actor.

### 3.7 Security Controls Must Be Tested

Security controls — authentication checks, authorization gates, rate limits, input validators — must be verified to work correctly. A control that is assumed to work but never tested is not a control.

### 3.8 Sensitive Files Must Not Be Committed to Version Control

The `.gitignore` must prevent the following from being committed: `.env` files, secret key files, certificate private keys, credential files, and any file containing a production secret value. This rule must be enforced automatically — not by individual discipline.

---

## 4. Threat Model

The Void threat model identifies the actors and attack categories the security policy is designed to defend against.

### 4.1 Threat Actors

| Actor | Capability | Motivation |
|---|---|---|
| Automated scanner | Runs known vulnerability probes against exposed endpoints | Opportunistic exploitation |
| Credential stuffer | Uses leaked username/password lists against the login endpoint | Account takeover |
| Session hijacker | Intercepts or steals valid session tokens | Impersonation |
| Insider threat | Has legitimate access but attempts to exceed permissions or exfiltrate data | Data theft, sabotage |
| Compromised dependency | A supply-chain attack via a malicious npm package | Code execution, data exfiltration |
| Malicious plugin author | Submits a plugin that extracts credentials or tokens | Credential theft |
| API abuser | Sends high volumes of valid requests to exhaust resources or extract data | Data harvesting, DoS |
| Targeted attacker | Researches the application specifically before attacking | Data breach, privilege escalation |

### 4.2 Attack Categories

| Category | Description | Primary Controls |
|---|---|---|
| Authentication bypass | Circumventing the identity verification step | Strong auth, no predictable tokens, brute force protection |
| Authorization escalation | Performing actions beyond granted permissions | Per-operation authorization checks, least privilege |
| Injection | Embedding malicious data in queries, commands, or templates | Parameterized queries, strict input validation |
| Session theft | Stealing a valid session token to impersonate a user | Secure cookies, token rotation, short lifetimes |
| Data exfiltration | Extracting sensitive data through API responses or error messages | Output scoping, error message sanitization |
| Denial of service | Exhausting server resources to prevent legitimate use | Rate limiting, circuit breaking, graceful degradation |
| Supply chain | Compromising the codebase through a dependency | Dependency auditing, lockfiles, minimal dependencies |
| Social engineering | Manipulating users or operators into revealing credentials | Out of scope for technical controls — addressed by policy |

### 4.3 Trust Boundaries

| Boundary | Trusted | Untrusted |
|---|---|---|
| HTTP input | Nothing — validate everything | All request data |
| Database | Schema-validated, parameterized queries | Raw user input in queries |
| Facebook API responses | Typed after validation | Raw response payloads |
| Plugin execution | Host system API (sandboxed) | Plugin code and its dependencies |
| Environment | Process environment (not logged, not exposed) | Configuration sources outside the process |
| Admin operations | Authenticated + authorized admin identity | Self-asserted admin claims |

---

## 5. Defense in Depth

Defense in depth means that no single security control is relied upon exclusively. Every critical security property must be protected by multiple independent layers. If one layer fails, the next layer prevents exploitation.

### 5.1 Authentication Layers

1. Credential validation (password or OAuth token)
2. Session token issuance and verification
3. Token expiry and rotation
4. Per-request session validation
5. Anomaly detection (login from new geography, unusual pattern)

### 5.2 Authorization Layers

1. Route-level authentication middleware (is the caller identified?)
2. Route-level authorization middleware (is this caller permitted?)
3. Service-level permission check (business rule level)
4. Repository-level ownership check (does this caller own this resource?)

### 5.3 Input Security Layers

1. Schema validation at the HTTP boundary (Zod or equivalent)
2. Type coercion rejection (string where integer expected → reject, not coerce)
3. Business rule validation in the domain layer
4. Parameterized queries at the database layer (prevents injection)

### 5.4 Data Protection Layers

1. Encryption in transit (TLS for all network communication)
2. Encryption at rest (for classified-sensitive fields in the database)
3. Access control on the database itself
4. Sanitization before logging
5. Output scoping in API responses

---

## 6. Least Privilege Principle

Every actor — human, service, module, plugin, or scheduled job — must operate with the minimum set of permissions required to perform its declared function. Permissions are never granted speculatively or for convenience.

### 6.1 Application to Database Access

The application's database credentials must allow only the operations the application performs:
- The main application role: SELECT, INSERT, UPDATE, DELETE on application tables
- The migration role (used only during startup/migration): CREATE, ALTER, DROP on owned tables
- Read-only reporting roles: SELECT only, on allowed tables

No single database credential grants all privileges. The superuser credential must never be used by the application at runtime.

### 6.2 Application to Facebook Permissions

Facebook OAuth scopes must be requested at the minimum level required:
- Request only the permissions the current feature set uses
- Do not request a superset of permissions "for future use"
- Re-evaluate requested scopes when features are removed
- Page-level tokens must be scoped to the specific page — not a global admin token

### 6.3 Application to Plugins

Plugins execute in a restricted context. They may access only the APIs explicitly exposed by the plugin host. They must not:
- Access the database directly
- Access the file system outside their designated plugin directory
- Read environment variables
- Make outbound network requests without explicit host approval

### 6.4 Application to Scheduled Jobs

Scheduled jobs must operate with the minimum database and service permissions needed for their specific task. A cleanup job must not have write access to tables it only reads. A reporting job must not have permissions to mutate records.

### 6.5 Application to API Endpoints

Each API endpoint must check permissions at the granularity of the specific operation — not at the granularity of "is the user authenticated." A user who can read posts cannot automatically write them. A user who can write to their own account cannot write to another account.

---

## 7. Sensitive Data Classification

Data in Void is classified into sensitivity tiers. Classification determines storage, transmission, logging, and access requirements.

### 7.1 Tier 1 — Critical (Maximum Protection)

These values must never appear in logs, error messages, version control, or any output not specifically designed to carry them.

| Data Type | Examples |
|---|---|
| Authentication credentials | Passwords (plaintext or hash), temporary passwords, OTP codes |
| Cryptographic secrets | HMAC signing keys, JWT secrets, encryption keys, TLS private keys |
| Facebook tokens | User access tokens, page access tokens, app access tokens, app secret, client secret |
| Session secrets | Session store encryption keys, cookie signing secrets |
| API keys and service credentials | Any `*_SECRET`, `*_KEY`, `*_TOKEN` environment variable value |
| Database credentials | Connection strings, usernames, passwords |

**Storage:** Must not be stored in plaintext. Must be stored in the secrets manager or environment only.  
**Transmission:** TLS only. Must not appear in URLs, query strings, or headers beyond their designated header.  
**Logging:** Absolutely forbidden.  
**Version control:** Absolutely forbidden.

### 7.2 Tier 2 — Sensitive (High Protection)

These values require protection but may appear in limited, controlled contexts (audit logs, internal admin views) with documented justification.

| Data Type | Examples |
|---|---|
| User personal information | Full name, email address, phone number, date of birth |
| Account-linked identifiers | Facebook Page IDs, Ad Account IDs |
| Session identifiers | Session IDs (not their content) |
| IP addresses | Client IP addresses |
| Behavioral data | Login times, geographic access patterns |

**Storage:** May be stored in the database with appropriate access controls. Encrypt where technically feasible.  
**Transmission:** TLS required.  
**Logging:** Security and audit logs only, with documented purpose.  
**Version control:** Absolutely forbidden.

### 7.3 Tier 3 — Internal (Standard Protection)

Data that is not public but does not require the same level of protection as tiers 1 and 2.

| Data Type | Examples |
|---|---|
| Entity identifiers | Post IDs, campaign IDs, account IDs |
| Application configuration | Feature flags, non-secret config values |
| Aggregated metrics | Request counts, error rates |
| Non-personal operational data | Job execution times, cache hit rates |

**Storage:** Standard database access controls.  
**Transmission:** TLS required.  
**Logging:** Acceptable in operational logs with appropriate context.  
**Version control:** Non-secret configuration values may be committed.

---

## 8. Authentication Security

### 8.1 Identity Verification Standards

Every request that accesses protected resources must be authenticated before any processing occurs. Authentication must happen at the earliest possible point in the request lifecycle — in middleware, before the route handler executes.

### 8.2 Password Requirements

Where passwords are used (local accounts, admin access):
- Minimum length: 12 characters
- Must contain characters from at least 3 categories: uppercase, lowercase, digits, special characters
- Must be checked against known-compromised password lists (HaveIBeenPwned or equivalent)
- Maximum length must be set (512 characters) to prevent bcrypt DoS attacks
- Passwords must be hashed immediately upon receipt and never stored, logged, or transmitted in any other form

### 8.3 Token-Based Authentication

Where token-based authentication is used (API clients, service-to-service):
- Tokens must be generated using a cryptographically secure random number generator
- Tokens must have a minimum entropy of 128 bits
- Tokens must be associated with a specific identity, scope, and expiry at creation time
- Tokens must be stored as hashes — not plaintext — in the database
- Tokens must be revocable individually without affecting other tokens for the same user

### 8.4 OAuth / Facebook Authentication

- The OAuth state parameter must be validated on every callback to prevent CSRF
- The redirect URI must be validated against an exact allowlist
- Authorization codes must be single-use and short-lived (maximum 10 minutes)
- Access tokens must not be stored in localStorage or sessionStorage — they must be in memory or secure HttpOnly cookies only

### 8.5 Authentication Failure Handling

- Authentication failures must return a generic response that does not distinguish between "user not found" and "wrong password"
- Failed attempts must be logged at the security category (not with credentials)
- Consecutive failures must trigger progressive delays and eventual lockout (Section 25)
- Authentication endpoints must be rate-limited independently of other endpoints

---

## 9. Authorization Security

### 9.1 Authorization Is Separate from Authentication

Authentication answers "who are you?" Authorization answers "are you allowed to do this?" These are distinct checks and must not be conflated. A successfully authenticated user is not automatically authorized for every operation.

### 9.2 Authorization Must Be Enforced at Every Layer

Authorization checks must not be performed only at the HTTP routing layer. Each layer of the system must enforce the permissions it is responsible for:

- **HTTP layer:** Is the caller authenticated? Does the caller have the required role or permission for this route?
- **Service layer:** Does the caller have permission to perform this operation on this specific entity?
- **Repository layer:** Does the entity belong to the caller's account? (Ownership check)

An authorization bypass at one layer must not grant access at a lower layer.

### 9.3 No Authorization by Obscurity

Endpoints and resources must not be "protected" by being undocumented, hard to find, or behind non-obvious paths. Every resource that requires authorization must have an explicit authorization check. If a resource is not behind an auth check, it must be intentionally and documentedly public.

### 9.4 Object-Level Authorization

For every operation on a specific entity (read, update, delete), the system must verify that the requesting user owns or has explicit permission to access that entity. Checking only that the user is authenticated — without verifying they own the entity — is an Insecure Direct Object Reference (IDOR) vulnerability.

### 9.5 Permission Changes Must Be Audited

Any change to a user's roles, permissions, or access levels must be:
- Authorized by an actor with explicit permission to grant that level
- Logged in the audit log with before/after state
- Communicated to the affected user where appropriate

---

## 10. Session Security

### 10.1 Session Token Generation

Session tokens must be:
- Generated using a cryptographically secure random number generator (CSPRNG)
- At minimum 128 bits of entropy (32 hex characters or equivalent)
- Unique per session — never reused or predictable from previous tokens

### 10.2 Session Token Storage (Server Side)

- Sessions must be stored server-side (in the database or Redis) — not encoded entirely in the cookie
- The cookie contains only a session ID — not the session payload
- Session store contents must be encrypted at rest if they contain sensitive user data
- Session records must include: session ID (hashed), user ID, creation time, last access time, expiry time, IP address (for anomaly detection), user agent

### 10.3 Session Token Transmission (Client Side)

- Session tokens must be transmitted only via `HttpOnly`, `Secure`, `SameSite=Strict` (or `Lax`) cookies
- Session tokens must never appear in URLs, query strings, request bodies, or log-visible headers
- Session tokens must never be stored in JavaScript-accessible storage (localStorage, sessionStorage, non-HttpOnly cookies)

### 10.4 Session Expiry

- Sessions must have an absolute maximum lifetime after which re-authentication is required (maximum 30 days)
- Sessions must have an inactivity timeout after which they expire (maximum 24 hours of inactivity for standard users)
- Admin sessions must have shorter timeouts (maximum 4 hours absolute, 1 hour inactivity)

### 10.5 Session Invalidation

Sessions must be immediately and completely invalidated when:
- The user logs out
- The user changes their password
- An admin revokes the session
- A security event triggers forced invalidation (suspicious access, account lockout)
- The session's associated Facebook token is revoked

### 10.6 Session Fixation Prevention

The session ID must be regenerated immediately after any privilege escalation — including successful login. A session established before authentication must not persist after authentication.

### 10.7 Concurrent Session Policy

Define and enforce a policy for concurrent sessions:
- Maximum N simultaneous sessions per user (default: 10)
- When the limit is exceeded, the oldest session is invalidated
- Users must be able to view and revoke their active sessions

---

## 11. Facebook Security

Facebook integration is one of Void's highest-risk surfaces. A compromise of Facebook credentials — access tokens, page tokens, or app secrets — directly impacts users' Facebook accounts, pages, and ad accounts.

### 11.1 AppState Security

AppState is the serialized authentication state used by Facebook session libraries. It contains session cookies, tokens, and internal Facebook authentication artifacts.

**AppState must never be:**
- Logged at any log level
- Included in error messages
- Stored in plaintext in the database
- Committed to version control
- Transmitted over unencrypted connections
- Exposed via any API endpoint
- Accessible to plugins
- Included in exports or backups without encryption

**AppState must be:**
- Encrypted before any persistence (database or cache)
- Decrypted in memory only for the duration of the Facebook operation
- Discarded from memory immediately after use
- Stored with an association to a specific user account — never shared between accounts
- Protected by the same access controls as the user's primary credentials

**AppState represents a complete Facebook session.** Possession of AppState is equivalent to possessing the user's Facebook login. It must be treated with the highest level of protection — equivalent to Tier 1 classification.

### 11.2 Cookie Security

Facebook session cookies embedded in AppState or managed separately carry the same risk level as access tokens.

- Facebook cookies must never be logged
- Facebook cookies must never be returned in API responses
- Facebook cookies must be encrypted at rest
- The cookie jar must be isolated per user account — never shared
- Stale or revoked cookies must be detected and purged promptly

### 11.3 Facebook Session Security

A Facebook session inside Void represents an active authenticated link to a user's Facebook identity.

- Sessions must be associated with a specific Void user account
- Sessions must not be shareable between Void users
- Session validity must be verified before every Facebook API call that depends on it
- A session that fails validation must be marked as expired and the user notified
- Session metadata (creation time, last used time, associated page IDs) must be maintained for audit purposes

### 11.4 Facebook Authentication Security

- The Facebook OAuth flow must validate the `state` parameter on every callback
- The `state` parameter must be a CSRF token — unique, unpredictable, and tied to the initiating session
- Short-lived authorization codes from Facebook must not be cached or reused
- The redirect URI must match an exact allowlist configured in the Facebook App settings and validated server-side
- Facebook app credentials (App ID, App Secret) must be stored as environment secrets — never in code

### 11.5 Login Credentials Protection

User credentials used to initiate a Facebook session (if applicable to the integration model) must:
- Never be stored by Void in any form after the session is established
- Be transmitted only over TLS
- Be discarded from memory immediately after use
- Never appear in logs, error messages, or any persistent storage

### 11.6 Facebook Reconnect

When a Facebook session expires or is revoked, the reconnection flow must:
- Detect the expired or invalid session state reliably
- Prompt the user to re-authenticate — not automatically attempt to reuse old credentials
- Generate a completely fresh session upon successful re-authentication
- Invalidate and delete all tokens and session state from the previous session before replacing them
- Log the reconnection event in the audit log (without credential values)

### 11.7 Session Recovery

Session recovery is the process of restoring a valid Facebook session from a persistent state after a server restart or cache eviction.

- Recovery must use encrypted, persisted session state — never reconstruct a session from user-provided input
- Recovered session state must be validated against Facebook's token introspection endpoint before use
- A session that cannot be validated must be treated as expired — not used speculatively
- Recovery failures must be logged at `warn` level and the user must be prompted to reconnect
- Recovery must never bypass the ownership check — session state can only be recovered by the Void user account it belongs to

---

## 12. AppState Security

AppState is addressed comprehensively in Section 11.1. This section adds cross-cutting requirements:

### 12.1 AppState Lifecycle

```
Receive from Facebook SDK → Validate structure → Encrypt immediately → Store encrypted
Retrieve for use → Decrypt in memory → Use for one Facebook operation → Discard from memory
```

There must be no phase in this lifecycle where unencrypted AppState resides in:
- A log file
- A cache entry (unless the cache itself is encrypted)
- A temporary file
- An API response
- A variable with a scope broader than the single operation

### 12.2 AppState Isolation

AppState belongs to exactly one Void user account and one Facebook identity. It must never:
- Be copied to another user's account
- Be used to perform operations on behalf of a different account than it was created for
- Be shared between concurrent requests without explicit locking to prevent race conditions

### 12.3 AppState Rotation

AppState must be refreshed and re-stored after every successful Facebook authentication event. Stale AppState that has not been refreshed within a defined window must be treated as expired.

---

## 13. Cookie Security

All cookies set by Void must adhere to the following security attributes.

### 13.1 Required Cookie Attributes

| Attribute | Required Value | Reason |
|---|---|---|
| `HttpOnly` | Always set | Prevents JavaScript access — eliminates XSS cookie theft |
| `Secure` | Always set | Prevents transmission over unencrypted HTTP |
| `SameSite` | `Strict` or `Lax` | Prevents CSRF attacks via cross-origin cookie submission |
| `Path` | Minimum necessary path | Limits exposure to required paths only |
| `Domain` | Minimum necessary domain | Prevents cookie sharing with subdomains unless required |
| `Expires` / `Max-Age` | Always set | Prevents indefinite persistence |

### 13.2 Cookie Content

- Session cookies contain only a session identifier — never session payload
- No sensitive data of any kind may be stored in a cookie value
- Cookie values must be signed (HMAC) to detect tampering
- Cookie values must be validated on every request — tampering must be detected and the session invalidated

### 13.3 Cookie Logging Prohibition

Cookie names and values must never appear in any log entry. The existence of a cookie header may be logged (e.g., "request included session cookie: true"), but its name or value must never be recorded.

---

## 14. Access Token Security

Access tokens — including Facebook user tokens, page tokens, and internal API tokens — are Tier 1 sensitive data.

### 14.1 Storage

- Access tokens must not be stored in plaintext in the database
- Access tokens must be encrypted using an approved algorithm (Section 18) before persistence
- The encryption key must not be stored alongside the encrypted token
- Tokens must be stored with their associated metadata: user ID, account ID, scope, creation time, expiry time

### 14.2 Transmission

- Access tokens must never appear in URLs or query strings (they appear in server logs as-is)
- Access tokens must be transmitted only in HTTP headers (`Authorization: Bearer`) or as HttpOnly cookies
- Access token values must never be returned to the client in API response bodies — references (token ID, expiry) are acceptable

### 14.3 In-Memory Handling

- Access tokens must be held in memory only for the duration of the operation that requires them
- Access tokens must not be assigned to variables with broader scope than the function that uses them
- Access tokens must not be passed as arguments through more layers than necessary

### 14.4 Logging Prohibition

Access token values must never appear in any log entry at any level. If a logging call includes an object that contains a token field, that field must be explicitly excluded or replaced with `[REDACTED]` before the log call.

### 14.5 Revocation

The system must maintain a mechanism to revoke individual access tokens. Revocation must:
- Take effect immediately — not at the next expiry cycle
- Invalidate all operations attempted with the revoked token from the moment of revocation
- Be logged in the audit log with the revoking actor's identity and reason

---

## 15. Refresh Strategy

### 15.1 Token Refresh Principles

Token refresh is the process of replacing an expiring token with a new one without requiring the user to re-authenticate. The refresh mechanism must be at least as secure as the original authentication.

### 15.2 Refresh Token Security

If refresh tokens are used:
- Refresh tokens must have a longer lifetime than access tokens — but a defined maximum lifetime
- Refresh tokens must be stored with the same protection as access tokens (encrypted at rest)
- Refresh tokens must be single-use — each use must issue a new refresh token and invalidate the used one (rotation)
- If a refresh token is used more than once, this indicates token theft — all tokens for the affected user must be revoked immediately
- Refresh tokens must be bound to a specific client and must not be transferable

### 15.3 Facebook Token Refresh

- Facebook long-lived tokens must be refreshed before expiry — not after
- The refresh must be performed server-side — never client-side
- A failed refresh must result in the user being prompted to re-authenticate
- Refresh events must be logged in the audit log (without token values)

### 15.4 Proactive vs. Reactive Refresh

Void must implement proactive token refresh — refreshing tokens before they expire, on a schedule. Reactive refresh (detecting expiry only when an API call fails) introduces operational failures and should be used only as a fallback when proactive refresh fails.

---

## 16. Environment Variables Policy

### 16.1 All Secrets Must Be in Environment Variables

Every secret value — database credentials, API keys, signing secrets, Facebook app credentials, encryption keys — must be provided to the application exclusively through environment variables or a secrets manager. No secret value may be hardcoded in source code, configuration files committed to version control, or any other non-environment source.

### 16.2 Environment Variable Naming

- Secret environment variables must use descriptive, specific names: `FACEBOOK_APP_SECRET`, `SESSION_SIGNING_SECRET`, `DB_PASSWORD`
- Names must not use abbreviations that obscure the nature of the value
- Names must be documented (by name, not value) in the project's environment configuration documentation

### 16.3 Environment Variables Must Not Be Logged

The values of environment variables must never be logged. Even non-secret configuration values must not be logged as a blanket policy — individual non-secret values may be logged explicitly and deliberately when useful for startup diagnostics.

**Prohibited:**
```
// FORBIDDEN
logger.info('Config', { env: process.env });
logger.info('DB config', { host: process.env.DB_HOST, password: process.env.DB_PASSWORD });
```

### 16.4 Environment Variable Validation at Startup

All required environment variables must be validated at process startup before any other initialization occurs. If a required variable is missing or invalid, the process must log a clear error message (naming the missing variable but not any values) and exit immediately. The application must never start in a degraded state where a missing secret is silently substituted with a default.

### 16.5 Local Development Environments

Local development uses `.env` files for convenience. These files:
- Must be listed in `.gitignore` — they must never be committed
- Must contain only non-production values — never real tokens or production credentials
- Must use a `.env.example` file (with no real values) committed to the repository to document required variables

---

## 17. Secret Management

### 17.1 Secret Lifecycle

Every secret in Void has a lifecycle:

1. **Generation:** Secrets must be generated using a CSPRNG with appropriate entropy for their purpose
2. **Distribution:** Secrets are provided to the application via environment variables or a secrets manager — never via source code
3. **Use:** Secrets are accessed in memory for the duration of the operation that requires them
4. **Rotation:** Secrets must be rotatable without system downtime
5. **Revocation:** Compromised secrets must be revocable immediately with system-wide effect
6. **Deletion:** Expired or revoked secrets must be purged from all systems

### 17.2 Secret Rotation Policy

| Secret Type | Maximum Rotation Interval | Trigger for Immediate Rotation |
|---|---|---|
| Database credentials | 90 days | Suspected compromise |
| Session signing secrets | 180 days | Suspected compromise, key exposure in logs |
| Facebook App Secret | As required by Facebook | Suspected compromise, developer offboarding |
| Encryption keys | 1 year | Suspected compromise |
| API tokens (internal) | 90 days | Developer offboarding, suspected compromise |

### 17.3 Secret Compromise Response

If a secret is suspected to be compromised:
1. Rotate the secret immediately — do not wait to confirm the compromise
2. Invalidate all tokens and sessions that were signed or encrypted with the compromised secret
3. Audit logs for any access that may have used the compromised secret
4. Document the incident (Section 33)

### 17.4 Developer Access to Secrets

- Developers must not have access to production secrets unless they have an explicit operational need
- Access to production secrets must be logged
- Secrets must not be shared via messaging applications, email, or any unencrypted channel

---

## 18. Encryption Policy

### 18.1 Encryption in Transit

All network communication must use TLS 1.2 or higher. TLS 1.0 and 1.1 are deprecated and must not be accepted. All HTTP traffic must be redirected to HTTPS. HSTS (HTTP Strict Transport Security) must be configured with a minimum max-age of 1 year.

### 18.2 Encryption at Rest

The following data must be encrypted at rest:

| Data | Encryption Requirement |
|---|---|
| Facebook access tokens | Encrypted before database storage |
| Facebook AppState | Encrypted before any persistence |
| Session store contents (if sensitive) | Encrypted |
| Any Tier 1 data persisted to database | Encrypted |

### 18.3 Approved Algorithms

| Purpose | Approved Algorithm | Notes |
|---|---|---|
| Symmetric encryption | AES-256-GCM | Authenticated encryption — preferred |
| Key derivation | HKDF-SHA256 or PBKDF2-SHA256 | PBKDF2 for user-facing, HKDF for internal |
| Password hashing | bcrypt (cost ≥ 12) or Argon2id | Never MD5, SHA1, SHA256 for passwords |
| HMAC / signing | HMAC-SHA256 | For cookie signing, token verification |
| Token generation | crypto.randomBytes(32) | Minimum 256 bits of entropy |

### 18.4 Prohibited Algorithms

The following must never be used for security purposes:
- MD5 (any purpose)
- SHA1 (any security purpose — acceptable only for non-security checksums with documented justification)
- DES, 3DES
- RC4
- ECB mode for any block cipher
- Any algorithm with known practical attacks

### 18.5 Key Management

- Encryption keys must not be stored alongside the data they encrypt
- Keys must be managed through environment variables or a secrets manager
- Key material must not appear in logs, error messages, or API responses
- Key rotation must be possible without re-encrypting all data at once (envelope encryption pattern)

---

## 19. Hashing Policy

### 19.1 Password Hashing

- Passwords must be hashed using bcrypt with a cost factor of at least 12, or Argon2id with appropriate parameters
- The cost factor must be adjusted upward as hardware improves — re-evaluate annually
- Password hashes must include a per-password salt (both bcrypt and Argon2id handle this automatically)
- The plaintext password must be discarded immediately after hashing — it must not be stored, logged, or passed to additional functions

### 19.2 Token Hashing

Internal API tokens and refresh tokens stored in the database must be hashed (SHA-256 is acceptable for tokens with sufficient entropy — not for passwords). The plaintext token is issued once and never stored.

### 19.3 Content Integrity

File and content integrity verification must use SHA-256 or SHA-3. Checksums for security purposes must not use MD5 or SHA-1.

---

## 20. Input Validation

### 20.1 Validation Is Mandatory for All External Input

Every value entering the system from an external source — regardless of the source's trust level — must be validated before use. Validation must check:
- **Type:** Is this the expected data type?
- **Format:** Does this match the expected pattern or schema?
- **Length:** Is this within the expected size bounds?
- **Range:** Is this within the expected value range?
- **Allowlist:** Does this match an allowlist of permitted values (where applicable)?

### 20.2 Validation Must Fail Closed

If a value fails validation, the operation must be rejected. Partial validation — where some fields are validated and others are not — is forbidden. The entire input must be valid before any part of it is used.

### 20.3 Validation Must Happen at the Boundary

Input validation must happen as close to the system boundary as possible — at the HTTP layer, before any business logic executes. This prevents invalid data from traveling into deeper layers where it may cause unexpected behavior.

### 20.4 Validation Schema as Source of Truth

Validation schemas (Zod schemas or equivalent) are the authoritative specification of what the system accepts. They must be:
- Explicit — every accepted field is declared; unknown fields are rejected by default
- Strict — no implicit type coercion that might mask invalid input
- Version-controlled — changes to accepted input shapes are tracked

### 20.5 File Upload Validation

If file uploads are supported:
- File type must be validated by content (magic bytes) — not by file extension alone
- Maximum file size must be enforced before the file is read into memory
- Files must be stored outside the web root — not in a location directly accessible via URL
- File names provided by the user must never be used as-is — generate a safe, unique name server-side

### 20.6 No Validation Bypass

There must be no internal API, admin shortcut, or "trusted" path that bypasses input validation. Validation is applied uniformly — no exceptions.

---

## 21. Output Sanitization

### 21.1 Context-Appropriate Encoding

Data that is output by the system must be encoded appropriately for its destination context:
- **HTML context:** HTML entity encoding (prevent XSS)
- **JSON context:** JSON serialization handles encoding — but ensure no JavaScript execution contexts receive unsanitized user data
- **SQL context:** Parameterized queries (prevent injection — see Section 22)
- **URL context:** URL encoding for user-provided values in URLs

### 21.2 API Response Scoping

API responses must return only the fields required for the client's current operation. The principle of minimum disclosure applies:
- Do not return internal IDs that are not needed by the client
- Do not return fields from related entities unless explicitly requested
- Do not return status fields or flags that expose internal implementation details

### 21.3 Error Response Sanitization

Error responses returned to clients must not include:
- Stack traces
- Database error messages or query details
- File system paths
- Internal service names or hostnames
- Any data that reveals the internal structure of the system

See Section 30 for the complete error message security policy.

---

## 22. Injection Prevention

### 22.1 SQL Injection

All database queries must use parameterized queries or a query builder that produces parameterized queries. String interpolation of user input into SQL is forbidden — with no exceptions.

```
// FORBIDDEN — direct string interpolation
`SELECT * FROM posts WHERE id = '${userId}'`

// REQUIRED — parameterized
db.select().from(posts).where(eq(posts.id, userId))
```

The ORM (Drizzle) generates parameterized queries by default. Raw SQL queries constructed manually must go through code review with explicit security sign-off.

### 22.2 Command Injection

If the system executes shell commands (which should be avoided wherever possible):
- User-provided input must never be included in a shell command string
- Shell execution must use argument array form — not string concatenation
- Commands must be executed with the minimum necessary system privileges

### 22.3 Template Injection

If server-side templates are used:
- User-provided data must be rendered in a context that does not allow template expression evaluation
- Template engines must be configured to auto-escape by default

### 22.4 Header Injection

HTTP response headers that include user-provided values must have those values validated to exclude newline characters (`\r`, `\n`). A newline in a header value enables HTTP response splitting.

### 22.5 Path Traversal

File system paths that include user-provided input must be validated against a strict allowlist of permitted paths. The resolved path must be confirmed to be within the expected directory before any file operation.

---

## 23. Rate Limiting Strategy

### 23.1 Rate Limiting Is a Security Control

Rate limiting protects the system from brute force attacks, credential stuffing, API abuse, denial of service, and excessive data harvesting. It must be applied to all public-facing endpoints.

### 23.2 Rate Limiting Tiers

| Endpoint Category | Limit | Window | Scope |
|---|---|---|---|
| Authentication (login, register) | 5 requests | 15 minutes | Per IP |
| Password reset | 3 requests | 1 hour | Per IP + per account |
| Facebook API proxy endpoints | 10 requests | 1 minute | Per authenticated user |
| General API (authenticated) | 100 requests | 1 minute | Per authenticated user |
| General API (unauthenticated) | 20 requests | 1 minute | Per IP |
| Webhook receivers | 50 requests | 1 minute | Per source IP |

### 23.3 Rate Limit Response

When a rate limit is exceeded:
- Return HTTP `429 Too Many Requests`
- Include a `Retry-After` header indicating when the limit resets
- Return a user-friendly message: "You're doing that too often. Please wait before trying again."
- Log the event at `warn` level with the security category
- Do not include the specific limit values in the response (prevents calibration by attackers)

### 23.4 Rate Limit Storage

Rate limit counters must be stored in Redis (or equivalent distributed cache) — not in memory — to ensure consistent enforcement across multiple application instances.

### 23.5 IP-Based Rate Limiting Considerations

IP-based rate limiting must account for:
- Shared IPs (NAT, corporate proxies) — limits may affect legitimate users; monitor false positive rates
- IPv6 addressing — limit at the /64 prefix, not the full address, to prevent bypass by rotating addresses
- Trusted proxy headers (`X-Forwarded-For`) — validate that the header source is a trusted proxy before using it

---

## 24. Replay Attack Prevention

### 24.1 What Is a Replay Attack

A replay attack occurs when an attacker captures a valid request and re-submits it to produce unauthorized effects. This is a particular risk for sensitive operations: password resets, payment operations, email verification, and token exchanges.

### 24.2 Prevention Mechanisms

- **One-time tokens:** Single-use tokens for sensitive operations (password reset, email verification) must be invalidated immediately upon first use
- **Request timestamps:** Signed requests must include a timestamp; requests older than a defined window (e.g., 5 minutes) must be rejected
- **Nonces:** For operations requiring strict uniqueness, include a server-generated nonce that is validated and invalidated on use
- **Idempotency keys:** For operations where the client may legitimately retry, use client-provided idempotency keys to detect and safely handle duplicates

### 24.3 OAuth State Parameter

The OAuth state parameter (used in Facebook authentication) serves as a CSRF/replay protection mechanism. It must be:
- Generated as a CSPRNG value for each authorization initiation
- Stored server-side and validated on callback
- Invalidated after a single successful use
- Expired if not used within a defined window (maximum 10 minutes)

---

## 25. Brute Force Protection

### 25.1 Progressive Delay

Authentication endpoints must implement progressive delays after consecutive failures:
- 1–3 failures: No delay (normal rate limiting applies)
- 4–5 failures: 5-second delay before response
- 6–9 failures: 15-second delay before response
- 10+ failures: Account lockout or CAPTCHA requirement

### 25.2 Account Lockout

After a threshold of consecutive failed authentication attempts:
- The account must be temporarily locked (not permanently — to prevent denial of service)
- Lockout duration: 15 minutes after 10 failures, extending with additional failures
- Lockout events must be logged at the security category
- The legitimate account owner must be notified of the lockout (via email or in-app notification)
- Lockout bypass must require a verified email action — not just a support ticket

### 25.3 IP-Based Blocking

IP addresses that produce sustained high-failure-rate authentication attempts must be temporarily blocked at the rate limiter layer. This is a coarse control — it must not be the only protection.

### 25.4 CAPTCHA Integration

For endpoints targeted by automated attacks, a CAPTCHA mechanism (or equivalent proof-of-work) may be required after a threshold of failures from a given IP. CAPTCHA must be a supplemental control — it must not replace rate limiting or lockout.

---

## 26. Dependency Security

### 26.1 Minimize Dependencies

Every dependency added to the project expands the attack surface. Before adding a new dependency:
- Evaluate whether the functionality can be implemented without a dependency
- Evaluate the dependency's maintenance status, download volume, and security history
- Evaluate the dependency's own dependencies (transitive)
- Prefer well-maintained, widely-used packages from reputable sources

### 26.2 Lockfiles Are Mandatory

`pnpm-lock.yaml` must be committed to version control and must be the authoritative source for installed dependency versions. The lockfile ensures reproducible installs and prevents version drift. Installing without respecting the lockfile in production is forbidden.

### 26.3 Dependency Auditing

- Run `pnpm audit` on every CI pipeline execution
- Critical and high severity vulnerabilities must block the build
- Moderate severity vulnerabilities must be reviewed and remediated within 30 days
- Low severity vulnerabilities must be reviewed and remediated within 90 days

### 26.4 Dependency Updates

- Dependencies must not be updated blindly — changelogs must be reviewed for breaking changes and security fixes
- Major version upgrades must go through code review
- Security patches must be applied promptly — within 24 hours for critical CVEs

### 26.5 No Unpublished or Local Path Dependencies in Production

Production builds must not use unpublished packages (`file:` or `link:` dependencies) unless they are internal workspace packages. External dependencies must be published to a registry and pinned in the lockfile.

---

## 27. File System Security

### 27.1 Minimum File System Access

Application code must access only the file system paths it explicitly requires. Broad file system access through user-controlled paths is forbidden.

### 27.2 User-Provided File Paths

File paths derived from user input must:
- Be validated against an allowlist of permitted directories
- Be resolved to an absolute path and confirmed to be within the allowed directory
- Never be passed to shell commands

### 27.3 Sensitive Files Must Not Be Web-Accessible

The following must never be in a directory served by the web server:
- `.env` files
- Private key files
- Database credential files
- Application configuration files with secret values
- Log files

### 27.4 Temporary Files

Temporary files that contain sensitive data must:
- Be written to a directory that is not accessible via HTTP
- Be deleted immediately after use
- Have restrictive file permissions (readable only by the application user)

### 27.5 File Permissions

Application files must have restrictive permissions:
- Configuration and source files: readable and executable only by the application user
- Secret files (if any exist on disk): readable only by the application user
- No world-writable directories in the application tree

---

## 28. Network Security

### 28.1 TLS Everywhere

All communication between any two components of the Void system — client to server, server to database, server to cache, server to external APIs — must use TLS. Unencrypted communication channels are forbidden in production.

### 28.2 Certificate Validation

TLS certificate validation must not be disabled. Self-signed certificates in production are not permitted. Certificate pinning may be applied for high-value connections (Facebook API) to prevent MITM via compromised CAs.

### 28.3 HTTPS Enforcement

- All HTTP traffic must be redirected to HTTPS with a 301 permanent redirect
- HSTS must be configured with: `max-age=31536000; includeSubDomains; preload`
- The `preload` directive should be submitted to the HSTS preload list

### 28.4 Security Headers

Every HTTP response must include:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | Strict policy appropriate to the application (no `unsafe-inline` or `unsafe-eval`) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Restrict unused browser features |

### 28.5 CORS Policy

CORS must be configured with an explicit allowlist of permitted origins. Wildcard origins (`*`) are forbidden for authenticated endpoints. The allowed origin list must be reviewed when deployment domains change.

### 28.6 Outbound Request Security

Outbound HTTP requests (to Facebook API, webhooks, third-party services) must:
- Always use HTTPS
- Validate TLS certificates (never disable certificate verification)
- Not follow redirects to HTTP (from HTTPS)
- Include a request timeout — infinite-wait outbound requests are a denial-of-service vector
- Be rate-limited to prevent excessive outbound traffic

---

## 29. Logging Security

Logging security is fully addressed in `08-logging-policy.md`. This section summarizes the intersection of logging and security:

- All security events (authentication, authorization, rate limiting, anomalies) must be logged at the `security` category
- Sensitive data (Tier 1 and Tier 2) must never appear in any log entry
- Security logs must be stored in a tamper-resistant, access-controlled log stream
- Log access must itself be logged (who viewed which logs, when)
- Security logs must be retained for a minimum of 180 days

---

## 30. Error Message Security

### 30.1 Error Messages Must Not Leak Internal State

Error messages returned to clients must not reveal:
- Stack traces
- Database schema details (table names, column names)
- Internal service hostnames or IPs
- Application framework names and versions
- File system paths
- Source code line numbers
- The specific reason for an authentication failure (prevents enumeration)
- Whether an account exists for a given identifier

### 30.2 Generic Messages for Security-Sensitive Failures

Authentication failures, authorization denials, and not-found responses for non-public resources must use generic messages:
- Authentication failure: "Invalid credentials." (not "User not found" or "Wrong password")
- Authorization denial: "You don't have permission to do this." (not "Your role is 'viewer', which cannot edit")
- Not-found (sensitive resource): Return 404 rather than 403, to prevent confirming the resource exists

### 30.3 Internal vs. External Error Detail

All error detail — stack traces, database errors, internal codes — must be:
- Logged internally with full detail
- Returned to the client only as a `requestId` that can be used to locate the internal log entry

---

## 31. Backup Security

### 31.1 Backup Encryption

All database backups must be encrypted before storage. Backup encryption keys must be stored separately from the backup data.

### 31.2 Backup Access Control

Backup storage must be accessible only to authorized personnel and systems. Access to backups must be logged.

### 31.3 Backup Verification

Backups must be tested for restorability on a defined schedule. A backup that cannot be restored is not a backup.

### 31.4 Backup Contents

Backups contain all application data including Tier 1 sensitive data. Backup access controls must be at least as strict as production database access controls.

---

## 32. Recovery Strategy

### 32.1 Security-Specific Recovery

A system recovered from backup must immediately:
- Rotate all secrets (database credentials, signing keys, API keys) — backup data may have been accessed
- Invalidate all active sessions (they may have been compromised)
- Review audit logs for the period before the recovery for signs of compromise
- Verify the integrity of recovered data

### 32.2 Recovery Must Be Tested

Recovery procedures must be tested on a scheduled basis — not discovered for the first time during an actual incident.

---

## 33. Incident Response

### 33.1 What Constitutes a Security Incident

- Confirmed or suspected unauthorized access to user data
- Credential compromise (any Tier 1 secret)
- Persistent unauthorized access (backdoor, compromised account)
- Data exfiltration (confirmed or suspected)
- Ransomware or destructive attack
- Supply chain compromise (malicious dependency)

### 33.2 Immediate Response Steps

1. **Contain:** Isolate affected systems to prevent further damage. Revoke compromised credentials immediately.
2. **Assess:** Determine the scope — what was accessed, what was affected, what time period.
3. **Preserve:** Preserve logs and state before taking recovery actions that might overwrite evidence.
4. **Communicate:** Notify relevant stakeholders according to the communication plan.
5. **Remediate:** Address the root cause. Restore from clean backups if necessary.
6. **Recover:** Restore service in a secure state.
7. **Review:** Conduct a post-incident review to understand how the incident occurred and how to prevent recurrence.

### 33.3 Regulatory Obligations

Depending on jurisdiction and the nature of the data affected, security incidents may require notification to regulators and/or affected users within defined timeframes. Legal counsel must be involved in these decisions.

---

## 34. Security Monitoring

### 34.1 What to Monitor

- Authentication failure rate (by IP, by account)
- Authorization denial rate
- Rate limit trigger frequency
- Unusual geographic access patterns
- Abnormal request volumes from a single source
- Requests to non-existent endpoints (scanner activity)
- Error rate spikes (may indicate active exploitation)
- Facebook token validation failures

### 34.2 Alerting Thresholds

| Event | Alert Threshold | Severity |
|---|---|---|
| Auth failures from single IP | >10 in 5 minutes | High |
| Auth failures on single account | >5 in 15 minutes | High |
| Any Tier 1 secret in a log entry | 1 occurrence | Critical |
| Rate limit activations | >100 in 1 minute | Medium |
| Authorization denials | >20 in 1 minute per user | High |
| Requests to non-existent endpoints | >50 in 1 minute | Medium |

### 34.3 Security Review Cadence

- Automated dependency audit: every CI pipeline run
- Security log review: weekly, automated anomaly detection
- Access control review (who has what permissions): quarterly
- Full security policy review: annually or after a significant incident

---

## 35. Common Vulnerabilities

These are the vulnerabilities most likely to affect a system of Void's type. Developers must understand them.

### 35.1 OWASP Top 10 Mapping

| Vulnerability | Relevant Void Controls |
|---|---|
| A01: Broken Access Control | Section 9 — per-operation authorization, object-level checks |
| A02: Cryptographic Failures | Section 18, 19 — approved algorithms, encryption at rest |
| A03: Injection | Section 22 — parameterized queries, input validation |
| A04: Insecure Design | Section 1, 3 — security in design, threat model |
| A05: Security Misconfiguration | Section 16, 28 — env vars, security headers |
| A06: Vulnerable Components | Section 26 — dependency auditing |
| A07: Authentication Failures | Section 8, 25 — strong auth, brute force protection |
| A08: Software and Data Integrity | Section 26 — lockfiles, dependency verification |
| A09: Logging Failures | Section 29, 08-logging-policy.md |
| A10: SSRF | Section 28.6 — outbound request controls |

---

## 36. Forbidden Security Practices

The following practices are strictly prohibited. Any instance discovered in code review, audit, or security testing must be treated as a critical finding and remediated before deployment.

### 36.1 Hardcoding Secrets in Source Code

```
// FORBIDDEN
const DB_PASSWORD = 'supersecret123';
const FB_APP_SECRET = 'abc123def456';
const SESSION_SECRET = 'my-secret-key';
```

Secrets hardcoded in source code are committed to version control, visible to every developer, and cannot be rotated without a code change and deployment. All secrets must be in environment variables or a secrets manager.

### 36.2 Sharing or Exposing AppState

AppState must never be:
- Returned in an API response
- Passed between user accounts
- Stored in a shared location accessible to multiple accounts
- Logged in any form

### 36.3 Sharing or Exposing Cookies

Cookie values must never be:
- Logged
- Returned in API response bodies
- Stored in the database in plaintext
- Accessible to client-side JavaScript (session cookies must always be HttpOnly)

### 36.4 Disabling Input Validation

```
// FORBIDDEN
const schema = z.object({ ... }).passthrough(); // accepts unknown fields
const data = req.body; // no validation before use
```

Input validation must never be disabled, bypassed, or skipped for any reason including "this endpoint is internal" or "this is only used in development."

### 36.5 Exposing Stack Traces to End Users

```
// FORBIDDEN
res.status(500).json({ error: error.stack });
res.status(500).json({ message: error.message, trace: error.stack });
```

Stack traces reveal the internal structure of the system and assist attackers. They must be logged internally and never returned to clients.

### 36.6 Using Static or Predictable Credentials

```
// FORBIDDEN
// Default admin credentials: admin / admin
// Test API key: test-key-12345
// Development secret: dev-secret (used in production)
```

Every credential must be unique, randomly generated, and specific to its environment.

### 36.7 Trusting External Input Without Validation

```
// FORBIDDEN
const userId = req.body.userId; // trusting client-provided user ID
const role = req.headers['x-user-role']; // trusting client-asserted role
```

The system must never trust a client's self-assertion of identity, role, or permission. These must be derived from the verified session — not from request data.

### 36.8 Storing Sensitive Data Without Protection

```
// FORBIDDEN
await db.insert(tokens).values({ userId, accessToken: plainToken }); // plaintext
await redis.set(`fb:state:${userId}`, JSON.stringify(appState)); // unencrypted
```

Any Tier 1 data written to a persistence layer must be encrypted before storage.

### 36.9 Committing Sensitive Files to Git

The following must never be committed:
- `.env` files of any kind
- `*.pem`, `*.key`, `*.p12` private key files
- Files containing API keys, tokens, or secrets
- Database dump files

Pre-commit hooks must enforce this automatically.

### 36.10 Disabling TLS Verification

```
// FORBIDDEN
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
{ rejectUnauthorized: false }
```

Disabling certificate validation eliminates the protection TLS provides against MITM attacks. It is forbidden in all environments.

---

## 37. AI Security Rules

This section defines how an AI system operating within Void must reason about security decisions.

### 37.1 Security Must Not Be Weakened Without Explicit Authorization

An AI system must not make changes that reduce the security posture of the application without explicit instruction and documented justification. This includes:
- Weakening input validation
- Removing authorization checks
- Reducing token lifetimes below policy minimums
- Adding code that logs sensitive values
- Adding code that stores Tier 1 data without encryption

If an AI system is asked to make such a change, it must refuse and explain why the change violates this policy. It must propose a compliant alternative.

### 37.2 The AI Must Not Generate Hardcoded Secrets

The AI must never generate code containing hardcoded secrets — API keys, passwords, signing secrets, or any value that should be in an environment variable. If a secret value is needed in generated code, the AI must use environment variable references and document the required variable name.

### 37.3 The AI Must Not Generate Code That Logs Sensitive Data

Before generating any logging code, the AI must evaluate whether any value being passed to the logger falls within Tier 1 or Tier 2 classification. If it does, the AI must redact it or exclude it from the log call.

### 37.4 The AI Must Preserve Authorization Checks

When refactoring or modifying existing code, the AI must verify that all authorization checks present in the original code are preserved in the modified code. The AI must not inadvertently remove an authorization check in the course of a refactor.

### 37.5 The AI Must Use Parameterized Queries

Any database query generated by the AI must use the ORM's query builder (Drizzle) or parameterized query form. String interpolation of variable values into SQL is absolutely forbidden in AI-generated code.

### 37.6 The AI Must Apply Input Validation

When generating code that accepts external input (route handlers, command handlers, plugin interfaces), the AI must include input validation using the project's validation library (Zod) before any processing occurs.

### 37.7 The AI Must Not Bypass Security Controls

The AI must not generate shortcuts that bypass rate limiting, authentication, or authorization — even when the stated purpose is "for testing" or "for internal use." All code that runs in the production environment must be subject to the same security controls.

### 37.8 The AI Must Flag Security-Relevant Decisions

When generating code that touches authentication, authorization, session handling, token management, encryption, or external service integration, the AI must explicitly note the security implications of its design decisions and how they align with this policy.

### 37.9 The AI Must Not Access or Transmit Sensitive Data

During code generation, review, or analysis, the AI must not:
- Request or display actual secret values
- Generate code that transmits credentials to external systems beyond those already declared in the architecture
- Generate code that caches or persists tokens beyond their defined lifecycle

### 37.10 When in Doubt, the AI Must Refuse and Escalate

If the AI is uncertain whether a requested change is consistent with this security policy, it must not proceed with the least-secure interpretation. It must explicitly state the uncertainty, describe the security concern, and request clarification from a human engineer before proceeding.

---

## 38. Security Review Checklist

Use this checklist for every code review that introduces new features, modifies authentication or authorization logic, or handles sensitive data.

### Authentication and Session
- [ ] New endpoints require authentication where appropriate
- [ ] Session tokens are generated with CSPRNG and sufficient entropy
- [ ] Session cookies have HttpOnly, Secure, and SameSite attributes
- [ ] Session IDs are regenerated after privilege escalation (login)
- [ ] Session invalidation is triggered on logout and credential change

### Authorization
- [ ] Per-operation authorization checks are present at every layer
- [ ] Object-level ownership is verified for entity operations
- [ ] No route assumes "authenticated = authorized for all operations"
- [ ] Permission changes are logged in the audit log

### Facebook Integration
- [ ] AppState is never logged
- [ ] AppState is encrypted before persistence
- [ ] Facebook tokens are never stored in plaintext
- [ ] OAuth state parameter is validated on every callback
- [ ] Cookie values are never logged or returned in API responses

### Input and Output
- [ ] All external input is validated with an explicit schema
- [ ] Unknown fields are rejected, not silently ignored
- [ ] API responses include only required fields
- [ ] Error responses contain no internal details

### Secrets and Environment
- [ ] No secrets are hardcoded in source code
- [ ] New environment variables are documented (by name, not value)
- [ ] `.env` files are in `.gitignore`
- [ ] New sensitive files are added to `.gitignore`

### Cryptography
- [ ] Only approved algorithms are used (Section 18.3)
- [ ] Passwords are hashed with bcrypt (cost ≥ 12) or Argon2id
- [ ] No MD5 or SHA1 for security purposes
- [ ] Encryption keys are not stored alongside encrypted data

### Injection Prevention
- [ ] All database queries use ORM query builder or parameterized form
- [ ] No string interpolation of user input into SQL
- [ ] File paths from user input are resolved and bounds-checked

### Rate Limiting and Abuse Prevention
- [ ] New sensitive endpoints have rate limiting configured
- [ ] Authentication endpoints have brute force protection
- [ ] Single-use tokens are invalidated after first use

### Logging and Error Handling
- [ ] No sensitive data appears in any log call in the changed code
- [ ] Error responses to clients contain no internal details
- [ ] Security events are logged at the `security` category

### Dependencies
- [ ] No new dependencies are added without review
- [ ] `pnpm audit` passes with no critical or high vulnerabilities

---

*This document is the official and binding security reference for the Void project. All layers, subsystems, contributors, and AI systems operating on this codebase are bound by the policies defined here. Security controls must not be weakened under schedule pressure, for convenience, or for any reason without explicit documented authorization. Any conflict between this document and other documents is resolved in favor of this document for security concerns. Changes to this policy require explicit security review and approval.*
