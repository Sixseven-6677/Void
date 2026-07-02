# 21 — Testing Policy

> **Status:** Official  
> **Scope:** All testing decisions in Void — philosophy, unit testing, integration testing, mocking, isolation, coverage policy, performance testing, regression testing, and CI integration  
> **Authority:** This document is the single source of truth for how testing is designed, written, organized, and enforced in Void. Every test written in this project must comply with this policy. A test that does not follow these rules is not a passing test — it is an incomplete implementation. Testing is not optional work done after features are built. It is part of the definition of done.

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Test Taxonomy](#2-test-taxonomy)
3. [Unit Testing](#3-unit-testing)
4. [Integration Testing](#4-integration-testing)
5. [End-to-End Testing](#5-end-to-end-testing)
6. [Mocking](#6-mocking)
7. [Test Isolation](#7-test-isolation)
8. [Coverage Policy](#8-coverage-policy)
9. [Performance Testing](#9-performance-testing)
10. [Regression Testing](#10-regression-testing)
11. [CI Testing](#11-ci-testing)
12. [Test Data Management](#12-test-data-management)
13. [Best Practices](#13-best-practices)
14. [Anti-Patterns](#14-anti-patterns)
15. [Forbidden Testing Practices](#15-forbidden-testing-practices)
16. [AI Testing Rules](#16-ai-testing-rules)
17. [Review Checklist](#17-review-checklist)

---

## 1. Testing Philosophy

### 1.1 Tests Are the System's Second Implementation

A test suite is a second, executable specification of the system's intended behavior. When the production code and the test suite disagree — the production code does something the tests do not expect — one of them is wrong. Usually the production code is wrong. Occasionally the test is outdated. In either case, the disagreement must be resolved — not ignored.

A system whose test suite is trusted is a system where changes can be made confidently. A system whose test suite is not trusted — because tests are flaky, because coverage is superficial, because the tests verify implementation rather than behavior — is a system where every change is a risk and every refactor is feared.

### 1.2 Tests Verify Behavior, Not Implementation

A test that verifies what a component does — given these inputs, it produces this output, causes these side effects, handles this failure — is a behavioral test. It survives refactoring: the implementation can change completely as long as the behavior is preserved.

A test that verifies how a component does something — this method was called N times, this internal variable was set to this value, this private object was instantiated — is an implementation test. It breaks on every refactoring even when the behavior is correct. Implementation tests are a trap: they give false confidence when they pass and false failures when refactoring occurs.

All tests in Void verify behavior. Implementation details are never the subject of a test assertion.

### 1.3 Fast Tests Enable Confident Development

A test suite that runs in seconds can be run on every change. A test suite that runs in minutes is run infrequently. A test suite that runs in hours is run only in CI — meaning developers get feedback only after a push. The faster the test suite, the earlier problems are found and the lower the cost of fixing them.

Every decision in this policy is influenced by the goal of keeping the test suite fast enough to run on every change.

### 1.4 Tests Are Production Code

Tests are first-class code. They are reviewed with the same rigor as production code, maintained with the same discipline, refactored when they are unclear, and deleted when they are wrong or obsolete. A test suite that is messy, hard to read, and full of duplication will be ignored when it fails — defeating the entire purpose.

Test code must be readable by anyone who understands the production code. A test that requires fifteen minutes to understand is a poorly written test.

### 1.5 The Test Is the Only Documentation That Stays Current

Comments, README files, and design documents drift from reality as code evolves. Tests cannot drift — a test that describes behavior that no longer exists will fail, making the drift visible. Tests are the most reliable form of behavioral documentation.

When a test is well-named and clearly structured, it reads as a specification: "given X, when Y happens, Z is the result." A team that can read its test suite can understand what the system does without reading the production code.

---

## 2. Test Taxonomy

Void uses three test categories with distinct purposes, scopes, and performance characteristics.

### 2.1 Unit Tests

**Scope:** A single component — a Service, a Repository method, a middleware stage, a utility function  
**Dependencies:** All external dependencies are replaced with fakes or mocks  
**Speed:** Milliseconds per test; the full unit suite runs in under 30 seconds  
**Purpose:** Verify that the component's logic is correct in isolation

Unit tests are the foundation of the test suite. They constitute the majority of all tests. They are fast because they have no real I/O and are the primary vehicle for verifying business logic in Services.

### 2.2 Integration Tests

**Scope:** Multiple components working together — Service + Repository + database; Middleware stack + handler  
**Dependencies:** Real infrastructure (real database, real cache); external platforms are still mocked  
**Speed:** Seconds per test; the full integration suite runs in under 5 minutes  
**Purpose:** Verify that components integrate correctly — that data written by one component is read correctly by another

Integration tests verify the seams between components. They do not re-verify the logic verified in unit tests — they verify that the components compose correctly.

### 2.3 End-to-End Tests

**Scope:** Complete request flows through the system  
**Dependencies:** Real infrastructure; Facebook Layer is always mocked in E2E tests  
**Speed:** Seconds to minutes per test; the E2E suite runs in under 15 minutes  
**Purpose:** Verify that complete user-facing flows work correctly from entry point to persistence

E2E tests are the fewest in count but the highest in confidence. They are slow, fragile relative to unit tests, and expensive to maintain — they are written only for the critical paths whose failure would be immediately user-visible.

### 2.4 The Testing Pyramid

```
            ╱▔▔▔▔╲
           ╱  E2E  ╲         Few — critical paths only
          ╱──────────╲
         ╱ Integration ╲      Moderate — component seams
        ╱────────────────╲
       ╱    Unit Tests     ╲   Many — all business logic
      ╱──────────────────────╲
```

The pyramid shape is intentional and mandatory. A test suite that has more integration tests than unit tests, or more E2E tests than integration tests, is an inverted pyramid — slow, fragile, and expensive to maintain.

---

## 3. Unit Testing

### 3.1 Services Are the Primary Unit Test Target

Per `15-service-rules.md`, Services contain all business logic. Therefore, Services are the primary target of unit tests. A test suite with high Service coverage and lower coverage of Commands, Managers, or Controllers is a well-structured test suite. The inverse is a sign that business logic has escaped the Service layer.

### 3.2 One Describe Block per Public Method

Every public method of a Service (or other tested component) has a dedicated `describe` block in the test file. Within that block, individual `it` cases cover the happy path and each documented error case. The structure is:

```
describe ServiceName:
  describe methodName:
    it returns X when given valid input Y
    it returns not_found when entity Z does not exist
    it returns validation_error when field A is missing
    it returns conflict when entity is in state S
    it propagates unavailable when dependency D fails
```

This structure makes it immediately clear which method is being tested and which cases are covered.

### 3.3 Each Test Case Is Self-Contained

Every test case constructs its own inputs, its own mocks, and its own assertions. There is no shared mutable state between test cases. A test that passes only when run after another specific test — because the prior test set up state that this test depends on — is a broken test.

The rule: every test must be runnable independently of every other test, in any order, and produce the same result.

### 3.4 The Arrange-Act-Assert Pattern

Every unit test is structured in three clearly separated phases:

```
// Arrange — set up inputs, mocks, and context
const accountId = 'acc_123';
const mockRepo = createMockAccountRepository({ returnsNull: false });
const service = new AccountService({ repo: mockRepo });

// Act — call the component under test
const result = await service.findById(accountId);

// Assert — verify the outcome
expect(result.ok).toBe(true);
expect(result.value.id).toBe(accountId);
```

A test that mixes setup, execution, and assertion into a single block of statements is harder to read and harder to debug when it fails.

### 3.5 Assertions Are Specific

A test assertion must be as specific as the behavior it verifies. `expect(result).toBeDefined()` is almost never a meaningful assertion — it passes for any non-null value including an empty object. `expect(result.value.accountId).toBe('acc_123')` is specific — it verifies a concrete outcome.

Every assertion answers the question: "what exactly should be true about the result?"

### 3.6 Failure Cases Are First-Class

Every Service method's documented error cases have corresponding test cases. A method that can return `not_found`, `validation_error`, and `conflict` has at least three error-case test cases in addition to its happy-path test case. Error cases are not optional — they are the half of the behavior that matters most in production.

### 3.7 Test Names Describe Behavior

A test name is a sentence that describes the behavior being verified:

**Good:** `it returns not_found when the account does not exist`  
**Good:** `it returns conflict when a session is already active for this account`  
**Bad:** `it works`  
**Bad:** `test 1`  
**Bad:** `should throw`  

A reader scanning the test output for a failing test must understand what failed from the test name alone — without reading the test body.

---

## 4. Integration Testing

### 4.1 Integration Tests Verify Component Seams

A unit test verifies a Service in isolation — the repository is mocked. An integration test verifies the Service with a real repository and a real database. The integration test confirms that:
- The SQL the repository generates is correct
- The data the repository reads is deserialized correctly into domain objects
- The transaction boundary the Service defines commits or rolls back correctly
- Unique constraints and foreign keys behave as expected

### 4.2 Integration Tests Use an Isolated Test Database

Every integration test run uses a database instance that is:
- Dedicated to testing — not shared with development or any other environment
- Reset to a clean state before each test suite run (or each test, if the suite is small)
- Seeded with exactly the data required for the test — no more, no less

The test database's schema must be kept in sync with the production schema — migrations are applied to the test database before tests run.

### 4.3 Each Integration Test Owns Its Data

An integration test that needs specific data in the database creates that data as part of the test's setup phase. It does not depend on data left behind by a prior test. After the test completes, the data is either cleaned up or the test runs within a transaction that is rolled back.

### 4.4 Integration Tests Do Not Test Business Logic

If a test is verifying a business rule — "when the account type is premium, X happens" — it belongs in a unit test where the Service is mocked. Integration tests verify data flow and component integration — not business logic. An integration test suite that duplicates unit test coverage is an integration test suite that is too slow for what it provides.

### 4.5 External Dependencies Remain Mocked in Integration Tests

Integration tests use real databases and real caches — but external platforms (Facebook API, third-party services) remain mocked. An integration test that makes real Facebook API calls is brittle (depends on Facebook's availability), slow, and potentially dangerous (real messages could be sent). The Facebook Layer is always mocked in tests — the mock captures calls and returns controlled responses.

---

## 5. End-to-End Testing

### 5.1 E2E Tests Cover Only Critical Paths

An E2E test is expensive to write, slow to run, and fragile relative to unit tests. It is written only for flows that are critical-path user-visible behaviors: the behaviors whose failure would immediately impact users and that cannot be adequately verified at a lower test level.

Before writing an E2E test, the question must be answered: "is this covered by unit and integration tests?" If yes, an E2E test adds redundant coverage at higher cost. If no — because the behavior emerges from the interaction of the full stack in a way that lower-level tests cannot capture — the E2E test is justified.

### 5.2 E2E Tests Are Stable by Design

An E2E test that fails intermittently is worse than no test — it trains the team to ignore test failures. E2E tests are designed for stability:
- They do not depend on timing (no `sleep` or fixed-duration waits)
- They poll for expected conditions with a bounded retry count
- They isolate their data — no shared state between E2E test runs
- They mock all external platforms with deterministic fakes

### 5.3 E2E Tests Run in a Dedicated Suite

E2E tests are in a dedicated suite labeled `e2e` or `end-to-end`. They are not mixed with unit or integration tests. The E2E suite is run in CI after the unit and integration suites pass. A failing unit test must not allow the E2E suite to run — a broken lower layer must be fixed before the higher layer is tested.

---

## 6. Mocking

### 6.1 Mocks Are Interfaces, Not Implementations

A mock replaces a dependency in a test. The correct object to mock is the interface — the contract that the dependency satisfies — not a specific class implementation. A mock that is created by deeply cloning a class and overriding its methods is brittle: it breaks when the class adds new methods or changes its constructor.

A mock that implements the interface — providing exactly the methods the interface declares, with controlled return values — is stable. It does not break when the production implementation changes.

### 6.2 Mocks Return Controlled Values

A mock's value is its ability to return exactly the value needed for a specific test case. A mock that always returns the same value regardless of how it is called is a stub — useful for many tests. A mock that can be configured to return different values for different calls is more flexible.

The test controls what the mock returns. The test does not depend on real data, real timing, or real infrastructure behavior.

### 6.3 Mock Behavior Is Documented in the Test

A test that uses a mock must make the mock's configured behavior visible. A reader must understand what the mock returns without looking at any other file. The mock setup is in the `Arrange` phase of the test, immediately visible.

```typescript
// Clear: the mock is configured to return a not_found error
const mockRepo = createMockRepo();
mockRepo.findById.mockResolvedValue({ ok: false, error: { code: 'not_found' } });
```

A mock that is configured in a shared setup function and whose return value is invisible without reading another file is a clarity failure.

### 6.4 Mock Only What Is Necessary

A test that mocks every dependency of a component, including dependencies that are not involved in the behavior being tested, is over-mocked. Unnecessary mocks add noise and make the test harder to read. Only the dependencies that are invoked in the code path exercised by the test need to be mocked — and only those behaviors need to be configured.

### 6.5 Do Not Mock the Component Under Test

A test that mocks methods of the component it is testing is not a test — it is a circular exercise. When a Service's own method is mocked in the test for that Service, the test is no longer testing the Service's implementation. Only dependencies — the components called by the component under test — are mocked.

### 6.6 Verify Calls When the Call Is the Side Effect

Sometimes the significant behavior of a component is not its return value but that it called a dependency in a specific way — a message was sent, a record was saved, an event was emitted. In these cases, mock call verification is appropriate:

```typescript
// The behavior being verified: the event was emitted with the correct payload
expect(mockEventDispatcher.emit).toHaveBeenCalledWith(
  'session.created',
  expect.objectContaining({ sessionId: 'sess_123' })
);
```

Call verification is appropriate when the call is the side effect. It is not appropriate for verifying implementation details (that a helper function was called internally).

---

## 7. Test Isolation

### 7.1 Tests Do Not Share Mutable State

No global variable, no module-level object, and no shared fixture is written to by a test and read by another test. Shared mutable state between tests produces order-dependent failures — tests that pass in isolation but fail when run in a specific order.

Every piece of state a test requires is created fresh in that test's `Arrange` phase and discarded when the test ends.

### 7.2 Tests Do Not Depend on Execution Order

The test suite must produce the same results whether tests run in alphabetical order, reverse order, random order, or parallel. Order-dependent tests are a reliability failure. Test frameworks that randomize execution order are preferred precisely because they expose order dependencies.

### 7.3 Async Tests Are Properly Awaited

In an async runtime, a test that does not await all async operations may pass or fail based on timing — not behavior. Every async operation in a test is awaited. A test that creates a promise and does not await it may suppress an error that would cause the test to fail.

### 7.4 Tests Clean Up After Themselves

A test that creates database records, writes to a cache, emits events, or modifies any external state must clean up after itself — either through cleanup in an `afterEach` block or by running within a transaction that is rolled back. A test that leaves state behind may cause subsequent tests to fail, and definitely makes the test suite less reliable over time.

### 7.5 Time Is Controlled in Tests

Tests that depend on the current time — "this entity should have `created_at` equal to now" — are fragile: they depend on the actual system clock and produce different results at different times. Time-dependent tests use a controlled clock — a test utility that provides a fixed, injectable time value. The production code receives the clock through dependency injection; tests inject a deterministic mock clock.

---

## 8. Coverage Policy

### 8.1 Coverage Is a Minimum Guarantee, Not a Target

A code coverage percentage measures what fraction of lines were executed by the test suite. It does not measure whether the tests are correct, meaningful, or complete. 100% line coverage is achievable with tests that assert nothing. Coverage is a floor — a minimum below which we know testing is insufficient — not a ceiling that defines adequate testing.

### 8.2 Mandatory Coverage Minimums

| Layer | Minimum Line Coverage | Minimum Branch Coverage |
|---|---|---|
| Services | 90% | 85% |
| Repositories | 85% | 80% |
| Middleware | 85% | 80% |
| Job Handlers | 85% | 80% |
| Command Handlers | 80% | 75% |
| Utilities / Helpers | 80% | 75% |

These are minimums. Falling below them causes the CI build to fail. Achieving exactly the minimum is not the goal — thorough behavioral coverage is.

### 8.3 Coverage Is Measured on Business Logic Paths

Coverage measurement prioritizes lines and branches in Service code. An 85% coverage on a Service where the uncovered 15% is all error handling paths is not a passing result in spirit — the error handling paths are exactly the paths most likely to matter in production. Coverage reports are reviewed for what is uncovered, not just the aggregate percentage.

### 8.4 New Code Must Not Reduce Coverage

A pull request that reduces overall coverage is blocked by CI. When new code is added, tests must be added or updated proportionally. New features that reduce coverage percentage indicate that tests were not written alongside the feature.

### 8.5 Excluded Coverage Is Explicitly Annotated

When a line or block is intentionally excluded from coverage measurement — because it is an error that can only occur in catastrophic scenarios, because it is generated code, because it is a type assertion that cannot be exercised — the exclusion is annotated with a comment explaining why. Coverage exclusions without explanation are not permitted.

---

## 9. Performance Testing

### 9.1 Performance Tests Are Separate from the Functional Suite

Performance tests do not run in the standard CI pipeline alongside unit and integration tests. They are a separate suite, run on a schedule (nightly, weekly) or triggered manually when performance-sensitive code changes. Performance tests require dedicated infrastructure and produce noisy results in shared CI environments.

### 9.2 Performance Tests Define Acceptance Criteria

A performance test is not a measurement — it is a test with a pass/fail criterion. Before a performance test is written, the acceptance criterion is defined:

- "The `findActiveSessionsForAccount` repository method must return in under 20ms at p99 for accounts with up to 1000 sessions"
- "The `MessageDeliveryService.send` method must process 100 messages per second without error"
- "The authentication middleware must add less than 5ms to request latency at p95"

A performance test that measures latency but has no defined threshold is not a test — it is a benchmark. Benchmarks are useful for tracking trends; tests enforce minimums.

### 9.3 Performance Tests Use Production-Scale Data

A performance test that runs against a 100-row database will pass for any query. Performance characteristics emerge at scale. Performance tests use datasets that represent realistic production scale — or an explicit fraction of it (10%, 25%) with results scaled accordingly.

### 9.4 Performance Regression Detection

Performance test results are recorded over time. A test run whose result is significantly worse than the previous run — more than 20% slower — triggers an alert. Performance regressions are bugs. A feature that is functionally correct but 3x slower than the previous implementation is an incomplete implementation.

### 9.5 Load Testing Critical Paths

For critical paths — session establishment, message delivery, authentication — load tests verify that the system behaves correctly under sustained concurrent load, not just under single-request test conditions. Load tests define:
- The target request rate (requests per second)
- The duration of the load (minimum 5 minutes for thermal effects to stabilize)
- The acceptable p50, p95, and p99 latencies under that load
- The acceptable error rate under that load (target: 0% for critical paths)

---

## 10. Regression Testing

### 10.1 Every Bug Fix Has a Regression Test

When a bug is found and fixed, a test that reproduces the bug must be written before the fix is applied. The test must fail on the buggy code and pass on the fixed code. This test is the regression test: it ensures the bug cannot silently reappear.

A bug fix without a regression test is a fix without a guarantee. The same bug will recur when the relevant code is touched in the future.

### 10.2 Regression Tests Are Named for the Bug

A regression test is named in a way that identifies the bug it guards against:

```
it does not return stale session data when the account has been deleted
it does not send duplicate messages when the job is retried after a timeout
it does not allow negative quota values when concurrent requests decrement simultaneously
```

The name describes the incorrect behavior that the test prevents from returning — not the fix that was applied.

### 10.3 Regression Tests Are in the Standard Suite

Regression tests are placed in the appropriate test file alongside the other tests for the component they cover. They are not in a separate "regressions" file or folder. A regression test for `SessionService.validate` belongs in `SessionService.test.ts` with all other tests for that method.

### 10.4 Regression Coverage for Reported Issues

When a user-reported issue is investigated and its root cause is found, a regression test is written that covers the exact scenario the user encountered — including the specific input values (anonymized if sensitive) and the exact failure mode. The test confirms that the scenario that affected the user cannot affect future users.

---

## 11. CI Testing

### 11.1 The CI Pipeline Is the Authoritative Test Run

The test results that matter are the CI test results. A "works on my machine" result is not a pass. The CI environment is the authoritative environment — it has a defined, reproducible configuration, it runs tests from a clean state, and its results are version-controlled alongside the code.

### 11.2 The CI Test Suite Must Pass Before Merge

No code may be merged to the main branch unless the CI test suite passes completely. A suite with failing tests is a broken main branch. A broken main branch blocks all other work — it must be treated as a P0 incident.

### 11.3 CI Pipeline Structure

```
Stage 1: Build and Typecheck
  - TypeScript compilation (zero errors)
  - Lint (zero violations above warning level)

Stage 2: Unit Tests
  - All unit tests must pass
  - Coverage minimums must be met
  - Runs in < 60 seconds

Stage 3: Integration Tests
  - All integration tests must pass
  - Requires test database
  - Runs in < 5 minutes

Stage 4: Coverage Report
  - Aggregate coverage computed
  - Coverage below minimums: build fails
  - Coverage delta computed against main branch

Stage 5: E2E Tests (on main branch merges only)
  - All E2E tests must pass
  - Runs in < 15 minutes

Stage 6: Performance Tests (scheduled, not per-commit)
  - Runs nightly on main branch
  - Regression alerts fire automatically
```

### 11.4 Flaky Tests Are P1 Bugs

A flaky test — one that fails intermittently without code changes — is a P1 bug. It is not "just a flaky test" that is accepted and re-run until it passes. A flaky test erodes trust in the entire test suite. When developers learn to ignore test failures because "it's probably just the flaky test," the test suite loses its value entirely.

The correct response to a flaky test: quarantine it immediately (mark it as skipped with a tracking issue), investigate the root cause, fix it before any other work, and un-quarantine it. A test that has been quarantined for more than one sprint must be deleted or fixed — not left in an indefinite quarantine.

### 11.5 Test Parallelism Is Managed

Unit tests run in parallel — each test file in its own worker. Integration tests are parallelized with database isolation — each parallel test worker uses a separate database schema or separate database instance. Tests that cannot be parallelized are explicitly marked as serial. Silent parallelism failures (tests that appear to pass individually but fail in parallel) are treated as flaky tests and investigated.

### 11.6 CI Environments Are Ephemeral and Reproducible

The CI environment is rebuilt from scratch for every run. No state persists between CI runs. This ensures that a test that passes in CI passes because it is genuinely correct — not because prior runs left state that happens to satisfy its preconditions. A test that requires persistent CI state is a test that violates isolation rules.

---

## 12. Test Data Management

### 12.1 Test Data Is Explicit and Minimal

Every test creates exactly the data it needs — no more. A test that creates a full account record with fifty populated fields to test a function that reads one field is over-specified. Over-specified test data creates maintenance burden — every time the data model changes, dozens of tests need updates even if the tested behavior did not change.

Use focused factories that create minimal, valid objects with only the fields required for the test.

### 12.2 Factory Functions, Not Fixtures

Test data is created through factory functions — functions that accept partial overrides and produce valid objects:

```typescript
function createAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_test_' + randomId(),
    status: 'active',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}
```

Factory functions are centralized and shared across the test suite. When the `Account` type gains a new required field, the factory is updated in one place and all tests using the factory continue to work.

### 12.3 Sensitive Data in Tests Is Anonymized

Test data must not contain real user data — real phone numbers, real names, real account IDs from production. Test data uses clearly fake values: `+15550000001`, `Test Account`, `acc_test_123`. Using real production data in tests creates a data handling risk and is forbidden.

### 12.4 Test Data Does Not Encode Business Assumptions

A test that uses `accountType: 'premium'` as a hardcoded constant — because at the time of writing premium accounts have a specific behavior — will break silently if the business definition of "premium" changes but the constant is not updated. Test data encodes only what is necessary for the specific behavior being tested. The connection between data values and business behavior is expressed in the test assertion — not in the data value itself.

---

## 13. Best Practices

1. **Write the test before the implementation.** A test written before the implementation describes the desired behavior precisely. A test written after the implementation often tests what was implemented — not what was intended. Test-first development catches design problems early, when they are cheap to fix.

2. **One behavior per test.** A test that verifies ten different behaviors in a single `it` block will fail for one reason but report it as a single failure, making diagnosis difficult. Each `it` block verifies exactly one behavior. When the test fails, the failure name precisely identifies what broke.

3. **Name tests as specifications.** A test suite whose names read as complete sentences — "it returns not_found when the session has expired", "it sends a notification when the account is activated" — is a machine-executable specification. Every developer reading it understands what the system does.

4. **Keep test setup proportional to test complexity.** A test with 50 lines of setup and 3 lines of assertion has an inverted ratio. The assertion is what matters — the setup is scaffolding. If the setup is disproportionately large, extract it into a factory function or a shared setup helper.

5. **Prefer explicit assertions over snapshot testing.** Snapshot tests — which store the entire output and compare it on every run — are easy to create and hard to maintain. When a snapshot changes, the reviewer must read the entire diff to determine whether the change is intentional. Explicit assertions state exactly what is expected. Snapshot testing is a last resort for complex, stable outputs.

6. **Test the contract, not the internals.** When a Service is refactored — its internal algorithm changed, its private helper methods restructured — the unit tests should all still pass. If refactoring causes test failures even though the behavior is unchanged, the tests are testing internals. Tests are rewritten to test the external contract.

7. **Treat every test file as a module.** A test file imports only what it needs, defines only what is used, and has no dead code. A test file that is 3000 lines with helper functions scattered throughout is a maintenance problem. Large test files are split into per-method test files or factored into shared utilities.

---

## 14. Anti-Patterns

### 14.1 The Test That Asserts Nothing

A test that runs successfully without any assertions. The test verifies that the code does not throw — but nothing about what it returns, what state it produces, or what side effects it causes. A test with no assertions is not a test. It is a code execution exercise. Every test has at least one specific assertion.

### 14.2 The Omnibus Test

A single test that creates five entities, calls three Service methods, and makes fifteen assertions — verifying multiple independent behaviors in a single block. When this test fails, the failure message identifies the test case but not which of the fifteen assertions failed or which of the five behaviors broke. Each behavior is a separate test case.

### 14.3 The Sleeping Test

A test that uses `setTimeout`, `sleep`, or any fixed-duration wait to give asynchronous code time to complete. Sleep-based timing makes tests slow (the sleep duration is always conservative), fragile (works on fast machines, fails on slow CI), and non-deterministic (depends on the system's load at the moment of execution). All asynchronous code is awaited explicitly — never waited for with a fixed delay.

### 14.4 The Test That Knows Too Much

A test that verifies internal method calls, private variable states, or implementation details that are not part of the public contract. This test will break on every refactoring of the internal structure, even when the external behavior is unchanged. Tests verify external contracts only.

### 14.5 The Shared Fixture Test

A test suite where `beforeAll` sets up shared database records, shared objects, or shared mock configurations that all tests in the suite depend on. When one test modifies the shared state and a subsequent test reads it, the suite has order-dependent tests. Every test is self-contained.

### 14.6 The Testing Pyramid Inversion

A test suite that has more integration or E2E tests than unit tests. The inverted pyramid is slower, more expensive to run, harder to maintain, and provides less precise feedback when things break. Business logic verified in an E2E test takes 10 seconds to feedback on; the same logic verified in a unit test takes 10 milliseconds.

### 14.7 The Green Checkbox Test

A test written only to increase the coverage percentage — it exercises a code path but asserts only that the code did not throw. It is green and it improves the coverage number, but it verifies nothing. The green checkbox is a false positive that gives false confidence. Coverage requirements are met with meaningful assertions, not superficial ones.

---

## 15. Forbidden Testing Practices

### 15.1 Production Data in Tests

Tests must not use real user data from production databases. All test data is synthetic and clearly marked as test data. Using production data in tests is a data handling and privacy violation with no acceptable justification.

### 15.2 Tests That Require Manual Steps

A test that cannot run with a single command — that requires a developer to manually start a service, manually configure an environment, or manually perform any action before running — is not an automated test. All tests in the automated suite must run with a single command in a clean environment.

### 15.3 Tests That Write to Production Infrastructure

A test that writes to a production database, sends real messages, or calls real external APIs in a way that produces real side effects is forbidden. Tests run against isolated test infrastructure only.

### 15.4 Skipped Tests Without Issues

A test marked as `skip`, `xit`, `xdescribe`, or equivalent — with no associated tracking issue and no documented reason — is a test that has been quietly disabled. Disabled tests that are not tracked are forgotten and never re-enabled. A skipped test must have a comment with a tracking issue reference and a deadline.

### 15.5 Assertions on Timing Without a Controlled Clock

A test that asserts on `createdAt`, `updatedAt`, or any timestamp using `expect(result.createdAt).toBe(new Date())` is fragile — it will fail if even a millisecond passes between when the timestamp is set and when the assertion runs. Time assertions use a controlled clock injected as a dependency.

### 15.6 Importing Internal Implementation Details

A test that imports private functions, internal helpers, or unexported symbols from the production module is testing implementation details. If a function is not exported, it is not part of the public contract and must not be directly tested. Test only exported interfaces.

---

## 16. AI Testing Rules

This section defines how an AI system must reason about testing when developing within Void.

### 16.1 Tests Are Generated Alongside Implementation, Never After

When the AI generates a new Service method, Repository method, middleware stage, or job handler, it generates the corresponding tests in the same response. Tests are not deferred to a follow-up. An implementation delivered without tests is an incomplete deliverable.

### 16.2 The AI Must Follow the Arrange-Act-Assert Structure

Every test the AI generates follows the Arrange-Act-Assert pattern with clear separation between the three phases. The AI must not generate tests where setup, execution, and assertion are interleaved.

### 16.3 The AI Must Generate Tests for Every Error Case

When the AI generates a Service method, it reads the method's documented error cases and generates a test case for each one. A method that returns `not_found`, `validation_error`, and `conflict` gets tests for all three error cases in addition to the happy path.

### 16.4 The AI Must Generate Minimal, Specific Test Data

When the AI generates test data, it uses factory functions and creates only the fields necessary for the specific test. The AI must not generate test objects with every field populated when the test uses only one field.

### 16.5 The AI Must Not Generate Sleep-Based Tests

The AI must not generate any test that uses `setTimeout`, `sleep`, `waitFor`, or any fixed-duration wait. Asynchronous operations are awaited directly. If the AI is unsure how to await an operation, it must ask — not use a sleep.

### 16.6 The AI Must Generate Behavior-Verifying Assertions

Every test the AI generates has at least one assertion that verifies a specific, concrete outcome: a specific return value, a specific error code, a specific mock call with specific arguments. The AI must not generate tests that assert only `toBeDefined()`, `not.toThrow()`, or `toBeTruthy()` without a more specific assertion.

### 16.7 The AI Must Place Tests in the Correct Suite

The AI must correctly classify tests it generates:
- Logic tested with a mocked dependency → unit test
- Multiple real components tested together → integration test
- Full request flow tested end-to-end → E2E test

The AI must not place unit test logic in the integration test suite or vice versa.

### 16.8 The AI Must Not Mock the Component Under Test

When the AI generates a test for `SessionService`, it mocks the Service's dependencies — `SessionRepository`, `AuthenticationService` — but does not mock methods of `SessionService` itself. The component under test is never mocked.

### 16.9 The AI Must Generate Regression Tests for Bug Fixes

When the AI generates a bug fix, it must simultaneously generate a regression test that:
- Reproduces the original bug on the unfixed code (the AI verifies this in its reasoning)
- Passes on the fixed code
- Is named after the bug — "it does not [incorrect behavior] when [conditions]"

### 16.10 The AI Must Flag Coverage Gaps

When the AI generates or modifies a component, it must assess whether the test suite covers all documented behaviors and all error cases. If the AI identifies coverage gaps — behaviors in the production code that have no corresponding test — it must flag them explicitly and either generate the missing tests or list them as follow-up requirements.

### 16.11 The AI Must Verify Test Independence

Before delivering a test suite, the AI must verify that no test depends on state set by another test. Each test's `Arrange` phase must be complete and self-sufficient. The AI must not generate `beforeAll` blocks that create shared mutable state used by individual tests.

---

## 17. Review Checklist

Use this checklist for every code review that introduces or modifies tests.

### Test Structure
- [ ] Tests follow the Arrange-Act-Assert pattern with clear phase separation
- [ ] Each `it` block tests exactly one behavior
- [ ] Test names describe the behavior being tested as a complete sentence
- [ ] Test files are organized with one `describe` per public method

### Completeness
- [ ] Every public method has at least one happy-path test
- [ ] Every documented error case has a corresponding test
- [ ] New code does not reduce the overall coverage below the mandatory minimums
- [ ] Bug fixes include a regression test

### Isolation
- [ ] Tests do not share mutable state
- [ ] Tests produce the same result regardless of execution order
- [ ] Tests clean up any external state they create (database records, cache entries)
- [ ] Time-dependent tests use a controlled clock

### Mocking
- [ ] Only dependencies are mocked — not the component under test
- [ ] Mock behavior is configured and visible in the test's Arrange phase
- [ ] Mocks implement the dependency's interface — not a specific class
- [ ] Call verification is used only when the call is the side effect being verified

### Test Data
- [ ] Test data is created through factory functions
- [ ] Factory functions are centralized and shared
- [ ] Test data contains only fields necessary for the specific test
- [ ] No real production data is used — all values are synthetic

### Suite Classification
- [ ] Unit tests are in the unit suite — no real I/O
- [ ] Integration tests are in the integration suite — real database, mocked external platforms
- [ ] E2E tests are justified — they cover critical paths not testable at lower levels
- [ ] E2E tests are stable — no sleep-based timing

### CI Compliance
- [ ] All tests pass in the CI environment
- [ ] Coverage minimums are met for all affected layers
- [ ] No tests are skipped without a documented tracking issue and deadline
- [ ] No test writes to production infrastructure or uses real production data

### AI-Generated Tests Specific
- [ ] Tests were generated alongside the implementation — not deferred
- [ ] Every error case has a test case
- [ ] Assertions are specific — not `toBeDefined()` or `toBeTruthy()` alone
- [ ] No sleep-based timing is present
- [ ] No shared mutable state between test cases

---

*This document is the official and sole reference for testing in Void. A feature without tests is an incomplete feature. A bug fix without a regression test is an incomplete fix. A test that verifies implementation rather than behavior is a liability rather than an asset. The test suite is the system's executable specification — it must be trustworthy, fast, and complete enough to allow any engineer to change any component with confidence.*
