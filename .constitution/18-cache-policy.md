# 18 — Cache Policy

> **Status:** Official  
> **Scope:** All caching decisions in Void — philosophy, lifecycle, TTL strategy, invalidation, memory management, consistency guarantees, local and distributed cache patterns, performance, and the substitutability requirement that ensures the cache layer never becomes a structural dependency  
> **Authority:** This document is the single source of truth for all caching design in Void. A cache is an optimization — the system must function correctly, completely, and consistently without any cache in place. Any cache that violates this principle is an architectural defect.

---

## Table of Contents

1. [Cache Philosophy](#1-cache-philosophy)
2. [Cache as an Optional Layer](#2-cache-as-an-optional-layer)
3. [Cache Lifecycle](#3-cache-lifecycle)
4. [TTL Strategy](#4-ttl-strategy)
5. [Invalidation Strategy](#5-invalidation-strategy)
6. [Memory Management](#6-memory-management)
7. [Cache Consistency](#7-cache-consistency)
8. [Local Cache](#8-local-cache)
9. [Distributed Cache](#9-distributed-cache)
10. [Performance](#10-performance)
11. [Observability](#11-observability)
12. [Best Practices](#12-best-practices)
13. [Anti-Patterns](#13-anti-patterns)
14. [Forbidden Cache Practices](#14-forbidden-cache-practices)
15. [AI Cache Rules](#15-ai-cache-rules)
16. [Review Checklist](#16-review-checklist)

---

## 1. Cache Philosophy

### 1.1 A Cache Is an Optimization, Never a Foundation

A cache exists for one purpose: to make the system faster. It does not exist to make the system correct, to store canonical state, or to enable capabilities that would not otherwise be possible. The system's correctness is defined by its persistent storage and its business logic — both of which operate independently of any cache.

This principle has a direct implication: if every cache in Void were emptied simultaneously, the system would continue to operate. It would be slower. It might be significantly slower. But it would be correct, and every operation would eventually complete by reading from the canonical source. A system in which emptying the cache causes failures, data loss, or incorrect behavior has made the cache structural — and that is an architecture failure.

### 1.2 The Cache Hides Behind an Abstraction

No component in Void calls a caching library directly. Every cache access — read, write, invalidate, check — goes through a cache abstraction interface. The interface expresses cache operations in domain-neutral terms. Behind the interface, the implementation may use an in-process map, a Redis cluster, a Memcached pool, or any other technology.

This abstraction exists so that:
- The cache implementation can be replaced without touching any component that uses it
- Tests can inject a no-op implementation that bypasses caching entirely
- A new caching technology can be evaluated by swapping the implementation behind the interface
- The cache can be disabled globally by substituting the interface with a pass-through that always returns a miss

### 1.3 The Canonical Source Is Always the Authority

The database is the authority on the state of every domain entity. A cache is a copy of a recent read from the authority. When the cache and the database disagree, the database is correct. The cache is stale.

The system must be designed so that stale cache entries produce degraded performance — not incorrect behavior. A stale cache entry that causes a business decision to be wrong (e.g., a cached permission that has since been revoked, a cached balance that has since changed) is a correctness defect caused by incorrect cache scope or incorrect invalidation, not an inherent property of caching.

### 1.4 Complexity Is a Cache Cost

Every cache added to the system adds complexity: a new failure mode (cache unavailable), a new source of inconsistency (stale data), a new operational concern (memory pressure), and a new debugging surface (is the bug in the cache or the source?). A cache that reduces latency by 5% but adds significant complexity is a poor trade. Caches are introduced only when the performance benefit is clearly established and clearly worth the complexity it adds.

---

## 2. Cache as an Optional Layer

### 2.1 The System Must Function Without Any Cache

This rule is architectural, not aspirational. It must be verifiable: at any time, the test suite must be runnable with a no-op cache implementation (one that always returns a miss and accepts writes without storing them) and all tests must pass. Any test that fails when the cache is disabled has exposed a dependency on the cache that violates this policy.

### 2.2 The Cache Interface Is the Decoupling Mechanism

The interface between a component and its cache is defined independently of any specific cache technology. The interface expresses operations in terms of keys and values — it does not expose TTL configuration formats, serialization formats, connection strings, or any implementation detail that would bind a caller to a specific cache technology.

A well-designed cache interface:
```
interface CacheStore {
  get<T>(key: CacheKey): Promise<CacheHit<T> | CacheMiss>
  set<T>(key: CacheKey, value: T, options: CacheOptions): Promise<void>
  delete(key: CacheKey): Promise<void>
  deletePattern(keyPattern: CacheKeyPattern): Promise<void>
  exists(key: CacheKey): Promise<boolean>
  flush(): Promise<void>
}
```

The caller knows nothing about what happens behind this interface.

### 2.3 The No-Op Implementation Is a First-Class Component

The no-op cache implementation — one that stores nothing and returns misses for every get — is not a test artifact. It is a first-class implementation of the cache interface that exists in the production codebase alongside the real implementation. It is used:
- In testing environments where cache state should not persist between test runs
- In deployments where cache infrastructure is not available
- When explicitly disabling the cache for debugging
- As the starting implementation before a real cache is needed

### 2.4 Substitution Is Tested

The ability to substitute the cache implementation is verified by the test suite. A test configuration that uses the no-op implementation confirms that the application runs correctly without cache. A test configuration that uses the real implementation confirms that the application runs correctly with cache. Both must pass.

### 2.5 Cache Keys Are Namespace-Scoped

Every cache key is prefixed with a namespace that identifies the component and the cached concept. Namespace-scoped keys allow the cache to be shared between components without key collisions and allow a component's entire cache to be flushed without affecting other components' cached data.

Format: `{namespace}:{entity}:{identifier}:{version}`

Examples:
- `session:active:acc_123:v2`
- `account:profile:acc_456:v1`
- `contact:list:acc_789:filtered:v3`

The version suffix allows the key format to change — rolling the version effectively invalidates all prior entries for that cached concept without requiring explicit deletion.

---

## 3. Cache Lifecycle

### 3.1 Cache Is Born on First Miss

A cache entry is created when a lookup finds no existing entry (a cache miss) and the caller populates the cache with the result from the canonical source. The entry does not exist before the first miss. This is the cache-aside pattern: the component checks the cache, misses, loads from source, stores in cache, returns the value.

### 3.2 Cache Entries Have One of Three Possible States

| State | Description |
|---|---|
| **Hot** | The entry exists in the cache and has not expired |
| **Stale** | The entry has passed its TTL and been evicted by the cache, or has been explicitly invalidated |
| **Absent** | The entry was never written to the cache, or was flushed |

The system treats Hot and Absent entries differently — Hot is served from cache, Absent triggers a read from the canonical source. Stale entries are handled by TTL expiry or explicit invalidation — the cache never serves a known-stale entry.

### 3.3 Cache Is Populated Synchronously on Miss

When a cache miss occurs, the component reads from the canonical source and writes the result to the cache before returning the value to the caller. The caller receives the value — not a cache miss signal. The cache population is part of the read operation, not a separate background task.

The exception is a pattern where cache population is deliberately asynchronous (pre-warming, background refresh) — these patterns require explicit documentation and must not affect the correctness of the synchronous read path.

### 3.4 Cache Entries Expire Automatically

Every cache entry has a TTL. When the TTL expires, the entry is removed automatically by the cache implementation. No component is responsible for actively expiring individual cache entries — expiry is the cache's responsibility. Components are responsible for choosing TTL values that match the acceptable staleness window for the data they cache.

### 3.5 Cache Is Cleaned Up at Shutdown

When the application shuts down, resources held by the cache layer — connections, memory — are released cleanly. For in-process caches, heap memory is released. For external cache stores, connections are closed. Cache entries themselves are not necessarily flushed at shutdown — their TTL manages their lifetime independently.

---

## 4. TTL Strategy

### 4.1 Every Cache Entry Has an Explicit TTL

There is no such thing as a cache entry without a TTL in Void. An entry that never expires is an entry that grows the cache indefinitely, serves stale data for the lifetime of the process, and is cleared only by explicit invalidation — which may never happen for entries whose associated data was deleted quietly. All entries expire.

### 4.2 TTL Is Chosen Based on Acceptable Staleness

The TTL of a cache entry is determined by the business question: "how stale can this data be before it causes a problem?" The answer varies by data type:

| Data Type | Staleness Tolerance | Suggested TTL Range |
|---|---|---|
| User session state | Very low — stale sessions cause security issues | 30–120 seconds |
| Account profile | Low — users expect recent changes to be visible quickly | 1–5 minutes |
| Permission / authorization data | Very low — stale permissions are a security risk | 30–60 seconds |
| Contact list | Moderate — eventual consistency is acceptable | 5–15 minutes |
| Static configuration | High — rarely changes | 1–24 hours |
| Computed aggregate / count | Moderate — approximate values are acceptable | 2–10 minutes |
| Rate limit counters | Very low — staleness defeats the purpose | 1–10 seconds |

These ranges are starting points. The actual TTL for each cached value is determined by the team, documented in the component that uses the cache, and justified by the staleness tolerance of the specific data.

### 4.3 TTL Is Configured, Not Hardcoded

TTL values are not hardcoded as numeric literals in business logic code. They are defined in configuration — a central location where they can be reviewed, adjusted, and environment-specific overrides applied. A TTL that is correct for production (5 minutes) may be too long for development (where fresh data is needed immediately) or for testing (where entries must expire between test cases).

### 4.4 TTL Jitter Prevents Thundering Herds

When a large number of cache entries for the same data type are created simultaneously — at startup, after a cache flush, after a deployment — they will all expire simultaneously unless jitter is applied. Simultaneous expiry produces a thundering herd: all callers miss simultaneously and issue parallel reads to the canonical source.

Jitter adds a small random offset to each entry's TTL so that entries expire spread over a window rather than at a single moment. The jitter range is typically 10–20% of the base TTL value.

### 4.5 TTL Refresh on Access

For data that is accessed frequently, the TTL may be refreshed on each read — resetting the expiry clock so that actively used data does not expire from the cache. This pattern is appropriate for session data and other per-user state that is valid as long as the user is active. It must be documented explicitly — a TTL that silently refreshes on reads behaves very differently from a fixed TTL.

---

## 5. Invalidation Strategy

### 5.1 Invalidation Is the Hardest Part of Caching

Cache invalidation — ensuring that a cached entry is removed or updated when the underlying data changes — is the primary source of cache-related bugs. Invalidation is difficult because the change event and the cache entry may be in different components, on different processes, or at different times.

The design of invalidation logic must be as deliberate as the design of the cache population logic.

### 5.2 Invalidation Is Triggered by Write Operations

When a Service operation writes data that is cached, the write operation is responsible for triggering invalidation of the relevant cache entries. The write and the invalidation are paired — they happen in the same Service method.

The pattern:
1. Write to the canonical source (database)
2. Invalidate the relevant cache entry or entries
3. Return the result

Invalidation happens after the write succeeds. If the write fails, there is nothing to invalidate. If the invalidation fails, the cache entry will eventually expire on its own TTL — this is the acceptable fallback.

### 5.3 Invalidation Strategies

**Key-based invalidation:** The component that writes the data knows the exact cache key to invalidate. This is the most precise form of invalidation and produces the least cache churn.

**Pattern-based invalidation:** When a write operation affects multiple cache entries whose exact keys cannot be enumerated — all sessions for an account, all contacts in a list — the cache is invalidated by pattern (namespace prefix + partial key). This requires that the cache implementation supports pattern-based deletion.

**Version-based invalidation:** The cache key includes a version number or a timestamp. When the underlying data changes, the version is incremented, making all prior cache keys effectively stale without explicit deletion. Old entries expire on their TTL. This is the most resilient approach for distributed caches where pattern-based deletion is unreliable.

**TTL-only invalidation:** For data whose consistency requirements are low — configuration data, static reference data — explicit invalidation is not performed. The TTL is set short enough that staleness is acceptable within the TTL window. This is the simplest approach and appropriate only where business tolerates the full TTL staleness window.

### 5.4 Invalidation Does Not Guarantee Immediate Consistency

A cache invalidation operation removes an entry from the cache at the moment of invalidation. In a distributed system, there is a window between when the write occurs and when all cache nodes have processed the invalidation. During this window, some callers may see the old value. This is eventual consistency. The system design must account for this window — critical decisions must not be made on cached data where a staleness window would produce incorrect outcomes.

### 5.5 Invalidation Failures Are Logged but Not Fatal

If a cache invalidation operation fails — because the cache store is unreachable, because the key does not exist — the failure is logged but does not cause the originating write operation to fail. The write succeeded. The cache entry will expire on its TTL and the next read will populate a fresh entry. Failing a write because its cache invalidation failed would make the system's correctness dependent on the cache — which violates Section 2.1.

---

## 6. Memory Management

### 6.1 Cache Memory Is Bounded

Every cache instance — local or distributed — has a defined maximum memory allocation. When the maximum is reached, the eviction policy determines which entries are removed to make space for new ones. There is no cache that is allowed to grow without limit.

Exceeding the memory bound is not an error — it is the expected behavior when the cache is under pressure. The system responds by evicting entries, which produces cache misses, which produces more reads from the canonical source. This is graceful degradation, not failure.

### 6.2 Eviction Policies Are Defined Explicitly

The eviction policy for each cache instance is explicitly defined and justified. Common policies:

| Policy | Description | When to Use |
|---|---|---|
| **LRU** (Least Recently Used) | Evicts the entry that was read least recently | General purpose — most callers want recent data |
| **LFU** (Least Frequently Used) | Evicts the entry accessed fewest times overall | When some entries are permanently "hot" and should never be evicted |
| **TTL-first** | Evicts the entry closest to TTL expiry | When memory pressure correlates with TTL staleness |
| **FIFO** | Evicts the oldest-written entry | Queue-like workloads; rarely appropriate for domain caches |

The default eviction policy in Void is **LRU** unless a specific cache instance has documented justification for another policy.

### 6.3 Entry Size Is Bounded

A single cache entry must not consume an unbounded amount of memory. When storing a value whose size varies — a serialized list that grows with user activity — the entry must either cap the stored payload at a documented maximum or must not be cached (and should instead be paginated at the query level).

A cache entry that stores an arbitrarily large serialized collection is a denial-of-service vector — one large collection can occupy significant cache space, evicting many smaller entries.

### 6.4 Memory Pressure Is Observable

The cache reports its memory usage, hit rate, miss rate, and eviction rate to the monitoring system. Memory pressure is visible before it produces problems. An eviction rate that is increasing suggests the cache is undersized or the data volume has grown beyond the cache's capacity. Both situations require response — more cache memory, smaller entry payloads, or reduced TTLs.

### 6.5 In-Process Caches Are Bounded Globally

When multiple in-process cache instances exist — one per Service that caches its own data — their combined memory consumption must stay within a global bound. An application with twenty Service-level caches, each with no individual bound, can consume unbounded heap memory. Each in-process cache instance declares its maximum size, and the sum of all in-process cache sizes is tracked.

---

## 7. Cache Consistency

### 7.1 Define the Consistency Level Before Caching

Before caching any data, the team must answer: what level of consistency is acceptable for this data? The answer determines the TTL, the invalidation strategy, and whether the data should be cached at all.

| Consistency Level | Description | Cache Approach |
|---|---|---|
| **Strong** | Readers always see the most recent write | Do not cache, or cache with immediate invalidation on write |
| **Bounded-staleness** | Readers may see data that is at most N seconds old | Cache with TTL ≤ N; invalidate on write |
| **Eventual** | Readers will eventually see the most recent write | Cache with any TTL; invalidation is best-effort |
| **Session-consistent** | A reader always sees their own writes | Cache on a per-session basis; invalidate on that session's writes |

Caching is not appropriate for data that requires strong consistency unless the cache is always invalidated on write and the invalidation is synchronous and guaranteed.

### 7.2 Critical Paths Must Not Read From Cache

Operations where a stale read would cause an incorrect business outcome must read from the canonical source — not from cache. Examples:
- Checking whether a session is valid before executing a sensitive operation
- Reading an account's current permission level before authorizing an action
- Reading a rate limit counter before deciding whether to allow a request

These reads may be preceded by a cache lookup that serves a fast path — but the critical decision must be backed by a canonical read if the cached value is at all suspect.

### 7.3 Cache Poisoning Must Be Prevented

Cache poisoning — storing an incorrect value in the cache, causing subsequent reads to receive the incorrect value until the TTL expires — is a correctness defect. Poisoning sources include:
- Storing an error response as if it were a success result
- Storing an empty result when the source returned empty due to an infrastructure failure
- Storing a partial result from a failed read

When the source read fails, the cache must not be populated. A failed read produces no cache entry.

### 7.4 Write-Through vs. Cache-Aside

Void uses the **cache-aside** pattern by default:
1. Read: check cache → if miss, read from source → store in cache → return
2. Write: write to source → invalidate cache entry

**Write-through** (write to cache and source simultaneously) is permitted for specific use cases where the cache must immediately reflect every write. When write-through is used, it must be documented at the cache site with the reason the cache-aside pattern was insufficient.

---

## 8. Local Cache

### 8.1 Local Cache Is In-Process Memory

A local cache stores entries in the application process's heap memory. It is faster than any external cache — access requires no network round trip, no serialization, no deserialization. Local cache is the highest-performance cache option available.

### 8.2 Local Cache Is Per-Process

Each application process has its own local cache. Entries written to one process's local cache are not visible to other processes. In a multi-process deployment, two processes may hold different cached values for the same key.

This isolation property defines when local cache is appropriate: for data where per-process consistency is acceptable. Each process's cache eventually converges on the same value (through TTL expiry and canonical reads), but at any given moment they may differ.

### 8.3 Local Cache Is Not Durable

When a process restarts, its local cache is lost. All entries must be rebuilt from the canonical source. Local cache must not hold data that the process depends on at startup — initialization reads must go directly to the canonical source.

### 8.4 Local Cache Is Appropriate For

- **Configuration data:** Rarely changes, process-local consistency is acceptable, TTL-only invalidation is sufficient
- **Static reference data:** Lookup tables, country codes, feature flags — high read rate, very low write rate
- **Computed values:** Derived data that is expensive to compute and does not change frequently
- **Per-request intermediate results:** Data needed multiple times within a single request but not across requests (request-scoped cache, not a persistent cache)

### 8.5 Local Cache Size Is Configured at Construction

Every local cache instance declares its maximum entry count (or maximum byte size) at construction time. The value is configurable through the application's configuration system — not hardcoded. The monitoring system reads the actual utilization and reports it.

---

## 9. Distributed Cache

### 9.1 Distributed Cache Is Shared Across Processes

A distributed cache — backed by an external store — is shared across all application processes. An entry written by one process is readable by all other processes. A distributed cache provides cross-process consistency that a local cache cannot.

### 9.2 Distributed Cache Introduces Network Dependency

Every access to a distributed cache is a network call. The cache store may be unavailable. The network may be slow. Distributed cache access must be:
- Asynchronous — never blocking the event loop
- Timeout-bounded — a cache read that hangs indefinitely is a latency defect
- Failure-tolerant — a cache miss (due to store unavailability) must be handled identically to a legitimate cache miss; the system falls back to the canonical source

A distributed cache that is unavailable does not cause a system outage — it causes elevated load on the canonical source as all reads become cache misses.

### 9.3 Distributed Cache Is Not a Coordination Mechanism

A distributed cache is not a distributed lock, a message queue, or a coordination system. It stores and retrieves values by key. Using a cache as a distributed coordination mechanism — for leader election, for work distribution, for event ordering — imposes guarantees on the cache that it does not provide. Distributed coordination requires dedicated systems designed for that purpose.

### 9.4 Serialization Is Owned by the Cache Layer

When storing values in a distributed cache, the cache implementation handles serialization (converting the domain value to a storable byte sequence) and deserialization (converting back). The caller stores and retrieves domain values — it does not manually serialize. The serialization format is a cache implementation detail.

### 9.5 Serialization Changes Require Key Versioning

When the structure of a cached value changes — a new field, a removed field, a type change — the existing cached entries in the distributed store may not be deserializable with the new code. The correct response is to increment the key version (see Section 2.5), causing the old entries to be ignored and repopulated with the new structure.

### 9.6 Distributed Cache Is Appropriate For

- **Session state across a horizontally scaled service:** Multiple processes serve the same user — the session must be visible to all
- **Shared rate limit counters:** Rate limiting requires a globally consistent count across processes
- **Cross-process deduplication:** Ensuring an operation is performed only once across a multi-process system
- **Expensive global computations:** A value whose computation takes seconds and is needed by all processes — compute once, share everywhere

---

## 10. Performance

### 10.1 Cache Hit Rate Is the Primary Metric

The value of a cache is measured by its hit rate — the fraction of reads that are served from the cache rather than the canonical source. A cache with a low hit rate provides little benefit while adding operational complexity.

Target hit rates vary by use case:
- High-traffic read-heavy data: > 95% hit rate
- Moderate-traffic data: > 80% hit rate
- Rarely accessed data: Question whether the cache is worth maintaining

A cache with a consistently low hit rate should be removed rather than tuned.

### 10.2 Cache Read Must Be Faster Than Source Read

If a cache read — including the serialization overhead for distributed caches — is not meaningfully faster than reading from the canonical source, the cache provides no performance benefit. Before adding a cache, measure the canonical source read time. If the difference is negligible, the cache is not justified.

### 10.3 Cache Write Must Not Dominate Write Path Latency

When a write operation invalidates a cache entry, the invalidation must be fast relative to the write itself. A cache invalidation that takes longer than the database write it accompanies has inverted the performance profile and made the cache a write-path bottleneck.

### 10.4 Cache Warmup for Predictable Access Patterns

For data that is accessed heavily immediately after startup — configuration, active sessions, frequently accessed accounts — a warmup process may pre-populate the cache before the service begins serving traffic. Warmup eliminates the cold-start thundering herd. Warmup must be bounded in time — a warmup that is still running when the service begins serving traffic is a startup sequencing problem.

### 10.5 Cache Access Latency Is Measured

Every cache implementation measures and reports access latency — the time from issuing a cache read to receiving the result. For distributed caches, this includes network round-trip time. For local caches, this is the lookup time in the data structure. Latency regressions in cache access are caught early through monitoring.

---

## 11. Observability

### 11.1 Every Cache Instance Reports Standard Metrics

Regardless of the underlying implementation, every cache instance reports:
- Hit count and hit rate (rolling window)
- Miss count and miss rate
- Eviction count and eviction rate
- Current entry count and memory usage (where measurable)
- Error count (failed reads or writes to the cache store)
- Average read latency and write latency

### 11.2 Cache Metrics Are Labeled by Namespace

Cache metrics are labeled with the namespace of the cache instance producing them. Aggregate cache metrics that do not identify which cache is struggling are not actionable.

### 11.3 Cache Misses Are Not Logged Individually

A cache miss is an expected, normal occurrence. Logging every cache miss produces noise that obscures meaningful signals. Cache miss rates are tracked as aggregated metrics — not as individual log entries. The exception is a cache miss that triggers a fallback of significant cost (a full table scan, an external API call) — these may be logged at `debug` level during diagnosis.

### 11.4 Cache Store Unavailability Is an Alert

A distributed cache store that becomes unavailable causes all reads to fall back to the canonical source. This is operationally handled — the system degrades gracefully. But the unavailability itself is a condition that requires prompt operator attention. A metric alert fires when the error rate on distributed cache operations exceeds a threshold.

---

## 12. Best Practices

1. **Start without a cache.** Measure first. Identify the specific query, operation, or code path that is slow. Then add a cache targeted at that specific bottleneck. A cache added speculatively — before a performance problem is measured — adds complexity without proven benefit.

2. **Document every cache decision.** At every cache site in the code: document what is being cached, why it is being cached, the TTL choice and its justification, and the invalidation strategy. A cache without inline documentation is an invisible optimization whose design intent will be lost within one maintenance cycle.

3. **Co-locate invalidation with the write.** The code that writes data and the code that invalidates the corresponding cache entry must be in the same method. Separated invalidation — "the write is here; the invalidation is over there" — produces invalidation omissions when the write is modified without updating the distant invalidation.

4. **Use short TTLs for security-sensitive data.** Session tokens, permission records, authentication state — these have a staleness tolerance measured in seconds, not minutes. A stale permission cache that allows a revoked session to proceed for five minutes is a security vulnerability. Short TTLs limit the damage window.

5. **Prefer key versioning over pattern invalidation in distributed caches.** Pattern-based key deletion in distributed caches is expensive — it requires a key scan. Key versioning achieves the same effect (making all prior entries for a concept effectively invisible) without the scan cost. Old entries expire on their TTL.

6. **Test the no-cache path regularly.** Run the test suite with the no-op cache implementation on a regular schedule — not just when debugging. This confirms that the system remains correct without cache and that no code has silently assumed cache presence.

7. **Isolate cache keys per environment.** Development, staging, and production environments must never share a cache store. If they do, a development write can corrupt production cache entries, and a staging flush can warm production. Environment isolation is a hard requirement for shared cache stores.

---

## 13. Anti-Patterns

### 13.1 The Structural Cache

A cache that the system depends on for correctness — not just for performance. The system fails, returns incorrect results, or refuses operations when the cache is unavailable. This is the most severe cache anti-pattern. It means the cache has become part of the system's data model rather than a read optimization.

### 13.2 The Eternal Cache

A cache entry with no TTL, or with a TTL set to an extremely long duration (days, weeks, effectively infinite). Eternal cache entries serve stale data for arbitrarily long periods and are cleared only by explicit invalidation — which may be forgotten when the source data is updated, or may fail silently. Every cache entry expires.

### 13.3 The Cache-on-Cache

Caching the result of reading from another cache. If the inner cache is the authoritative fast path, the outer cache adds staleness with no performance benefit. If the inner cache is not the fast path, the outer cache is masking a problem with the inner cache rather than solving it.

### 13.4 The Write-Only Cache

A cache that is populated (written) but whose hit rate is measured and found to be near zero — because the data is rarely read, or because the cache key format does not match the read access pattern, or because the TTL expires before any read occurs. A cache that is never read is pure overhead — writes are wasted and memory is consumed for no benefit.

### 13.5 The Global Cache God

A single shared cache namespace used by all components without prefix or isolation. Components collide on keys, invalidations from one component incorrectly evict another component's entries, and the cache's contents cannot be understood without inspecting all components simultaneously. Every cache is namespace-scoped and isolated.

### 13.6 The Error Cache

Caching an error response — "I looked up entity X and got an error, so I cached the error to avoid re-reading." Caching errors is almost always wrong: the error may be transient, and caching it causes a permanent failure for the TTL duration. Errors are not cached. A read error produces no cache write.

### 13.7 The Invisible Cache

A cache that is not mentioned in any documentation, not labeled in any metric, and has no inline comment explaining its existence. An invisible cache is discovered only when it causes a problem — at which point its design intent, TTL justification, and invalidation strategy are unknown. Every cache is documented.

---

## 14. Forbidden Cache Practices

### 14.1 Storing Canonical State in Cache Only

Any piece of data whose only persistent copy is in the cache is forbidden. The cache is a copy of canonical storage — it is never the original. Data that exists only in the cache is lost when the cache is flushed, the TTL expires, or the process restarts.

### 14.2 Making Business Decisions on Cached Data Without Fallback

A business decision — authorization, eligibility, rate limiting — that reads from the cache and proceeds without a canonical fallback when the cached value is missing is forbidden for security-sensitive or correctness-critical data. If the cache is unavailable, the decision must still be correct.

### 14.3 Cache Store Access Outside the Cache Abstraction

Importing and calling a cache library (Redis client, Memcached client, in-memory map) directly in a Service, Manager, Command, or Plugin is forbidden. All cache access goes through the cache abstraction interface. This rule has no exceptions.

### 14.4 Shared Cache Stores Across Environments

Development, staging, and production must never share a cache store. Environment data isolation is mandatory. Cross-environment cache sharing is an operational safety violation.

### 14.5 Skipping Invalidation for "Unlikely" Write Paths

A write operation that skips cache invalidation because "that data is rarely written" is an incomplete implementation. Staleness that occurs rarely is often the staleness that causes the hardest-to-reproduce bugs. Every write path that produces cached data must invalidate the corresponding cache entries, regardless of write frequency.

### 14.6 Using Cache Entries as Distributed Locks

A cache entry (especially one created with a set-if-not-exists pattern) used as a distributed lock is forbidden unless the cache store explicitly provides distributed locking semantics with guaranteed expiry, atomic compare-and-swap, and clear failure modes. General-purpose caches are not distributed lock managers. Distributed locking requires purpose-built infrastructure.

---

## 15. AI Cache Rules

This section defines how an AI system must reason about caching when developing within Void.

### 15.1 The AI Must Confirm the Performance Problem Before Adding Cache

When the AI is asked to improve performance, or when the AI identifies a potential caching opportunity, it must first confirm that the performance problem is measured and documented. The AI must not add a cache speculatively. If no performance measurement exists, the AI should instrument the operation to measure first — then add cache once the bottleneck is confirmed.

### 15.2 The AI Must Use the Cache Abstraction

When generating code that accesses the cache, the AI must use the defined cache abstraction interface — not a cache library directly. If the abstraction does not exist yet, the AI must generate the abstraction first, then use it. The AI must never generate raw library calls to Redis, Memcached, or an in-memory map from a non-cache-layer component.

### 15.3 The AI Must Generate the Invalidation Alongside the Cache Population

When the AI generates cache population code (writing to cache after a read), it must simultaneously generate the corresponding invalidation code (clearing from cache after the related write). A cache population without its invalidation is an incomplete implementation. The AI must deliver both.

### 15.4 The AI Must Generate a Documented TTL

Every cache entry the AI generates must have an explicit TTL with an inline comment explaining the chosen value: what staleness tolerance the TTL represents and why that tolerance is acceptable for this data type.

### 15.5 The AI Must Generate the No-Op Implementation

When the AI creates a new cache abstraction or a new cache-backed component, it must simultaneously generate the no-op implementation of the cache interface. The no-op implementation allows the component to be tested without a real cache store.

### 15.6 The AI Must Not Cache Security-Sensitive Data Without Short TTLs

When the AI caches data that is security-sensitive — sessions, permissions, authentication state, rate limit state — it must use a TTL that is at most 60 seconds unless there is explicit documentation justifying a longer value. The AI must flag any TTL over 60 seconds for security-sensitive data as a potential vulnerability.

### 15.7 The AI Must Verify the System Works Without Cache

Before delivering any caching implementation, the AI must verify that the system's logic — separated from the cache layer — is complete and correct. The cache must not be the mechanism that makes an operation succeed. A system that only works with the cache enabled has a structural defect that the AI must identify and resolve.

### 15.8 The AI Must Not Generate Eternal Cache Entries

Every cache entry generated by the AI has an explicit, finite TTL. The AI must not generate cache writes with no expiry, with a zero TTL (some libraries use zero to mean "never expire"), or with a TTL measured in days or weeks without specific documented justification.

### 15.9 The AI Must Label Cache Keys With Namespace and Version

Every cache key generated by the AI follows the `{namespace}:{entity}:{identifier}:{version}` format. The AI must not generate bare, unlabeled cache keys that could collide with other components' keys or that cannot be invalidated by pattern.

### 15.10 When Cache Complexity Exceeds Benefit, the AI Must Say So

If the AI is asked to cache something and determines that the invalidation complexity, the consistency requirements, or the operational overhead outweigh the performance benefit, it must say so — and propose the measurement that would justify the cache rather than implementing it immediately.

---

## 16. Review Checklist

Use this checklist for every code review that introduces or modifies caching logic.

### Substitutability
- [ ] All cache access goes through the cache abstraction interface — no direct library calls from non-cache-layer components
- [ ] A no-op implementation exists for the cache interface
- [ ] The system's test suite runs and passes with the no-op implementation in place
- [ ] The system's business logic is correct independently of cache availability

### Cache Entry Design
- [ ] Every cache entry has an explicit, finite TTL
- [ ] The TTL is configurable — not hardcoded as a numeric literal
- [ ] The TTL value is documented with a justification comment
- [ ] TTL jitter is applied to prevent thundering herds on simultaneous expiry
- [ ] Cache keys follow the `{namespace}:{entity}:{identifier}:{version}` format
- [ ] Cache keys are unique to the specific data type and identifier they represent

### Invalidation
- [ ] Invalidation code is present and co-located with the corresponding write operation
- [ ] All write paths that produce cached data have corresponding invalidation
- [ ] Invalidation failures are logged but do not fail the originating write
- [ ] The invalidation strategy (key-based, pattern-based, version-based, TTL-only) is documented

### Memory Management
- [ ] Every local cache instance declares a maximum size
- [ ] Every local cache instance has a documented eviction policy
- [ ] No single cache entry stores an unbounded payload
- [ ] The combined memory of all in-process caches is within the global bound

### Consistency
- [ ] The consistency level for this cached data is defined (strong / bounded-staleness / eventual / session-consistent)
- [ ] The TTL does not exceed the acceptable staleness window for this data
- [ ] Security-sensitive data has a TTL ≤ 60 seconds (or has documented justification)
- [ ] Error responses from the canonical source are not stored in the cache

### Distributed Cache (if applicable)
- [ ] All distributed cache reads are timeout-bounded
- [ ] Distributed cache unavailability is handled as a cache miss — not as an error
- [ ] Key versioning is used for structural changes to cached values
- [ ] The cache store is environment-isolated — not shared with development or staging

### Performance
- [ ] The performance problem being solved is measured and documented
- [ ] Cache access latency is measurably faster than canonical source access
- [ ] Cache write latency does not dominate the write path
- [ ] Cache hit rate target is defined

### Observability
- [ ] The cache instance is registered with the monitoring system
- [ ] Hit rate, miss rate, eviction rate, and memory usage are reported
- [ ] Cache metrics are labeled with the namespace

### Testing
- [ ] The component works correctly when the no-op cache is substituted
- [ ] The no-op path is tested — not just the cached path
- [ ] Cache-miss behavior (reading from canonical source and populating cache) is tested
- [ ] Invalidation behavior (write → cache miss on subsequent read) is tested

---

*This document is the official and sole reference for cache design in Void. The cache is optional infrastructure. It makes the system faster — never more correct. It hides behind an abstraction — never exposed to business logic. It expires — never persists indefinitely. Any cache that violates these three properties is not a cache optimization; it is a structural dependency that must be redesigned.*
