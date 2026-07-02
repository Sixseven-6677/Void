# 22 — Performance Policy

> **Status:** Official  
> **Scope:** All performance decisions in Void — memory management, CPU usage, async optimization, queue management, resource limits, profiling, scaling, and the governing principle that stability is never sacrificed for performance  
> **Authority:** This document is the single source of truth for performance engineering in Void. Performance work is not complete when something is faster — it is complete when something is faster, stable, observable, and tested. An optimization that improves throughput at the cost of reliability, memory safety, or operational predictability is not an optimization. It is a trade-off that this policy does not permit.

---

## Table of Contents

1. [Performance Philosophy](#1-performance-philosophy)
2. [The Stability-First Principle](#2-the-stability-first-principle)
3. [Memory Usage](#3-memory-usage)
4. [CPU Usage](#4-cpu-usage)
5. [Async Optimization](#5-async-optimization)
6. [Queue Optimization](#6-queue-optimization)
7. [Resource Limits](#7-resource-limits)
8. [Monitoring](#8-monitoring)
9. [Profiling](#9-profiling)
10. [Scaling](#10-scaling)
11. [Database Performance](#11-database-performance)
12. [Network Performance](#12-network-performance)
13. [Best Practices](#13-best-practices)
14. [Anti-Patterns](#14-anti-patterns)
15. [Forbidden Performance Practices](#15-forbidden-performance-practices)
16. [AI Performance Rules](#16-ai-performance-rules)
17. [Performance Review Checklist](#17-performance-review-checklist)

---

## 1. Performance Philosophy

### 1.1 Performance Is a Feature, Not an Afterthought

Performance is designed into the system — not bolted on after the fact. A component that processes messages, manages sessions, or serves authentication requests has performance requirements that are as much a part of its specification as its functional requirements. These requirements are defined before implementation begins and verified before the implementation ships.

An implementation that is functionally correct but unacceptably slow is an incomplete implementation. "We will optimize it later" is a statement that has never reliably led to optimization. Later comes with accumulated technical debt, changed abstractions, and new priorities that compete with the optimization work. Performance requirements are met when the feature ships.

### 1.2 Measure Before Optimizing

Every performance optimization is preceded by a measurement that identifies the bottleneck. An optimization applied to code that is not the bottleneck produces no user-visible improvement while increasing code complexity and maintenance cost. The profiler, not the programmer's intuition, identifies what is slow.

The workflow is: observe a performance problem → measure to identify the bottleneck → optimize the bottleneck → measure again to verify the improvement → document the result. Skipping the measurement steps produces optimization work that cannot be evaluated and cannot be trusted.

### 1.3 Correctness Is Not Negotiable for Performance

There is no performance improvement worth a correctness compromise. A system that is fast but occasionally sends duplicate messages, occasionally loses session state, or occasionally applies incorrect business logic is not a performant system — it is a broken system that happens to be fast when it is not broken.

Every performance optimization must pass the full test suite. An optimization that requires disabling tests, narrowing test assertions, or introducing "known acceptable inconsistencies" is an optimization that must not ship.

### 1.4 Complexity Is a Performance Cost

An optimization that makes the code significantly harder to understand has a real cost: the increased complexity makes future changes slower, more error-prone, and more likely to introduce regressions. The complexity cost must be weighed against the performance benefit. A 2% throughput improvement that doubles the code's complexity is not an acceptable trade-off. A 10x throughput improvement that requires one carefully-contained, well-documented optimized component may be.

### 1.5 The Performance Contract

Every Service, Repository, and middleware stage has a defined performance contract: the expected latency at p50, p95, and p99 under the system's expected load. These contracts are the performance requirements that drive optimization work and the acceptance criteria that define when optimization is complete.

---

## 2. The Stability-First Principle

### 2.1 Stability Is the Non-Negotiable Foundation

Performance without stability is not a property worth having. A system that serves requests at 10,000 RPS but crashes under unexpected load, leaks memory until it is OOM-killed, or produces incorrect results under concurrency is not a high-performance system. It is an unreliable system that occasionally achieves high throughput.

Stability means:
- The system produces correct results consistently, not just under ideal conditions
- The system degrades gracefully under overload — it slows down without crashing
- The system recovers from failures without human intervention
- The system's behavior is predictable and observable

Every performance decision is evaluated against this stability foundation first.

### 2.2 Performance Optimizations That Threaten Stability Are Rejected

The following optimizations are rejected regardless of the throughput improvement they offer:

- **Removing retry logic** to reduce latency — reliability is worth the latency cost
- **Disabling validation** to reduce processing time — correctness is worth the validation cost
- **Sharing mutable state between concurrent operations** to avoid copying — thread safety is worth the copy cost
- **Removing timeouts** to avoid timeout-induced failures — bounding execution time is worth occasional latency
- **Bypassing the Repository layer** to issue direct queries — the access boundary is worth the abstraction cost
- **Caching authorization decisions for long periods** to reduce auth latency — security is worth the cache miss

When a performance improvement requires one of these trade-offs, the improvement is not made. The performance problem is solved another way.

### 2.3 Graceful Degradation Is a Performance Property

A system that degrades gracefully under load — accepting fewer requests, queue-ing excess work, returning cached results — is performing better than a system that serves at maximum throughput until it crashes. Graceful degradation is explicitly designed into the system's performance architecture:

- **Load shedding:** Reject requests when the system is overloaded rather than accepting them and failing them slowly
- **Circuit breaking:** Stop calling a dependency that is failing rather than waiting for each call to time out
- **Backpressure:** Slow producers when consumers cannot keep up rather than letting queues grow without bound

These patterns are not emergency measures — they are designed-in responses to overload conditions.

---

## 3. Memory Usage

### 3.1 Memory Ownership Is Explicit

Every significant allocation — a large buffer, a long-lived cache, a data structure that grows with system usage — has an explicit owner responsible for its lifecycle: allocation, use, and release. Memory without a clear owner is memory that will leak.

Large allocations are documented: what they hold, how large they can grow, when they are released.

### 3.2 Memory Budgets Per Component

Every component that maintains significant in-memory state — caches, pools, active session maps, message queues — has a defined memory budget: the maximum amount of heap memory it may consume. Budgets are expressed as absolute sizes (MB, GB) or as relative sizes (fraction of available heap).

When a component exceeds its budget, it must shed load — evict cache entries, reject new items, emit an alert — rather than growing without bound. An unbounded in-memory structure is a slow memory leak that will eventually produce an OOM crash.

### 3.3 Large Allocations Are Pooled or Streamed

Operations that process large data — reading large message histories, processing bulk account updates, loading large session state — must not allocate the entire dataset into memory simultaneously. The approach is either:

- **Pooling:** Reuse pre-allocated buffers rather than allocating and freeing on every operation
- **Streaming:** Process data in bounded chunks, releasing each chunk before loading the next

A function that reads 50,000 records into an array before processing them is a function that allocates 50,000 record-sized objects simultaneously. Under load, multiple concurrent executions of this function produce memory spikes that trigger garbage collection pauses and OOM conditions.

### 3.4 Garbage Collection Pressure Is Managed

In a garbage-collected runtime, frequent large allocations and rapid deallocations produce high GC pressure — the GC runs frequently, causing stop-the-world pauses that introduce latency spikes. Patterns that produce high GC pressure:
- Creating many short-lived large objects in hot code paths
- Allocating and immediately discarding intermediate results
- Building large strings through repeated concatenation

Hot code paths — those executed on every request — are written to minimize allocation. Expensive objects needed repeatedly are created once and reused.

### 3.5 Memory Leaks Are Treated as P1 Bugs

A memory leak — a pattern where allocated memory is never released, causing heap usage to grow indefinitely over the process lifetime — is a P1 bug. It will eventually cause an OOM crash, requiring a restart that drops in-flight requests. Memory leaks are diagnosed using heap profiling and fixed before any other work proceeds.

The indicators of a memory leak: heap usage that grows monotonically over hours without returning to baseline, GC cycles that free progressively less memory per cycle, process RSS that trends upward indefinitely.

### 3.6 WeakMaps and WeakRefs for Associative Caches

When a component needs to associate data with an object whose lifetime it does not control — adding metadata to a request object, caching computed properties of an entity — it uses `WeakMap` or `WeakRef`. These data structures do not prevent garbage collection of the keys. A regular `Map` whose keys are objects will keep those objects alive for the Map's lifetime, leaking all associated data.

---

## 4. CPU Usage

### 4.1 CPU-Intensive Work Leaves the Event Loop

In an event-driven single-threaded runtime, any synchronous CPU-intensive operation — large sort operations, complex computations, JSON serialization of large objects, cryptographic operations — blocks the event loop for its duration. While the event loop is blocked, no other request is processed, no I/O completes, and no timer fires.

CPU-intensive work is offloaded from the main event loop:
- **Worker threads:** For parallelizable CPU work that can run in a separate thread
- **Async wrappers:** For CPU work in libraries that provide async interfaces
- **Scheduled batching:** For work that can be done in small increments between event loop ticks

### 4.2 Hot Code Paths Are Algorithm-Optimized

A code path executed on every request — authentication, validation, session lookup — must use the most efficient algorithm available for its operation. An O(N²) operation in a hot path that is called 1000 times per second with N=100 produces 10,000,000 operations per second from that one path alone.

Before shipping a feature, the algorithmic complexity of its hot-path operations is reviewed. Any hot-path operation that is O(N²) or worse is redesigned.

### 4.3 Repeated Computation Is Cached

A computation whose inputs do not change between invocations and whose result is the same for the same inputs — a compiled regex, a parsed configuration value, a pre-computed lookup table — is computed once and cached. Recomputing the same value on every invocation of a hot-path function is wasted CPU.

### 4.4 JSON Parsing and Serialization Are Bounded

JSON parsing and serialization are O(N) in the size of the payload. Large JSON payloads parsed or serialized on every request produce significant CPU overhead. Limits:
- Request body size is bounded at the middleware layer — oversized payloads are rejected
- Response payloads are constructed to include only required fields — not entire entity graphs
- Repeated serialization of the same object is avoided — serialize once, reuse the string

### 4.5 Regular Expressions Are Precompiled

A regular expression used in a hot code path is compiled once — at module initialization — and reused across calls. Creating a new `RegExp` object on every function call that uses it compiles the regex on every call, which is unnecessary CPU cost.

---

## 5. Async Optimization

### 5.1 Parallelism Is Used for Independent Operations

When a function needs the results of N independent async operations — loading an account and loading its sessions, where neither depends on the other — it initiates all N operations in parallel and awaits them together. Sequential awaiting of independent operations multiplies the latency unnecessarily.

```
// Slow: sequential — total time = A + B
const account = await loadAccount(id);
const sessions = await loadSessions(id);

// Fast: parallel — total time = max(A, B)
const [account, sessions] = await Promise.all([
  loadAccount(id),
  loadSessions(id)
]);
```

Every function that sequentially awaits operations that could be parallel is a performance defect.

### 5.2 Parallelism Has Concurrency Limits

Uncontrolled parallelism — initiating N async operations simultaneously where N is unbounded — is a denial-of-service against the underlying dependencies. Fetching 10,000 messages in parallel issues 10,000 simultaneous database queries. The database connection pool is exhausted, queries queue, and latency spikes across the entire system.

Parallel operations are bounded by a concurrency limit appropriate to the dependency:
- Database operations: bounded by the connection pool size divided by expected concurrent callers
- External API calls: bounded by the rate limit of the external service
- File I/O: bounded by the OS file descriptor limit

### 5.3 The Event Loop Is Never Starved

A long promise chain that performs complex async work in a tight loop — without yielding to the event loop — can starve other tasks. In a single-threaded runtime, the microtask queue (Promise callbacks) is drained completely before any macrotask (timers, I/O callbacks) runs. A promise chain that generates many microtasks without yielding prevents timers and I/O from processing.

Long-running async loops yield periodically: `await setImmediate()` or equivalent, allowing the event loop to process pending I/O and timer callbacks between loop iterations.

### 5.4 Backpressure Is Applied in Async Pipelines

When an async producer generates work faster than an async consumer processes it, backpressure is applied: the producer is slowed or paused until the consumer catches up. Without backpressure, the queue between producer and consumer grows without bound, consuming memory and eventually causing either memory exhaustion or extremely high latency as items wait in the queue.

Every producer-consumer async pipeline in Void has defined backpressure behavior: at what queue depth does the producer pause, and at what queue depth does it resume?

### 5.5 Promise Rejections Are Always Handled

An unhandled promise rejection — a Promise that rejects without a `.catch()` handler or an `await` in a `try/catch` — produces an unhandled rejection event. Depending on runtime configuration, this either silently discards the error or crashes the process. Neither is acceptable.

Every Promise either has an explicit `.catch()` or is awaited in a `try/catch`. Fire-and-forget Promises — those intentionally not awaited — are explicitly wrapped in error handling that logs the failure.

---

## 6. Queue Optimization

### 6.1 Queue Depth Is a System Health Indicator

A queue is a buffer between a producer and a consumer. A healthy queue has bounded depth — items enter and leave at roughly the same rate. A growing queue indicates that the consumer cannot keep up with the producer. An unbounded growing queue will eventually exhaust memory.

Every queue in Void has a maximum depth configured. When the maximum is reached, the system applies the configured overflow policy: reject new items (load shedding), block the producer (backpressure), or evict old items (if recency is more important than completeness).

### 6.2 Queue Processing Is Ordered by Priority

Not all items in a queue are equally urgent. A queue that processes items purely in FIFO order will process low-priority background work before high-priority user-facing work if the low-priority items arrived first. Priority-ordered queues ensure that high-priority items are processed first, regardless of arrival order.

Per `19-scheduler-policy.md`, job queues are priority-ordered with aging to prevent starvation. The same principle applies to every in-process queue that processes heterogeneous work.

### 6.3 Batch Processing Reduces Per-Item Overhead

When a consumer processes items from a queue, fixed overhead is paid per processing cycle — queue polling, lock acquisition, metric emission. Processing items in batches — fetching N items per cycle rather than one — amortizes this overhead across N items, reducing it by a factor of N.

Batch size is tuned to balance latency (larger batches have higher tail latency for the first item in the batch) against throughput (larger batches have lower per-item overhead).

### 6.4 Queue Consumers Are Monitored for Lag

Queue consumer lag — the difference between the newest item in the queue and the last item the consumer processed — is a real-time indicator of how far behind the consumer is. Zero lag means the consumer is keeping up. Growing lag means the consumer is falling behind.

Queue lag is emitted as a metric and alerted on when it exceeds a threshold. A queue that has been growing for more than a configured duration without recovery is a signal that the consumer needs to be scaled or the producer needs to be throttled.

### 6.5 Dead Letter Queues Capture Processing Failures

An item that fails processing is not silently dropped or left in the main queue indefinitely. Failed items move to a dead letter queue — a separate queue that captures items that could not be processed. Dead letter queues are:
- Monitored and alerted on when they contain items
- Inspectable by operators — the item content and failure reason are accessible
- Retryable — operators can move items back to the main queue after investigating the failure

---

## 7. Resource Limits

### 7.1 Every Resource Has a Defined Limit

Every resource the system consumes — memory, CPU, open file descriptors, database connections, external API rate limit quota, thread pool workers — has a defined limit. The limit is not the maximum the hardware allows — it is the maximum the system is designed to consume while maintaining its stability guarantees.

Operating at the hardware maximum leaves no headroom for traffic spikes, no room for neighbor processes, and no safety margin for resource measurement imprecision. Resources are limited to a fraction of the physical maximum, with the remaining fraction as headroom.

### 7.2 Resource Limits Are Enforced, Not Just Monitored

A resource limit that is only monitored — an alert fires when the limit is exceeded, but nothing prevents the resource from continuing to grow — is not a limit. It is an alert threshold. Resource limits are enforced: when the limit is reached, the system rejects new resource acquisition requests rather than allowing the resource to grow beyond the limit.

| Resource | Enforcement Mechanism |
|---|---|
| In-memory cache | Eviction policy on maximum size |
| Database connection pool | Maximum pool size; new acquires block or fail beyond the limit |
| HTTP request body | Maximum size enforced at the middleware layer |
| Job queue depth | Maximum depth; new enqueues are rejected beyond the limit |
| Concurrent requests | Maximum concurrency enforced by the load balancer or middleware |
| Open file descriptors | OS-level ulimit; application-level pool management |

### 7.3 Resource Exhaustion Is Handled Gracefully

When a resource limit is reached — the connection pool is full, the queue is at maximum depth, the memory budget is exceeded — the system handles the condition gracefully:
- New requests that require the exhausted resource receive a `503 Service Unavailable` response (not a crash)
- The condition is immediately visible in monitoring
- An alert fires within one minute of the resource limit being reached
- The system continues to serve requests that do not require the exhausted resource

A resource exhaustion that produces a crash rather than a graceful rejection is a design defect.

### 7.4 Limits Are Configured Per Environment

Resource limits for development are not the same as for production. Development limits are relaxed — developers need flexibility for debugging and experimentation. Production limits are tighter — the system is operating against a defined SLA and must not consume more resources than its SLA allows.

Limits are configured through the environment configuration system — not hardcoded. A limit that is hardcoded cannot be adjusted without a code change and deployment.

---

## 8. Monitoring

### 8.1 Performance Metrics Are the System's Vital Signs

Performance monitoring is not optional instrumentation — it is the mechanism by which the system reports its health to operators. A system without performance metrics is a black box: problems are discovered when users report them, not when they begin. A system with comprehensive performance metrics is a glass box: problems are discovered when they are small.

### 8.2 Standard Metrics Every Component Emits

Every Service, Repository, middleware stage, and job handler emits:

| Metric | Description | Type |
|---|---|---|
| `operation.duration` | Time from operation start to completion | Histogram (p50, p95, p99) |
| `operation.error_rate` | Fraction of operations that result in an error | Rate |
| `operation.throughput` | Operations completed per second | Counter |

These three metrics — latency, error rate, throughput — are the minimum observable surface for every component.

### 8.3 System-Level Metrics

Beyond component-level metrics, the following system-level metrics are collected and alerted on:

| Metric | Alert Threshold | Description |
|---|---|---|
| Heap usage | > 80% of configured limit | Memory pressure approaching limit |
| GC pause duration | > 100ms | Garbage collection impacting latency |
| Event loop lag | > 50ms | Event loop blocked |
| CPU utilization | > 85% for > 5 minutes | Sustained high CPU |
| Active connection count | > 90% of pool size | Connection pool pressure |
| Queue depth | Component-specific | Consumer falling behind |
| Error rate | > 1% over 5-minute window | Systemic errors emerging |

### 8.4 Latency Histograms, Not Averages

Average latency is a deceptive metric. A system where 95% of requests complete in 10ms and 5% complete in 1000ms reports an average latency of approximately 60ms — a number that neither represents the typical experience nor the tail experience. Tail latency (p95, p99) is what matters for user experience and SLA compliance.

All latency metrics are histograms. Alerts are set on p95 and p99 values. Average latency is never the primary metric for any performance evaluation.

### 8.5 Dashboards Are Designed for On-Call Engineers

Performance dashboards must be interpretable by an on-call engineer at 3 AM who is seeing the dashboard for the first time during an incident. Each panel has:
- A clear title that describes what is being shown
- Labeled axes with units
- Alert threshold lines overlaid on the graph
- Color coding that makes anomalies immediately visible

A dashboard that requires documentation to interpret is a dashboard that will not be used effectively during incidents.

---

## 9. Profiling

### 9.1 Profiling Is the Only Reliable Performance Debugging Tool

Intuition about where performance problems exist is frequently wrong. Code that looks expensive may be executed rarely and contribute negligibly to overall latency. Code that looks simple may be in a critical hot path and dominate execution time. Profiling reveals the truth.

Every performance investigation begins with profiling. The profiler identifies the actual bottleneck. The optimization targets the bottleneck. Nothing is optimized without profiling evidence that it is the bottleneck.

### 9.2 Profiling Is Done in a Realistic Environment

A CPU profile taken on a developer's machine with a small dataset does not reflect production behavior. Production performance characteristics emerge from production-scale data, production-level concurrency, and production infrastructure configuration.

Profiling is performed in a staging environment configured to match production as closely as possible — or, for non-sensitive investigations, directly in production with sampling-based profilers that have low overhead.

### 9.3 Types of Profiling Used in Void

| Profile Type | Tool Class | When Used |
|---|---|---|
| CPU flame graph | Sampling CPU profiler | "What code is consuming the most CPU time?" |
| Heap allocation profile | Allocation-tracking profiler | "What is allocating the most memory?" |
| Heap snapshot | Point-in-time heap dump | "What objects are alive and why?" |
| Async trace | Async context tracker | "Where is the latency in an async call chain?" |
| Query trace | Slow query log + EXPLAIN | "Why is this database query slow?" |

### 9.4 Profiling Results Are Documented

When a profiling investigation identifies and resolves a bottleneck, the results are documented:
- What the profile showed
- What the bottleneck was
- What change was made
- What improvement was measured after the change

This documentation serves as the justification for the optimization in code review and as a reference for future investigations of similar symptoms.

### 9.5 Continuous Profiling in Production

For high-traffic production systems, continuous sampling profiling with very low overhead (< 1% CPU cost) runs in production at all times. Continuous profiling captures CPU profiles over time, enabling retrospective analysis of performance changes — including changes introduced by deployments. A deployment that introduces a new hot path is visible in the continuous profile without requiring a separate investigation.

---

## 10. Scaling

### 10.1 Horizontal Scaling Is the Primary Strategy

The primary strategy for handling increased load is horizontal scaling: adding more identical process instances behind a load balancer. Horizontal scaling is predictable, reversible, and requires no code changes. It is the first response to a capacity constraint.

Vertical scaling — adding more CPU or memory to a single instance — is a short-term measure while horizontal scaling is being arranged. It has diminishing returns and a hard ceiling.

### 10.2 Services Must Be Stateless to Scale Horizontally

A Service that stores per-session, per-user, or per-request state in its own process memory cannot be horizontally scaled without routing requests from the same session to the same instance (sticky routing). Sticky routing reduces the load-balancing effectiveness and complicates failover.

Services are designed to be stateless: all state that must persist beyond a single request is stored in shared persistent storage (database, cache). Any instance can serve any request.

### 10.3 Database Connections Are Managed for Scale

Each application instance maintains a connection pool. When N instances are running, the database receives up to N × pool_size connections. Horizontal scaling must account for the database connection budget — the maximum number of simultaneous connections the database can serve before performance degrades.

When scaling increases the total connection count toward the database limit, the connection pool size per instance is reduced proportionally, or a connection proxy (PgBouncer or equivalent) is introduced to multiplex application connections onto a smaller number of database connections.

### 10.4 Stateful Components Have Explicit Scaling Strategies

Some components are inherently stateful and cannot be scaled by simply adding instances: the Facebook Layer session state, the Scheduler's job queue. Each stateful component has a defined scaling strategy:
- **Shard by key:** Partition state by a key (account ID, session ID) and route each key to a specific instance
- **Leader election:** One instance is the active leader; others are hot standbys
- **Centralized state:** State is held in a shared external store (database, distributed cache); instances are stateless

The scaling strategy for each stateful component is documented in its architectural document.

### 10.5 Autoscaling Has Safety Bounds

Autoscaling — automatically adding instances in response to load — has defined bounds:
- **Minimum instances:** The number of instances that run at all times, regardless of load (for availability)
- **Maximum instances:** The number of instances that may run regardless of load (to prevent unbounded cost and database connection exhaustion)
- **Scale-up rate:** How quickly new instances are added (to prevent oscillation)
- **Scale-down rate:** How quickly instances are removed (to prevent premature scale-down during traffic spikes)

Autoscaling without bounds is a cost and stability risk.

---

## 11. Database Performance

### 11.1 Query Latency Budgets

Every Repository method has a latency budget — the maximum acceptable p99 execution time under the expected load. Methods on the critical request path have tight budgets; methods for background processing have relaxed budgets.

| Repository Type | p99 Budget |
|---|---|
| Primary key lookup | < 5ms |
| Indexed field lookup | < 10ms |
| Filtered collection query | < 20ms |
| Aggregation query | < 50ms |
| Complex join / reporting query | < 200ms |

Queries exceeding their budget are flagged in slow query logs, profiled with `EXPLAIN ANALYZE`, and optimized before shipping.

### 11.2 Query Plans Are Verified Before Shipping

For queries against tables with more than 10,000 rows, the query execution plan is verified before the query ships to production. A plan that shows a sequential scan instead of an index seek, or a hash join instead of an index join, indicates a missing index or a suboptimal query that must be corrected.

### 11.3 Connection Pool Utilization Is Monitored

When connection pool utilization consistently exceeds 70%, the pool is undersized for the current load. Connections above 70% utilization mean that occasional bursts will exhaust the pool entirely, causing requests to wait for a connection or fail. Pool sizing is reviewed at this threshold.

---

## 12. Network Performance

### 12.1 Payload Sizes Are Minimized

The size of data transferred over the network is a direct component of network latency. Large payloads take longer to transmit, consume more bandwidth, and require more memory to buffer. Every response payload includes only the fields the caller needs — not entire entity graphs with fields the caller will never read.

Response payload design follows the principle of minimum necessary data: if a field is not used by the known callers of this endpoint, it is not included.

### 12.2 Keep-Alive Connections Are Used

Establishing a TCP connection adds round-trip latency overhead. HTTP keep-alive (persistent connections) reuses the same TCP connection for multiple requests, eliminating the connection setup overhead from all but the first request. Keep-alive is enabled for all outbound HTTP connections to external services.

### 12.3 External Service Calls Are Timeout-Bounded

Every call to an external service — including the Facebook API — has a timeout. Without a timeout, a slow or unresponsive external service holds an application thread (or event loop callback) indefinitely. When N concurrent requests each wait indefinitely for an external service, N connections are held open, N database connections remain checked out, and the system gradually saturates.

Timeout values are set by measuring the external service's p99 response time under normal conditions and setting the timeout at 2–3x that value. Requests that exceed the timeout receive a `504 Gateway Timeout` or equivalent error — not an indefinite wait.

---

## 13. Best Practices

1. **Establish performance budgets before writing code.** A feature whose performance budget is undefined will be implemented without performance in mind and will be difficult to optimize after the fact. Define the budget first: "this operation must complete in under 50ms at p99." Then implement to meet the budget.

2. **Optimize the common case.** The 99% case that succeeds with valid inputs is more important to optimize than the 1% case that fails with invalid inputs. Error paths may be slower than happy paths — they are not on the critical performance path.

3. **Measure, change one thing, measure again.** When optimizing, change exactly one thing at a time. Changing multiple things simultaneously makes it impossible to attribute the improvement to a specific change. The optimization is evidence-based, and each change is separately documented.

4. **Document why the optimization is safe.** An optimization that relies on a specific assumption — "this list is always small enough to sort in memory" — must document that assumption. When the assumption is later violated, the documentation makes the optimization's fragility visible.

5. **Prefer algorithmic improvements over micro-optimizations.** An algorithm change from O(N²) to O(N log N) provides a benefit that grows with scale. A micro-optimization that avoids a function call overhead provides a fixed benefit that does not scale. Algorithmic improvements are always preferred when both are available.

6. **Keep hot paths observable.** Every hot code path emits latency metrics. When a hot path becomes slow, the metric shows it before users report it. A hot path with no metrics can only be discovered to be slow through user complaints — the worst way to discover it.

7. **Never prematurely remove safety mechanisms for performance.** Input validation, retry logic, circuit breakers, and timeouts exist because they were needed. Removing them for performance without understanding why they were added risks reintroducing the failure mode they were protecting against.

---

## 14. Anti-Patterns

### 14.1 Premature Optimization

Writing complex, optimized code for a path that has not been measured to be a bottleneck. Premature optimization adds complexity, reduces readability, and increases the risk of bugs — for a performance benefit that may not exist or may not matter. Measure first. Optimize the actual bottleneck.

### 14.2 The N+1 Everywhere

Loading a collection of entities and then issuing one query per entity to load related data. This pattern is common and consistently produces the worst per-record database performance. Every collection-loading code path is reviewed for N+1 patterns before shipping.

### 14.3 Unbounded Parallelism

Initiating an unlimited number of concurrent async operations — `Promise.all(items.map(item => processItem(item)))` where `items` has thousands of entries — overwhelms databases, saturates network connections, and exhausts connection pools. All parallel operations are concurrency-limited.

### 14.4 The Synchronous Blocking Hot Path

A synchronous, CPU-intensive operation in a hot code path that blocks the event loop. File parsing, JSON serialization of large objects, complex sorting — executed synchronously in a handler called on every request. These operations are moved off the event loop or their inputs are bounded.

### 14.5 The Memory Growth That Is Not a Leak

An in-memory data structure — a Map, an array, a Set — that grows with system usage (more users, more sessions, more messages) without a bound or an eviction mechanism. Not technically a traditional memory leak (the references are held intentionally), but functionally equivalent: heap usage grows monotonically and will eventually exhaust memory. Every growing data structure has a maximum size with eviction.

### 14.6 The Optimization That Removes Safety

Removing input validation, disabling retry logic, bypassing circuit breakers, or setting timeouts to infinity — on the grounds that these checks add latency. Safety mechanisms add latency. That latency is the cost of the safety they provide. Removing safety for performance is a forbidden trade-off (see Section 2).

---

## 15. Forbidden Performance Practices

### 15.1 Disabling Tests to Meet Performance Goals

A performance optimization that requires disabling or narrowing tests to pass is not a valid optimization. The test failures are revealing a correctness problem with the optimization. Tests are fixed — not disabled.

### 15.2 Hardcoded Resource Limits

Resource limits (connection pool sizes, queue maximum depths, cache sizes, concurrency limits) that are hardcoded as numeric literals in business logic code. Resource limits must be configurable through the environment configuration system so they can be adjusted without code changes.

### 15.3 Performance Optimization Without Measurement

Making code changes motivated by "this seems faster" or "this is a well-known optimization" without before-and-after measurements. The before-and-after measurement is mandatory. Optimization without measurement is speculation.

### 15.4 Shared Mutable State for Performance

Using a shared global variable or module-level mutable object to avoid the overhead of passing data through function arguments or through dependency injection — on the grounds that it is "faster." Shared mutable state produces race conditions in concurrent environments and makes the code untestable. The performance benefit is negligible; the stability cost is significant.

### 15.5 Removing Timeouts from External Calls

Removing or setting to infinity the timeout on any call to an external service, database, or remote system — on the grounds that the external service is "reliable enough" and the timeout "causes false failures." No external service is reliable enough to justify removing its timeout. Timeouts are a correctness property, not an optional performance tuning knob.

---

## 16. AI Performance Rules

This section defines how an AI system must reason about performance when developing within Void.

### 16.1 The AI Must Not Optimize Without a Measurement

When the AI is asked to optimize code, it must first identify the measurement that demonstrates the performance problem. If no measurement is provided, the AI must request one — or instrument the code to produce the measurement — before suggesting an optimization. The AI must not suggest optimizations speculatively.

### 16.2 The AI Must Not Sacrifice Stability for Performance

When the AI generates a performance optimization, it must verify that the optimization does not:
- Remove or weaken input validation
- Remove or shorten retry logic
- Remove or weaken error handling
- Remove timeouts from external calls
- Introduce shared mutable state
- Bypass the Repository layer for direct database access

If the proposed optimization requires any of these changes, the AI must propose an alternative approach.

### 16.3 The AI Must Identify N+1 Patterns

When the AI generates or reviews code that loads collections of entities and then accesses related data, it must identify N+1 patterns. The AI must not generate code that loads N entities in a loop with one query per entity when the data can be loaded in a single batch query.

### 16.4 The AI Must Apply Concurrency Limits to Parallel Operations

When the AI generates code that parallelizes operations — `Promise.all`, concurrent job processing, parallel Service calls — it must apply a concurrency limit appropriate to the dependency being called. The AI must not generate unbounded `Promise.all` over arrays of unknown size.

### 16.5 The AI Must Set Memory Budgets for In-Process Structures

When the AI generates a component that maintains an in-memory data structure that grows over time — a Map, a cache, a queue — it must specify a maximum size and an eviction or overflow policy. The AI must not generate unbounded in-memory structures.

### 16.6 The AI Must Emit Performance Metrics in Hot Paths

When the AI generates code for a hot path — a Service method called on every request, a middleware stage, a Repository method — it must include latency metric emission. The hot path must be observable.

### 16.7 The AI Must Identify Synchronous Blocking Operations

When the AI generates synchronous operations in event-loop code, it must identify whether the operation is CPU-intensive or I/O-blocking. CPU-intensive synchronous operations in hot paths must be moved to worker threads or redesigned. I/O operations must be asynchronous.

### 16.8 The AI Must Verify Correctness Before Performance

When the AI makes a performance optimization, it must run the test suite against the optimized code (or verify that all tests pass) before delivering the optimization. An optimization that passes some tests but fails others is a correctness defect — not a performance improvement.

### 16.9 The AI Must Document Optimization Assumptions

When the AI generates an optimization that relies on an assumption — "this list will always be small," "this operation will always complete in under 1ms," "this value will never be null in practice" — it must document the assumption inline with a comment. An optimization whose assumption is not documented will be violated silently in a future change.

### 16.10 The AI Must Propose Load-Shedding Over Unlimited Scaling

When the AI is asked to handle increased load and presents options, it must include load-shedding (graceful rejection of excess requests) as an option alongside scaling. A system that can reject excess load gracefully is more stable under unexpected traffic spikes than one that accepts all requests until it fails.

---

## 17. Performance Review Checklist

Use this checklist for every code review that introduces performance-sensitive code or claims to improve performance.

### Stability First
- [ ] No safety mechanisms have been removed or weakened (validation, retry logic, timeouts, error handling)
- [ ] The optimization does not introduce shared mutable state
- [ ] The optimization does not bypass the Repository layer for direct database access
- [ ] The full test suite passes after the optimization is applied
- [ ] The optimization degrades gracefully under overload — does not crash or corrupt state

### Memory
- [ ] No new unbounded in-memory data structures have been introduced
- [ ] New in-memory structures have defined maximum sizes and eviction/overflow policies
- [ ] Large allocations are pooled or streamed — not loaded entirely into memory
- [ ] No new memory leaks are introduced (verified through heap profiling or code review)

### CPU
- [ ] Hot-path code has no synchronous CPU-intensive operations that block the event loop
- [ ] Repeated computation in hot paths is cached
- [ ] Hot-path algorithm complexity is O(N) or better
- [ ] Regular expressions used in hot paths are precompiled at initialization

### Async
- [ ] Independent async operations are parallelized where appropriate
- [ ] Parallelized operations have a concurrency limit
- [ ] All Promises have rejection handlers
- [ ] Long async loops yield periodically to allow I/O processing

### Queue
- [ ] Queues have defined maximum depths with overflow policies
- [ ] Queue consumer lag is monitored and alerted on
- [ ] Batch processing is used where appropriate to reduce per-item overhead
- [ ] Dead letter queues are configured and monitored

### Resource Limits
- [ ] Resource limits are configurable through configuration — not hardcoded
- [ ] Resource exhaustion produces graceful rejection — not crashes
- [ ] Connection pool sizing accounts for horizontal scaling multiplier
- [ ] External call timeouts are set for all new dependencies

### Monitoring
- [ ] New hot paths emit latency histograms (p50, p95, p99)
- [ ] New hot paths emit error rate and throughput metrics
- [ ] Alert thresholds are defined for new metrics
- [ ] Dashboard panels are updated to include new components

### Evidence
- [ ] Before-and-after measurements are included in the PR description
- [ ] The measurement environment is documented (load, dataset size, concurrency)
- [ ] The optimization assumption is documented inline in the code
- [ ] The optimization is explained in a comment for future maintainers

---

*This document is the official and sole reference for performance engineering in Void. Performance does not come at the cost of stability. An optimization that produces faster code with less reliable behavior is not an optimization — it is a regression measured on the wrong axis. Every performance decision is measured, every bottleneck is identified before it is addressed, every optimization preserves the test suite, and every component's performance is observable at runtime.*
