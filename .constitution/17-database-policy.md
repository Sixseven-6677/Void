# 17 — Database Policy

> **Status:** Official  
> **Scope:** All database access decisions in Void — repository design, query rules, entity design, migrations, transactions, integrity constraints, indexing, performance, and the access boundary that isolates the database from all non-Database layers  
> **Authority:** This document is the single source of truth for everything related to persistent data storage in Void. No database schema, query, migration, or access pattern may be introduced without compliance with this policy. Direct database access from any layer other than the Database layer is categorically forbidden. All access to stored data flows through Repositories.

---

## Table of Contents

1. [Database Philosophy](#1-database-philosophy)
2. [The Access Boundary](#2-the-access-boundary)
3. [Repository Pattern](#3-repository-pattern)
4. [Entity Design](#4-entity-design)
5. [Model Rules](#5-model-rules)
6. [Query Rules](#6-query-rules)
7. [Transactions](#7-transactions)
8. [Data Integrity](#8-data-integrity)
9. [Indexing](#9-indexing)
10. [Migration Strategy](#10-migration-strategy)
11. [Backup Strategy](#11-backup-strategy)
12. [Performance](#12-performance)
13. [Error Handling](#13-error-handling)
14. [Best Practices](#14-best-practices)
15. [Anti-Patterns](#15-anti-patterns)
16. [Forbidden Database Practices](#16-forbidden-database-practices)
17. [AI Database Rules](#17-ai-database-rules)
18. [Review Checklist](#18-review-checklist)

---

## 1. Database Philosophy

### 1.1 The Database Is the System of Record

The database is the ultimate authority on the state of every domain entity in Void. What the database contains is what the system knows to be true. Every other representation of data — in-memory caches, computed values, event histories — is derived from the database. When representations conflict, the database wins.

This authority comes with responsibility. The database must be designed to maintain the integrity of the data it holds. Constraints, foreign keys, unique indices, and not-null requirements are not optional quality-of-life features — they are the enforcement mechanisms that make the database's authority meaningful.

### 1.2 The Database Knows Nothing About the Application

The database does not know about Services, Commands, Plugins, or Managers. It does not know what features the application provides or what business rules the application enforces. It stores data in tables according to a schema and responds to queries. The application's domain logic is applied above the database — not inside it.

This means: no stored procedures implementing business rules, no triggers that apply business logic, no database functions that enforce application-layer constraints. The database enforces structural constraints (types, nullability, uniqueness, foreign keys). The application enforces business constraints (Services).

### 1.3 Data Outlives Code

The data in the database has a lifetime that typically exceeds the lifetime of any particular version of the application code that produced it. A record created by version 1.0 of the application will still be in the database when version 5.0 is running. Database design must account for this longevity — schemas must be designed for forward compatibility, migrations must be non-destructive, and data must be written in a way that future application versions can read correctly.

### 1.4 Simplicity Is a Correctness Property

Complex schemas — deeply nested relationships, polymorphic associations, overloaded columns — are not just harder to understand. They are harder to query correctly, harder to migrate safely, and harder to keep consistent. A simpler schema that clearly represents the domain is more correct than a clever schema that saves a few tables at the cost of comprehensibility.

---

## 2. The Access Boundary

### 2.1 The Database Layer Is a Walled Perimeter

The Database layer — Repositories and their direct dependencies — is the only part of the system that may issue database queries. This is the most foundational structural rule in this document. It is not a suggestion, a preference, or a guideline. It is an inviolable boundary.

No Service may issue a database query. No Manager may issue a database query. No Command may issue a database query. No Plugin may issue a database query. No event handler may issue a database query. No Controller may issue a database query. If data is needed, the component that needs it calls a Repository. The Repository issues the query.

### 2.2 Why the Boundary Exists

Without this boundary:
- Query logic is scattered across the codebase, making it impossible to audit, optimize, or change consistently
- The same data is fetched multiple times by different components with different queries, producing inconsistency
- Caching cannot be applied coherently — there is no single place to cache a query's results
- Testing requires a real database at every layer — nothing can be isolated
- Schema changes break unknown code paths that are invisible until runtime

With this boundary:
- All data access is visible by reading Repositories
- Query optimization is localized to Repositories
- Caching is applied in Repositories or in the Services that call them
- Testing replaces Repositories with fakes, isolating all other layers from the database
- Schema changes require updating only Repositories

### 2.3 The Repository Is the Boundary Enforcement Mechanism

A Repository is the implementation of the access boundary. It exposes methods — `findById`, `findByAccountId`, `save`, `delete`, `findAllWhere` — that the rest of the system calls. Behind these methods, the Repository issues the actual queries. The rest of the system never sees the queries.

### 2.4 The Database Client Is Not Injected Elsewhere

The database client (connection pool, ORM instance, query builder) is a dependency of Repositories only. It is never injected into Services, Managers, Commands, or any other component. A component that receives the database client as a dependency can issue arbitrary queries — which violates the boundary. The database client's injection is limited to the Repository layer.

---

## 3. Repository Pattern

### 3.1 One Repository Per Aggregate Root

Every domain aggregate root — the entity that owns and defines a consistency boundary — has exactly one Repository. The Repository for `Account` manages `Account` records. The Repository for `Message` manages `Message` records. Sub-entities that are owned by an aggregate root (and cannot exist without it) are persisted through the root's Repository — not through their own.

### 3.2 Repository Interface Is Domain-Oriented

A Repository's methods are named in terms of the domain, not in terms of the database operations they perform. `findActiveSessionsForAccount` is a domain-oriented method. `selectFromSessionsWhereAccountIdEqualsAndStatusEquals` is not. The caller should not need to know what query is executed — they should only know what data they will receive.

### 3.3 Repositories Return Domain Objects

Repositories return domain entities and value objects — not raw database rows, not record maps, not database-layer structures. The Repository is responsible for the mapping from database representation to domain representation. The caller receives domain objects that encapsulate their invariants. The database schema does not leak through the Repository interface.

### 3.4 Repositories Do Not Contain Business Logic

A Repository finds, saves, updates, and deletes data. It does not make decisions about whether an operation is valid, it does not enforce business rules, and it does not apply domain logic to the data it retrieves. A Repository method that conditionally constructs a query based on business rules has absorbed logic that belongs in the Service that calls it.

The one permitted form of query logic is purely structural — constructing a query from the method's parameters without applying domain judgment. `findByStatus(status: AccountStatus)` constructs a query using the provided status — this is parameter substitution, not business logic.

### 3.5 Repository Methods Are Narrow and Specific

A Repository should not expose a generic `query(sql: string)` method that accepts arbitrary SQL. Each Repository method corresponds to a specific, named query that satisfies a specific, documented need. When a new query need arises, a new method is added with a name that documents the query's intent.

Generic query methods expose the database schema to callers and allow arbitrary, untested queries to reach production.

### 3.6 Repositories Are Injected into Services

Services receive Repositories through their constructor (dependency injection). The Service calls the Repository's methods. The Repository executes queries. This relationship is 1:N — one Service may depend on multiple Repositories if its operations span multiple aggregate roots.

---

## 4. Entity Design

### 4.1 Entities Represent Domain Concepts Directly

Database entities (tables) represent domain concepts — not technical constructs, not join tables for their own sake, not implementation details. Before creating a table, the question must be answered: what domain concept does this table represent? If the answer is "a join between these two other tables," the design must be reconsidered — most many-to-many relationships can be modeled as an association entity with its own domain meaning.

### 4.2 Each Entity Has a Stable Primary Key

Every table has a primary key. The primary key is:
- A surrogate key — generated by the system, not derived from the entity's attributes
- Immutable — the primary key of a record never changes after creation
- Unique — within the table and globally, if global uniqueness is needed (UUIDs)

Natural keys (phone numbers, usernames, account identifiers) may serve as unique constraints — but not as primary keys. Natural attributes change. Primary keys must not.

### 4.3 Entities Have Audit Columns

Every entity table includes:
- `created_at` — the timestamp when the record was first created, set at insert and never modified
- `updated_at` — the timestamp of the most recent modification, updated on every write

These columns are mandatory. They are set by the database layer — never by the application manually, never by clients, never by tests (except for specific time-sensitive test scenarios).

### 4.4 Entities Model Facts, Not Computations

A column in an entity table represents a fact about the entity — data that is observed and stored. It does not represent a computation that could be derived from other columns. Derived values are computed at query time, not stored. Storing computed values produces inconsistency when the source data changes but the computed column is not updated.

Exceptions: computed columns with deterministic results that are prohibitively expensive to compute at every query — these may be materialized with documented invalidation rules.

### 4.5 Nullable Columns Are Justified

A nullable column — a column that may contain `NULL` — represents a fact that may or may not be known. The nullability of a column must be justified by the domain: is there a legitimate state in which this attribute is unknown or not applicable? If the answer is no, the column must be not-null. Nullable columns that are never actually null in practice are schema imprecision — they propagate null-checking through query logic unnecessarily.

### 4.6 Soft Delete Is a Deliberate Choice

Soft deletion — marking records as deleted without physically removing them — must be a deliberate, documented decision. Soft deletion has costs: queries must filter out deleted records everywhere, unique constraints must account for deleted records, and storage grows without bound. Soft deletion is justified when:
- The deleted record's data must be auditable
- The record may be restored
- Foreign key integrity requires the record to remain

When soft deletion is used, the mechanism is standardized: a `deleted_at` nullable timestamp column. A record with a non-null `deleted_at` is considered deleted. All Repository query methods for soft-deleted entities must filter on `deleted_at IS NULL` by default.

---

## 5. Model Rules

### 5.1 Models Are the Schema's TypeScript Representation

A model is the TypeScript representation of a database entity — a type that corresponds to the columns of a table. Models are generated from or explicitly kept in sync with the schema definition. They are the boundary between the database layer and the domain layer.

### 5.2 Models Do Not Contain Business Logic

A model is a data container. It declares the shape of the data — field names and types — and nothing else. Validation, transformation, and business decisions are not placed on model classes. A model with methods that apply business rules has absorbed Service responsibility.

### 5.3 Domain Objects Are Distinct From Models

A domain object (an aggregate, an entity, a value object in domain terms) is distinct from the database model. The Repository maps from the model (database shape) to the domain object (domain shape) on read, and from the domain object back to the model on write. These shapes may differ — a domain object may combine data from multiple tables, may include computed properties, or may use different naming conventions.

A domain object must not be stored directly to the database as-if it were a model. The mapping step is not optional.

### 5.4 Models Are Never Returned to Callers Above the Repository

A model is an implementation detail of the Repository. Services receive domain objects — not models. An API response that serializes a raw model exposes the database schema to the outside world. Changes to the schema then break the API contract. Models stay inside the Repository layer.

### 5.5 Model Versioning

When the schema changes, the model must change in sync. A model that does not reflect the current schema produces incorrect queries and incorrect data. The migration that changes the schema and the model update that reflects that change are a single atomic commit — they are never separated.

---

## 6. Query Rules

### 6.1 Queries Are Written at the Repository Level

All queries — whether using a query builder, an ORM, or raw SQL — are written within Repository methods. No query construction occurs outside the Repository layer.

### 6.2 Parameterized Queries Only

Every query that incorporates caller-provided values must use parameterized queries (prepared statements, bound parameters) — not string interpolation or concatenation. Concatenating caller-provided values into a query string is a SQL injection vulnerability with no acceptable justification.

### 6.3 Select Only What Is Needed

A query must select only the columns it needs — not `SELECT *`. Selecting all columns:
- Loads data that the caller will not use — wasting memory and network bandwidth
- Breaks when a column is renamed — the alias breaks existing code
- Produces models with phantom fields that vary across query contexts

Every Repository method selects a defined, explicit set of columns appropriate to its return type.

### 6.4 Never Load to Filter in Memory

A Repository method must never load all records and then filter them in application memory. If the filter can be expressed in a `WHERE` clause — and for relational data it almost always can — it must be expressed there. Loading entire tables to filter in memory is a performance and correctness failure.

### 6.5 Queries Are Deterministic

Every query that returns an ordered set of results must specify an explicit `ORDER BY`. A query without `ORDER BY` returns results in an undefined order that varies between database engines, between configurations, and between queries against the same table. Tests that depend on unspecified query order will fail intermittently in ways that are difficult to diagnose.

### 6.6 Batch Queries Over N+1

When a Repository method needs to load related records for a collection of entities, it must load them in a single batch query — not one query per entity. Batch queries use `IN (...)` clauses, joins, or equivalent mechanisms to retrieve all related records in one round trip. N+1 query patterns are performance defects.

### 6.7 Raw SQL Has a High Bar

Raw SQL — as opposed to ORM or query builder abstractions — is permitted when:
- The query cannot be expressed correctly through the available abstraction
- The abstraction generates incorrect or significantly less efficient SQL for this case
- The team has validated the query and documented why the abstraction was insufficient

Raw SQL must be documented with the reason, parameterized for all variable inputs, and reviewed for correctness and injection safety.

---

## 7. Transactions

### 7.1 Transactions Are Defined by Services

Per `15-service-rules.md`, transaction boundaries are defined in Services — not in Repositories and not in any layer above Services. When a Service operation requires multiple writes to succeed or fail as a unit, the Service defines the transaction and passes it to the Repositories it calls within that boundary.

### 7.2 Repositories Participate in Transactions

A Repository method that is called within a Service transaction must use the provided transaction context. A Repository method called without a transaction context executes in auto-commit mode — each write is committed immediately. Repository methods must support both modes — with and without an external transaction — without requiring the caller to know which mode is active.

### 7.3 Transactions Are Short

A transaction must encompass only the database operations that require atomicity. It must not hold its lock for:
- External API calls (network round trips that may take seconds)
- Complex computations that do not touch the database
- Operations that could be performed before or after the transaction

A transaction that spans an external API call holds its database locks for the duration of the network call. Other operations waiting on those rows are blocked for the network call's duration. This produces contention that worsens under load.

### 7.4 Read-Heavy Operations Do Not Require Transactions

A read operation that does not write does not need a transaction. The exception is a read that must see a consistent snapshot — for example, reading two related records that must reflect the same point in time. In these cases, a read transaction is justified and documented.

### 7.5 Transaction Failures Are Not Silently Swallowed

When a transaction fails to commit — due to a constraint violation, a deadlock, or an infrastructure error — the failure must be propagated to the Service that defined the transaction boundary. The Service handles the failure according to its error handling rules. A Repository that swallows a transaction failure and returns success to the caller leaves the Service in a state where it believes the operation succeeded when it did not.

### 7.6 Nested Transactions Are Forbidden

Nested transactions — a transaction started within an already-open transaction — produce undefined behavior in most databases. Either the inner transaction commits independently (violating the outer transaction's atomicity) or it is silently absorbed into the outer one (misleading the programmer who started it). Repository methods must detect that they are being called within a transaction and participate in it rather than starting a new one.

---

## 8. Data Integrity

### 8.1 Integrity Is Enforced at the Database Level

Data integrity constraints — not-null, unique, foreign key, check constraints — are enforced at the database level. Application-level validation is a complement to database-level constraints, not a replacement. An application-level check that is not backed by a database constraint provides no protection when data is written outside the application (direct database access during maintenance, data migration scripts, future application versions that forget the check).

### 8.2 Foreign Keys Are Used for All Relationships

Every relationship between tables — every column that stores the primary key of another table — must be declared as a foreign key with an explicit referential action (CASCADE, RESTRICT, SET NULL). Columns that store identifiers of other records without a foreign key constraint produce orphaned records — records that reference entities that no longer exist — which corrupt the domain model.

### 8.3 Unique Constraints Enforce Business Uniqueness Rules

When a business rule states that a combination of attributes must be unique — a phone number must be unique per application, an account must have at most one active session — the constraint is enforced with a unique index or constraint on the relevant columns. Application-level uniqueness checks without database constraints have race conditions: two requests may both pass the check simultaneously before either has committed.

### 8.4 Check Constraints Enforce Column-Level Rules

When a column's value must satisfy a rule that can be expressed as a predicate on that column's value — a status column may only contain specific values, a count column may not be negative — the rule is enforced with a check constraint. Check constraints are more reliable than application-level validation for column-level rules because they cannot be bypassed.

### 8.5 Cascading Deletes Are Documented and Justified

A CASCADE delete rule — where deleting a parent record automatically deletes child records — is a permanent, irreversible action. Every cascade relationship must be explicitly documented:
- What records are deleted
- Under what conditions
- Whether this is the correct behavior or whether RESTRICT (preventing deletion of the parent when children exist) is more appropriate

An undocumented cascade is a data loss risk.

---

## 9. Indexing

### 9.1 Indexes Are Added Deliberately

Every index must be justified by a documented query that uses it. Creating an index without identifying the query that will use it is speculative and produces index maintenance overhead with no corresponding query benefit. Before adding an index, the query must be identified, the access pattern must be understood, and the index design must be chosen to match the access pattern.

### 9.2 Primary Key Indexes Are Automatic

Every table's primary key is automatically indexed by the database. No additional primary key index is created manually.

### 9.3 Foreign Key Columns Are Indexed

Every foreign key column must have an index. Foreign key columns are used in join conditions — the most common source of sequential scans in relational databases. A foreign key without an index produces full table scans when joining or when cascading deletes are evaluated.

### 9.4 Composite Index Column Order Matters

When an index covers multiple columns, the column order determines which queries the index can serve. The leftmost column(s) in the index are the ones used for range scans and equality filters. Composite index design must match the actual query patterns — the columns filtered most selectively and most frequently go first.

### 9.5 Index Bloat Is Monitored

Indexes grow with the tables they index. Indexes on tables with high write volume suffer from fragmentation over time, consuming storage and slowing writes. Index usage and size are monitored. Indexes that are never used are candidates for removal — they impose write overhead for zero query benefit.

### 9.6 Partial Indexes for Sparse Conditions

When a query filters on a condition that applies to a small fraction of rows — active records among many inactive ones, unprocessed records in a mostly-processed queue — a partial index (an index that includes only the rows matching the condition) is smaller, faster, and more targeted than a full-table index.

---

## 10. Migration Strategy

### 10.1 Migrations Are the Only Schema Change Mechanism

Every change to the database schema — adding a table, adding a column, adding an index, modifying a constraint, dropping anything — is performed through a migration. Direct schema modifications applied outside the migration system are forbidden. A schema that was changed outside the migration system cannot be reliably reproduced, cannot be rolled back, and cannot be applied consistently across development, staging, and production environments.

### 10.2 Migrations Are Irreversible in Production

Once a migration has been applied in production, it cannot be rolled back by reversing the migration. The only way to undo a production migration is to apply a new forward migration that reverses the change. Migration files are immutable once merged — they are historical records of how the schema evolved.

### 10.3 Migrations Are Non-Destructive

A migration must not destroy or corrupt existing data. Operations that are destructive by nature — dropping a column, dropping a table, changing a column's type — require a multi-phase approach:

**Phase 1 — Expand:** Add the new structure (new column, new table) without removing the old. Deploy the application version that writes to both old and new.

**Phase 2 — Migrate:** Backfill existing data into the new structure.

**Phase 3 — Contract:** Remove the old structure once all data has been migrated and no application code references it.

This expand-and-contract pattern ensures that a running application is never dependent on schema elements that a concurrent migration has removed.

### 10.4 Migrations Must Be Tested on Representative Data

A migration that runs correctly on an empty database or a small development dataset may fail or take prohibitive time on a production dataset with millions of rows. Before applying a migration to production:
- Test the migration on a database restored from a recent production backup
- Measure the migration's runtime against a production-scale dataset
- Verify that the migration does not lock tables for unacceptable durations

### 10.5 Zero-Downtime Migrations Are the Default

Migrations must be designed to apply without taking the application offline. Migrations that lock tables for extended periods, that block reads and writes, or that require application downtime must be redesigned or applied during explicitly planned maintenance windows. The default is that schema changes happen without users noticing.

### 10.6 Migrations Are Reviewed Separately

Schema migration files are code-reviewed with the same rigor as application code. Reviewers specifically verify:
- No data loss or data corruption in any reachable code path
- No table locks that block production operations
- Correct constraint definitions
- Presence of matching rollback strategy documentation

---

## 11. Backup Strategy

### 11.1 Backups Are Automated and Continuous

Backups of the production database are automated — they are not performed manually on demand. Automated backups run on a defined schedule and produce timestamped snapshots that are stored in a location independent of the database server itself.

### 11.2 Point-in-Time Recovery Is Enabled

In addition to full snapshots, write-ahead log (WAL) archiving — or its equivalent in the deployment platform — is enabled. Point-in-time recovery (PITR) allows the database to be restored to any point within the retention window — not just to the last full backup. PITR is essential for recovering from data corruption that was introduced gradually and not immediately detected.

### 11.3 Backup Retention Policy

Backup retention periods are defined per environment:

| Environment | Full Snapshot Frequency | Retention Period |
|---|---|---|
| Production | Daily minimum | 30 days minimum |
| Staging | Weekly | 7 days |
| Development | On-demand | Not retained |

Retention periods are not shortened to save storage costs without explicit sign-off documenting the accepted risk.

### 11.4 Backups Are Verified Regularly

A backup that has never been successfully restored is not a backup — it is an untested assumption. Backups are restored to a verification environment on a defined schedule and verified to be complete and consistent. Restore procedures are documented and tested.

### 11.5 Backup Access Is Restricted

Backup files contain the complete database contents — including all personal data, credentials, and sensitive information. Access to backup files is restricted to the minimum set of personnel required for backup verification and disaster recovery. Backup files are encrypted at rest.

---

## 12. Performance

### 12.1 Query Performance Is a Correctness Requirement

A query that is functionally correct but takes thirty seconds to execute in production is not acceptable. Query performance requirements are defined alongside functional requirements. A Repository method that cannot satisfy its performance budget is an incomplete implementation.

### 12.2 Query Plans Are Validated Before Production

For queries that run against large tables or execute on critical paths, the query execution plan is inspected before the query reaches production. A query plan that shows a sequential scan on a large table, a hash join where an index lookup was expected, or a sort operation that spills to disk is a query that must be optimized before deployment.

### 12.3 Connection Pooling Is Mandatory

The application must use a connection pool — a pre-allocated set of database connections that are reused across requests. Creating and destroying a database connection per request is prohibitively expensive. The pool size is configured to match the database server's maximum connection capacity and the application's concurrency requirements.

### 12.4 Slow Query Logging Is Enabled

In all production and staging environments, database-level slow query logging is enabled with a threshold that captures queries that exceed the performance budget. Slow query logs are reviewed regularly and new slow queries are treated as bugs to be fixed — not as acceptable performance characteristics.

### 12.5 Long-Running Queries Are Timeout-Bounded

Every database query issued by a Repository has a timeout. A query that takes longer than its timeout is canceled and returns an error to the Repository, which returns an error to the caller. Queries without timeouts can run indefinitely, holding connection pool slots and blocking other requests.

### 12.6 Read Replicas for Read-Heavy Operations

When read traffic is significantly higher than write traffic, read operations may be directed to read replicas. Repositories that use read replicas must document which methods use the replica and must handle the replication lag — the replica may not reflect writes that were committed moments ago.

---

## 13. Error Handling

### 13.1 Database Errors Are Classified Before Propagation

A raw database error — a driver-level exception with a database-specific error code — is never returned to the Service layer as-is. The Repository catches the raw error, classifies it into a domain-meaningful error category, and returns the classified error. Services handle Repository errors by their domain category — not by inspecting database error codes.

### 13.2 Error Classification Table

| Database Condition | Repository Error Category |
|---|---|
| Unique constraint violation | `conflict` — the data already exists |
| Foreign key violation | `integrity_error` — the referenced entity does not exist |
| Not-null violation | `integrity_error` — required data was missing |
| Record not found | `not_found` — the requested entity does not exist |
| Deadlock detected | `transient_failure` — retry is appropriate |
| Connection pool exhausted | `unavailable` — retry with backoff |
| Query timeout | `timeout` — retry or fail |
| Check constraint violation | `validation_error` — data violated a structural rule |
| Disk full / storage failure | `infrastructure_error` — alert required |

### 13.3 Not-Found Is a Typed Result

When a query for a specific entity (by primary key, by unique attribute) finds no record, the Repository returns a typed `not_found` result — not `null`, not `undefined`, not an empty array. A typed result forces the caller to handle the not-found case explicitly. Returning `null` allows callers to forget to check and dereference `null` at a later point.

### 13.4 Transient Failures Support Retry

Database errors that are transient — deadlocks, connection timeouts, brief unavailability — are classified with a `retryable` flag. Callers that receive a retryable error may retry the operation after an appropriate backoff interval. Non-transient errors (integrity violations, record not found) must not be retried — they will fail the same way every time.

### 13.5 Error Context Is Preserved

When a Repository encounters an error, the error it returns includes:
- The Repository method that encountered the error
- The parameters that were passed to the method (excluding sensitive data)
- The classified error category
- The underlying error detail (for internal logging — not for callers above the Service layer)

---

## 14. Best Practices

1. **Design schemas for the queries that will be run, not for theoretical normalization purity.** A perfectly normalized schema that requires eight joins to answer a common query is not a practical schema. Balance normalization against query complexity and access pattern reality.

2. **Prefer explicit column definitions to schema inference.** Auto-detected column types based on TypeScript types can be incorrect or inconsistent across database versions. Define column types explicitly in the schema definition.

3. **Name tables in the plural form and use snake_case.** `accounts`, `message_deliveries`, `session_tokens` — consistent naming makes queries readable and avoids case-sensitivity issues across database configurations.

4. **Never reuse column names for different purposes across versions.** A column that stored phone numbers in version 1 and is repurposed to store email addresses in version 3 will contain mixed data that corrupts queries reading historical records. Add a new column; do not repurpose existing ones.

5. **Document the schema.** Every table and every non-obvious column has a comment in the schema definition explaining what it represents. The schema definition is the ground truth — comments in the schema are always in sync because they live in the same file.

6. **Test migrations on data, not just structure.** A migration that adds a column and sets a default value must be tested to verify that the default is correctly applied to all existing rows, not just to new rows going forward.

7. **Keep migrations small.** A migration that makes one change is easier to review, easier to roll back, and easier to diagnose when something goes wrong. Migrations that make twenty changes simultaneously are hard to debug when one of the twenty changes is the source of a problem.

8. **Monitor replication lag in read-replica setups.** Read replicas can fall behind the primary. A Service that writes a record and immediately reads it from a replica may read stale data. Critical read-after-write paths must use the primary.

---

## 15. Anti-Patterns

### 15.1 The Repository That Leaks SQL

A Repository whose methods expose SQL fragments, table names, or column names in their public interface — either through their return types or through the arguments they accept. The Repository's interface is domain-oriented; SQL is an implementation detail. A Repository that leaks SQL creates coupling between its callers and the database schema.

### 15.2 The Fat Repository

A Repository that contains business logic — conditionally constructing queries based on business rules, applying domain transformations to query results, enforcing domain constraints. Repositories find, save, update, and delete. Domain logic belongs in Services.

### 15.3 The Polymorphic Column

A single column used to store values of fundamentally different types depending on another column's value — a `payload` column that stores JSON of different shapes depending on the `type` column. This produces a schema that cannot be validated, cannot be indexed effectively, and cannot be queried by specific field without parsing the entire payload.

### 15.4 The Audit-By-Update

A system where the history of an entity's state is tracked by overwriting the entity's current row — discarding the previous state — rather than by an immutable append-only audit log. When the previous state is needed for debugging, auditing, or recovery, it no longer exists. Historical state that must be preserved uses an audit table pattern.

### 15.5 The Unbounded Collection Column

A column that stores an array, a JSON list, or a delimited string of an unbounded number of values. When the collection grows, the column's performance degrades, the row size increases, and queries against the collection's contents require full-row loading and application-level parsing. Collections that grow over time belong in separate tables with a foreign key relationship.

### 15.6 The Schema-Free Table

A table with a single `data` column containing a serialized blob — JSON, XML, MessagePack — that contains all of the entity's actual fields. This produces a schema that the database cannot enforce, cannot index on field values, and cannot query efficiently. Schemaless data in a relational database has all the costs of a relational database with none of the benefits.

---

## 16. Forbidden Database Practices

### 16.1 Direct Database Access from Any Non-Repository Layer

No layer other than the Repository layer may issue a database query. This includes Services, Managers, Commands, Plugins, event handlers, API controllers, and any utility function that is called from these layers. Direct database access outside Repositories is the most fundamental violation of this policy.

### 16.2 Shared Mutable Database Connections

A database connection may not be stored in a module-level variable and accessed directly by multiple components. All database access is through the connection pool managed by the database layer. Module-level connection sharing bypasses pooling, creates concurrency hazards, and violates the access boundary.

### 16.3 Schema Changes Outside the Migration System

Creating tables, adding columns, or modifying constraints directly against the database — through a database administration tool, a one-off script, or a raw SQL command executed manually — is forbidden in all environments where the data is significant. Schema changes in production without a corresponding migration are untracked, cannot be reproduced, and cannot be rolled back safely.

### 16.4 Business Logic in Stored Procedures or Triggers

Stored procedures and database triggers that implement application business rules — sending notifications, computing derived values, enforcing business workflows — are forbidden. Business logic lives in Services. Database-layer logic is invisible to the application's test suite, invisible to the application's error handling, and invisible to the application's observability stack.

### 16.5 Storing Secrets or Credentials in the Database in Plaintext

Passwords, API keys, tokens, and cryptographic secrets are never stored in the database in plaintext. All credentials stored in the database are hashed (passwords, using a strong one-way hash) or encrypted (tokens, API keys, using application-level encryption with key management). Plaintext credentials in the database are readable by anyone with database access, in every backup, and in every log that captures row contents.

### 16.6 Exposing Raw Database Models to Layers Above the Repository

The database model — the TypeScript type that directly maps to a table's columns — must not be returned from a Repository to a Service. Services receive domain objects. The mapping from model to domain object is the Repository's responsibility. Exposing models to Services couples Services to the database schema.

### 16.7 Omitting Indexes on Foreign Keys

A foreign key column without an index is a performance defect waiting to be encountered under load. Every relationship between tables that is expressed as a foreign key requires an index on the foreign key column. This is not optional.

---

## 17. AI Database Rules

This section defines how an AI system must reason about the database layer when developing within Void.

### 17.1 Never Generate Direct Database Access Outside Repositories

When the AI generates code that requires data from the database, the access must go through a Repository. The AI must not generate ORM calls, raw SQL, or query builder expressions in Service, Manager, Command, Plugin, or Controller code. If a Repository method that satisfies the need does not exist, the AI must generate the Repository method first.

### 17.2 Every Schema Change Requires a Migration

When the AI proposes a schema change — a new table, a new column, a new constraint — it must simultaneously generate the migration that applies the change. The AI must not generate a schema definition change without the corresponding migration. Schema and migration are a single unit.

### 17.3 Indexes Are Not Automatic

When the AI generates a new table or adds a new foreign key, it must explicitly generate the required indexes. The AI must not assume the database will create indexes automatically beyond the primary key. Every foreign key column and every queried column must have a deliberate index decision.

### 17.4 The AI Must Classify Repository Errors

When the AI generates a Repository method, it must generate the error classification logic — catching database-level errors and converting them to the domain-meaningful categories defined in Section 13.2. A Repository method that allows raw database exceptions to propagate to the Service layer is incomplete.

### 17.5 The AI Must Identify N+1 Patterns

When the AI generates Repository methods that load related data, it must inspect the access pattern for N+1 queries. A loop that calls a Repository method once per entity in a collection is an N+1 pattern. The AI must batch these into a single query.

### 17.6 The AI Must Not Generate Polymorphic Columns

When the AI designs an entity that has variable-shape data, it must choose between a relational model (separate tables for each shape) and a structured JSON column with a defined schema — not an untyped blob. Untyped storage columns are forbidden.

### 17.7 The AI Must Apply the Expand-and-Contract Pattern for Destructive Migrations

When the AI generates a migration that involves a destructive change — dropping a column, renaming a column, changing a column's type — it must identify the change as requiring the expand-and-contract pattern and generate all three phases rather than applying the destructive change in a single migration.

### 17.8 Migrations Are Reviewed Before Application

The AI must flag any generated migration that:
- Acquires a full table lock (e.g., adding a non-null column without a default to a large table)
- Performs a data backfill on a large table without pagination
- Drops or alters a column that is still referenced in application code

These migrations must be reviewed and approved by a human before being applied to any non-development environment.

### 17.9 The AI Must Generate Repository Tests

When the AI generates a new Repository method, it must generate corresponding tests that:
- Verify the method returns the correct result for the happy path
- Verify the method returns `not_found` when the entity does not exist
- Verify that constraint violations produce the correct error category
- Use an isolated test database or in-memory equivalent — not the development or production database

---

## 18. Review Checklist

Use this checklist for every code review that introduces or modifies database-related code — schema definitions, migrations, Repository methods, or entity models.

### Access Boundary
- [ ] No database query is issued outside a Repository method
- [ ] The database client is not injected into any non-Repository component
- [ ] Repository methods return domain objects — not raw database models
- [ ] No SQL fragments, table names, or column names are exposed in the Repository's public interface

### Entity and Schema Design
- [ ] Every new table has a surrogate primary key
- [ ] Every new table has `created_at` and `updated_at` audit columns
- [ ] Every foreign key relationship has a declared referential action (CASCADE, RESTRICT, SET NULL)
- [ ] Nullable columns are justified by the domain — not used as a convenience default
- [ ] Soft delete (if used) uses the `deleted_at` column pattern and all query methods filter appropriately
- [ ] No polymorphic columns, unbounded collection columns, or schema-free data blobs

### Query Rules
- [ ] All queries are parameterized — no string concatenation or interpolation of caller-provided values
- [ ] Only required columns are selected — no `SELECT *`
- [ ] All ordered result sets have an explicit `ORDER BY`
- [ ] No N+1 query patterns — related data is batch-loaded
- [ ] Raw SQL is documented with the reason the abstraction was insufficient

### Transactions
- [ ] Transaction boundaries are defined in the Service that calls the Repository — not in the Repository
- [ ] Repository methods accept and use an external transaction context when provided
- [ ] No transactions span external API calls
- [ ] No nested transaction creation in Repository methods

### Integrity
- [ ] All applicable unique constraints are enforced at the database level
- [ ] All business-critical rules that can be expressed as check constraints are enforced at the database level
- [ ] Cascade delete rules are documented and justified
- [ ] No secrets or credentials are stored in plaintext

### Indexes
- [ ] Every foreign key column has an index
- [ ] Every new index is justified by a documented query that uses it
- [ ] Composite index column order matches the access pattern

### Migrations
- [ ] Every schema change has a corresponding migration
- [ ] Migrations are non-destructive — no data loss paths
- [ ] Destructive changes use the expand-and-contract pattern
- [ ] Migration has been tested against a production-scale dataset (for large tables)
- [ ] Table locks are bounded — the migration does not block production for unacceptable duration
- [ ] The migration file is immutable — it was not modified after being applied anywhere

### Error Handling
- [ ] Raw database errors are caught and classified in the Repository
- [ ] Not-found conditions return typed `not_found` results — not null
- [ ] Transient failures are marked as retryable
- [ ] Error results include Repository method context for logging

### Performance
- [ ] All queries have a defined timeout
- [ ] No in-memory filtering of database results
- [ ] Connection pooling is in use — no per-request connection creation
- [ ] Query execution plans reviewed for queries on large tables

### Testing
- [ ] New Repository methods have tests covering the happy path and each error case
- [ ] Tests use an isolated database — not production or development
- [ ] Tests verify typed error results — not raw exception types

---

*This document is the official and sole reference for database access policy in Void. The database layer is a walled perimeter. No data access crosses its boundary without going through a Repository. No schema change occurs without a migration. No business logic lives below the Service layer. These rules exist because consistency, correctness, and integrity in a long-lived system require discipline at the data layer above all other layers.*
