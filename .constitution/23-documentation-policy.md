# 23 — Documentation Policy

> **Status:** Official  
> **Scope:** All documentation decisions in Void — philosophy, API documentation, internal code documentation, public-facing documentation, architectural documentation, commenting rules, Markdown standards, and the update policy that keeps documentation synchronized with the system it describes  
> **Authority:** This document is the single source of truth for documentation practices in Void. Every architectural decision that shaped the system must be documented. Every public interface must be documented. Every non-obvious piece of code must be explained. Documentation is not optional work done after features are complete — it is part of the definition of done. An undocumented architectural decision is a decision that will be silently reversed when the engineer who made it moves on.

---

## Table of Contents

1. [Documentation Philosophy](#1-documentation-philosophy)
2. [The Architectural Decision Mandate](#2-the-architectural-decision-mandate)
3. [API Documentation](#3-api-documentation)
4. [Internal Documentation](#4-internal-documentation)
5. [Architecture Documentation](#5-architecture-documentation)
6. [Public Documentation](#6-public-documentation)
7. [Commenting Rules](#7-commenting-rules)
8. [Markdown Standards](#8-markdown-standards)
9. [Update Policy](#9-update-policy)
10. [Documentation Ownership](#10-documentation-ownership)
11. [Best Practices](#11-best-practices)
12. [Anti-Patterns](#12-anti-patterns)
13. [Forbidden Documentation Practices](#13-forbidden-documentation-practices)
14. [AI Documentation Rules](#14-ai-documentation-rules)
15. [Review Checklist](#15-review-checklist)

---

## 1. Documentation Philosophy

### 1.1 Documentation Is a First-Class Engineering Deliverable

Documentation is not a task that follows engineering work — it is an integral part of engineering work. A feature is not complete until:
- Its public interface is documented
- Any architectural decisions it introduces are recorded
- Any non-obvious behavior or constraint is explained in the code
- Any migration, upgrade, or operational change it requires is described

A pull request that introduces a new Service, extends the public API, or makes a non-obvious architectural choice without accompanying documentation is an incomplete pull request. It will not be merged.

### 1.2 Documentation Has an Audience

Every piece of documentation is written for a specific audience. Before writing, identify who will read this:
- **The future engineer** who maintains this code six months from now, without memory of the original decisions
- **The new team member** who needs to understand how this component fits into the system
- **The on-call engineer** who encounters this code at 3 AM during an incident
- **The AI system** that generates new code within the architectural constraints established here

Documentation written without a clear audience is documentation written without purpose. Vague, hedging, or jargon-heavy prose that is difficult to parse at speed fails every audience.

### 1.3 Documentation Must Earn the Reader's Trust

A reader who finds documentation that is outdated, incorrect, or misleading will stop trusting all documentation. Once trust is lost, documentation becomes noise — it is ignored, and the team re-learns everything empirically at the cost of time and errors.

Documentation earns trust through accuracy, currency, and completeness. It is updated when the code it describes changes. It is deleted when the code it describes is removed. It does not hedge with phrases like "this might change" or "approximately" when the behavior is known and stable.

### 1.4 Less Documentation Is Better Than Wrong Documentation

A piece of documentation that is incorrect is worse than no documentation. An incorrect document misleads the reader into a wrong understanding and costs time to diagnose and correct. When documentation cannot be kept current — because the code it describes changes too rapidly, because there is no ownership mechanism — it is better to delete it than to let it drift into inaccuracy.

The rule: document what can be kept current. Remove what cannot.

### 1.5 The Constitution Is the Highest-Authority Documentation

The `.constitution/` directory contains the architectural and policy documents that define how Void is built. These documents — including this one — are the highest-authority source of truth for design decisions, architectural patterns, and engineering standards. When a document in the constitution conflicts with a comment in the code, the constitution is authoritative. When a document in the constitution is wrong, the constitution is updated, not the code.

---

## 2. The Architectural Decision Mandate

### 2.1 Every Important Architectural Decision Must Be Documented

An architectural decision is any choice that:
- Affects the structure of the system at a layer boundary (why Services call Repositories rather than querying directly)
- Selects one approach over equally viable alternatives (why cache-aside rather than write-through)
- Introduces a constraint that future engineers must comply with (why the Facebook Layer may not be called from Services directly)
- Accepts a trade-off that has ongoing consequences (why eventual consistency is acceptable for contact lists)
- Establishes a pattern that will be repeated across the codebase (how all async errors are classified)

Every such decision must be documented before the code implementing it ships. A decision that is in the code but not in the documentation is a decision that will be made again — differently — by the next engineer who encounters the same problem.

### 2.2 The Architecture Decision Record Format

Every significant architectural decision is documented in an Architecture Decision Record (ADR). An ADR answers four questions:

**Context:** What is the situation or problem that requires a decision? What constraints, requirements, and forces are at play?

**Decision:** What was decided? State it in one or two clear sentences. Do not hedge.

**Rationale:** Why was this decision made over the alternatives? What were the alternatives considered, and what made them unsuitable?

**Consequences:** What are the implications of this decision? What is now easier, what is now harder, what must be done differently as a result?

An ADR is not a journal entry ("we discussed several options and eventually decided...") — it is a reference document. It is written to be read quickly by someone who needs the decision and its rationale — not the deliberation process that led to it.

### 2.3 ADRs Are Immutable After Acceptance

Once an ADR is accepted and the decision is implemented, the ADR document is not modified. If the decision is later reversed or superseded, a new ADR is written that references the original and records the new decision and the reason for the change. The history of decisions is preserved — not overwritten.

An ADR that records a decision that was later reversed is more valuable than one that was quietly updated to reflect the reversal. The reversal itself is a decision with rationale and consequences that must be documented.

### 2.4 The Constitution Documents Enduring Architectural Policy

The `.constitution/` documents are not ADRs — they are policy documents that express enduring architectural rules. When an ADR establishes a pattern that becomes a project-wide policy, the policy is promoted into the constitution. The ADR records the decision history; the constitution records the current, authoritative rule.

### 2.5 Undocumented Decisions Will Be Reversed

A decision that is not documented has no authority. When a future engineer encounters an undocumented pattern — "why does this go through an abstraction layer when direct access would be simpler?" — and finds no explanation, they will simplify it. The pattern will be removed, and the problem it was solving will recur. Documented decisions survive.

---

## 3. API Documentation

### 3.1 Every Public API Endpoint Is Documented

Every endpoint exposed by the Void API — every route, every parameter, every response shape, every error code — is documented in the OpenAPI specification. The OpenAPI spec is the authoritative, machine-readable documentation of the API surface.

The spec includes, for every endpoint:
- The HTTP method and path
- A description of what the endpoint does
- Every path parameter, query parameter, and request body field — with type, required/optional status, and description
- Every success response shape with example values
- Every documented error response with the error code and the condition that produces it
- Authentication and authorization requirements

### 3.2 The OpenAPI Spec Is the Source of Truth, Not a Derivative

The OpenAPI specification is written and maintained as the primary artifact — not generated from code annotations after the fact. Client SDKs, server stubs, validation schemas, and integration tests are generated from the spec. The spec is not generated from the code.

This direction matters: when the spec and the code disagree, the spec is the intended behavior and the code has a bug. When the code and a generated artifact disagree, the spec has not been updated and the spec is wrong. The spec is always the design artifact; all other artifacts are derived.

### 3.3 Breaking Changes Are Documented With Migration Guidance

When a public API endpoint changes in a breaking way — a required field is added, a field is removed, a type changes, behavior changes — the change is documented with:
- What changed and when
- What callers must do to migrate
- How long the old behavior is supported (if a deprecation period applies)

Breaking changes without migration guidance force callers to reverse-engineer the change from error messages and behavior observation. This is a failure of the API contract.

### 3.4 Deprecations Are Annotated in the Spec

When an endpoint or field is deprecated — scheduled for removal in a future version — it is annotated as deprecated in the OpenAPI spec with:
- The deprecation date
- The reason for deprecation
- The replacement endpoint or approach (if one exists)
- The planned removal date

Deprecations are announced in advance. No API element is removed without a prior deprecation notice and a migration period.

### 3.5 Error Codes Are Catalogued

Every error code that the API can return is catalogued in the API documentation:
- The error code value
- The HTTP status it produces
- The conditions under which it is returned
- The corrective action the caller should take

A caller who receives an undocumented error code cannot handle it correctly. Undocumented errors are silent failures from the caller's perspective.

---

## 4. Internal Documentation

### 4.1 Service Documentation

Every Service has documentation that covers:

- **Purpose statement:** One to three sentences describing what capability this Service owns and why it exists
- **Operations:** For each public method — what it does, what inputs it accepts (types, constraints), what it returns on success, and what error categories it can return
- **Dependencies:** The other Services, Repositories, and infrastructure components this Service requires
- **State:** If the Service is stateful — what state it holds, how it is initialized, and what happens to state on error or shutdown
- **Constraints:** Non-obvious rules the Service enforces that callers should be aware of

Service documentation lives in the Service's source file — not in a separate document. It is read alongside the code, not separately.

### 4.2 Repository Documentation

Every Repository method has documentation that covers:
- What query it executes at a conceptual level ("finds all sessions for an account that were created after the given timestamp")
- The parameters and their constraints
- What is returned on success (including whether the result may be empty)
- What typed error it returns when the query finds no results
- Any significant performance characteristics (uses an index on column X, may be slow for accounts with more than N records)

### 4.3 Manager Documentation

Every Manager has documentation that covers:
- The coordination concern it owns
- Its lifecycle states and the valid transitions between them
- The components it coordinates
- What it signals when state transitions occur
- What happens when it encounters a component failure

The state machine is documented in the Manager's source file or in a dedicated document referenced from the source file.

### 4.4 Configuration Documentation

Every configurable value — environment variable, configuration file entry, feature flag — is documented with:
- The key name
- The type and allowed values
- The default value (if any)
- What the value controls
- Whether changing it requires a process restart
- Whether it is sensitive (a secret that must not be logged)

Undocumented configuration values are discovered only when they are missing or incorrect in production — the worst time to discover them.

---

## 5. Architecture Documentation

### 5.1 The Constitution Is the System's Architectural Memory

The `.constitution/` documents represent the accumulated architectural knowledge of the Void project. Every layer, every component type, every cross-cutting concern, every design rule is documented here. The constitution is the first place any engineer — human or AI — looks when making a design decision.

The constitution is not a historical archive — it is the current, authoritative statement of how the system is designed. When an architectural rule changes, the constitution changes first.

### 5.2 System Architecture Diagrams Are Maintained

Diagrams that illustrate the system's structure — the layers, the component relationships, the data flow, the deployment topology — are maintained as first-class artifacts. Diagrams are stored in the repository alongside the code they describe. A diagram that is not in the repository is a diagram that will drift from reality.

Diagrams are reviewed as part of code review when the structural change they illustrate is made. A structural change without a corresponding diagram update is a documentation gap.

### 5.3 Sequence Diagrams for Complex Flows

Complex multi-component flows — session establishment, message delivery, reconnection — are documented with sequence diagrams that show the component interactions, the message contents, and the timing. A sequence diagram for a complex flow makes the flow understandable in minutes; reading the code to reconstruct the flow takes hours.

Sequence diagrams are maintained alongside the code they describe. They are updated when the flow changes.

### 5.4 Dependency Graphs Are Documented

The dependency relationships between components — which Services depend on which Repositories, which Managers depend on which components — are documented. The documentation does not need to be exhaustive at the level of individual method calls — it must capture the significant structural dependencies at the component level.

A dependency that is not documented is a dependency that may be inadvertently duplicated or introduced as a cycle without anyone recognizing the pattern.

### 5.5 Cross-Cutting Concerns Are Centrally Documented

Cross-cutting concerns — authentication, authorization, rate limiting, caching, logging, error handling — are documented in their own constitution documents rather than distributed across the components that implement them. An engineer who needs to understand how caching works in Void reads `18-cache-policy.md` — they do not need to read every Service and Manager to reconstruct the caching patterns.

---

## 6. Public Documentation

### 6.1 Public Documentation Addresses Users and Integrators

Public documentation — documentation accessible to users, API consumers, and external integrators — has a different audience and tone from internal documentation. Public documentation:
- Uses accessible language without internal jargon
- Explains outcomes and behaviors — not implementation details
- Provides working examples for every capability
- Addresses the reader's goals — what they are trying to accomplish — not the system's structure

### 6.2 Public Documentation Is Tested With Examples

Every code example in public documentation — API request examples, SDK usage examples, configuration snippets — is tested against the actual system to verify it is correct and current. A documented example that does not work destroys the reader's trust and wastes their time.

Public documentation examples are executed as part of the CI pipeline. A failing example is a documentation bug that fails the build.

### 6.3 Changelog Is Maintained

A public changelog is maintained that records:
- Every API change (new endpoints, changed behavior, deprecated elements)
- Every breaking change with migration guidance
- Every significant bug fix with a description of the fixed behavior
- The version and date of each release

The changelog is written for the people who use the system — not for internal engineering reference. It answers: "what do I need to know about this release?"

### 6.4 Public Documentation Is Version-Aware

When the system has multiple active API versions, the public documentation is versioned accordingly. A reader of the v2 documentation must not encounter information about v1-only behavior without clear labeling. Version confusion in public documentation produces integration bugs that are difficult to diagnose.

---

## 7. Commenting Rules

### 7.1 Comments Explain Why, Not What

Code already shows what it does — the reader can see the statements. Comments add value by explaining what the code cannot show: why this approach was chosen, what constraint the code is working around, what assumption makes this safe, what failure mode this guards against.

**Explains what (no value):**
```typescript
// Increment the retry count
retryCount++;
```

**Explains why (adds value):**
```typescript
// Increment before the attempt, not after, so that a crash
// during the attempt does not lose the attempt count.
retryCount++;
```

### 7.2 Comments Are Written in Complete Sentences

A comment is a piece of writing. It is written in a complete sentence with correct grammar, punctuation, and spelling. Fragment comments — "// check null", "// TODO fix this" — are not adequate. A complete sentence takes five more seconds to write and takes significantly less time to understand.

### 7.3 TODO Comments Have Owners and Deadlines

A `TODO` comment without an owner and deadline is a permanent note that will never be acted on. The format for TODO comments is:

```typescript
// TODO(owner): Description of what needs to be done.
// Tracking: <issue URL or identifier>
// Deadline: YYYY-MM (the sprint or milestone by which this must be resolved)
```

A TODO comment without this information is not merged. A TODO comment whose deadline has passed is treated as a failing test — it must be resolved or explicitly extended.

### 7.4 Do Not Comment Out Code

Commented-out code is dead code that confuses readers ("is this disabled intentionally or accidentally?"), obscures the actual code, and is never deleted because "it might be needed someday." If code is no longer needed, it is deleted. Version control preserves the history. If code is disabled temporarily, the reason and the removal plan are in a TODO comment with an owner and deadline.

### 7.5 Complex Logic Gets Algorithmic Comments

When a function implements a non-trivial algorithm or a counter-intuitive approach, the comment explains the algorithm at the level of a pseudocode summary or a reference to the source of the approach. A reader who understands the algorithm at a conceptual level can verify the implementation; a reader who must reverse-engineer the algorithm from the code alone will take much longer.

```typescript
// Uses the Fisher-Yates shuffle (Knuth, TAOCP Vol. 2, §3.4.2)
// to produce an unbiased random permutation in O(N) time.
// The standard array-sort approach introduces sorting bias.
function shuffle<T>(array: T[]): T[] { ... }
```

### 7.6 Type Assertions and Non-Obvious Casts Are Explained

When TypeScript's type system is overridden — a type assertion (`as SomeType`), a non-null assertion (`!`), a type guard bypass — the comment explains why the assertion is safe and what invariant guarantees it:

```typescript
// Safe: this branch is only reached when session.account is not null,
// guaranteed by the SessionService.load contract (see SessionService.ts:145).
const account = session.account!;
```

An unexplained type assertion is a maintenance trap — future engineers will not know whether removing it is safe.

---

## 8. Markdown Standards

### 8.1 All Documentation Files Use Markdown

All documentation in the `.constitution/` directory, all README files, all API documentation narratives, and all ADRs use Markdown with consistent formatting. Consistent formatting makes all documents readable with the same tooling and ensures that documentation renders correctly on GitHub and in other Markdown viewers.

### 8.2 Document Structure

Every documentation document follows this structure:

```markdown
# [Document Title]

> **Status:** Official | Draft | Deprecated
> **Scope:** What this document covers
> **Authority:** What this document governs

---

## Table of Contents
[Section links]

---

## 1. [Section]
### 1.1 [Subsection]

[Content]
```

The status, scope, and authority header is mandatory for all constitution documents. It immediately communicates whether the document is current, what it applies to, and what decisions it governs.

### 8.3 Heading Hierarchy Is Strict

Headings follow a strict hierarchy: `#` for the document title, `##` for primary sections, `###` for subsections, `####` for sub-subsections. No heading level is skipped. A `###` heading does not appear without a `##` heading for its parent.

### 8.4 Tables Are Used for Structured Comparisons

When comparing options, enumerating error codes, listing configuration values, or presenting any information that has two or more correlated dimensions, a Markdown table is used. Tables make structured information scannable. Prose that lists the same information is harder to scan and harder to compare.

### 8.5 Code Blocks Specify Their Language

Every code block specifies its language for syntax highlighting:

````markdown
```typescript
const result = await service.findById(id);
```
````

A code block without a language specifier renders without syntax highlighting and is harder to read.

### 8.6 Links Are Relative and Repository-Local

When a document references another document within the repository, it uses a relative link — not an absolute URL. Relative links remain valid when the repository is forked, cloned, or accessed through any host. Absolute URLs to `github.com` break for users accessing the repository through a mirror or an internal Git host.

### 8.7 Documents Are Written for 80-Column Line Width

Markdown source is written with soft line wrapping at approximately 80 characters per line. Extremely long lines make raw Markdown difficult to diff and review. Documents written with one-sentence-per-line are easier to review — line changes correspond to sentence changes.

---

## 9. Update Policy

### 9.1 Documentation Is Updated Atomically With Code

When a code change affects documented behavior — a new method is added to a Service, a new error case is introduced, a configuration option is changed — the documentation is updated in the same commit as the code change. Documentation updates are not deferred to a follow-up commit or a "documentation sprint."

A commit that changes code without updating the documentation that describes it is a commit that creates documentation debt. Documentation debt is not acceptable.

### 9.2 Document Change Frequency Determines Update Mechanism

| Document Type | Update Trigger |
|---|---|
| API specification (OpenAPI) | Any API interface change |
| Service documentation | Any public method signature or behavior change |
| Constitution documents | Any change to the architectural rule or policy |
| Architecture diagrams | Any structural change to the component being depicted |
| Code comments | Any change to the code the comment describes |
| Public changelog | Every release |
| ADRs | Never modified — new ADR supersedes old one |

### 9.3 Stale Documentation Is Deleted, Not Left

When code is deleted, the documentation that described it is deleted in the same commit. A function that no longer exists with a docstring that describes a function that no longer exists is stale documentation. Stale documentation misleads readers who assume all documentation is current.

When a constitution document is superseded, the old document is marked as deprecated — not left as if it were current. A deprecated document contains a header:

```markdown
> **Status:** Deprecated
> **Superseded by:** [link to new document]
> **Deprecated on:** YYYY-MM-DD
```

### 9.4 Documentation Review Is Part of Code Review

Code reviewers are responsible for verifying that documentation is updated alongside code changes. A review that approves a code change affecting a public interface without verifying the API documentation has been updated has reviewed incompletely. Documentation review is as important as logic review.

### 9.5 The Constitution Is Reviewed Quarterly

The constitution documents are reviewed as a set on a quarterly cadence. The review verifies:
- All documents accurately reflect the current state of the system
- No architectural decisions have been made that are not yet documented
- No documents reference components or patterns that no longer exist
- The set of documents is complete — no significant architectural concern is unaddressed

---

## 10. Documentation Ownership

### 10.1 Every Document Has an Owner

Every document — from a Service docstring to a constitution policy — has an owner: the team or individual responsible for keeping it current. Ownership is not exclusive authorship — anyone may update a document — but the owner is accountable for the document's accuracy and currency.

When code changes affect documented behavior and the author does not update the documentation, the document owner is responsible for catching the gap in review and ensuring the documentation is updated before the change is merged.

### 10.2 The Constitution Is Collectively Owned

The constitution documents are owned by the engineering team collectively. No single person owns a constitution document exclusively. Changes to constitution documents require review by at least two engineers beyond the author — because constitution changes affect every decision made in the system going forward.

### 10.3 New Components Require Documentation Owners

When a new component — a new Service, a new Manager, a new layer — is introduced, a documentation owner is designated before the component is merged. A component without a documentation owner will accumulate undocumented behavior over time.

---

## 11. Best Practices

1. **Write documentation at the moment of decision, not the moment of implementation.** The time to document why a decision was made is when the decision is fresh — when the alternatives considered, the constraints weighed, and the trade-offs accepted are still in the author's working memory. Documentation written weeks later reconstructs less accurately.

2. **Use the reader's vocabulary, not the author's.** Documentation written using the author's internal model of the system — jargon they developed while building it, acronyms they invented — is documentation that requires decoding. Write using terms the reader already understands or terms that are explicitly defined in the document.

3. **Prefer examples to abstract descriptions.** A concrete example of what an API endpoint returns, what a Service method accepts, what a configuration value controls, communicates faster and more accurately than an abstract description. Every documented interface has at least one example.

4. **Keep documentation close to what it documents.** A Service's documentation lives in the Service's file. A configuration variable's documentation lives in the configuration definition file or schema. Documentation that is physically distant from what it describes drifts from the code when the code changes and the distant documentation is not found.

5. **Delete documentation that cannot be kept current.** A document that is outdated and has no owner who will maintain it is worse than no document. It misleads readers. Delete it and let the code speak for itself.

6. **Review your own documentation as a reader, not the author.** Before submitting a documentation change, read it as if encountering it for the first time — without the context of having written it. Ask: is this clear? Is it complete? Is there any assumption it makes that a new reader would not share?

7. **Treat documentation errors as bugs.** A documentation error — a wrong type in an API spec, an incorrect description of a method's behavior, an ADR that does not match the actual implementation — is a bug. It is tracked, prioritized, and fixed like any other bug. Documentation errors are not "just docs."

---

## 12. Anti-Patterns

### 12.1 The Explanation-Free ADR

An ADR that records a decision without recording the rationale — "we decided to use cache-aside." Why? What were the alternatives? What made them unsuitable? An ADR without rationale is a statement, not a record. A statement cannot be evaluated when circumstances change.

### 12.2 The Omnibus Comment

A function or class with a 200-line comment that attempts to explain every aspect of its behavior, its history, its edge cases, and its future plans. The comment becomes the documentation for the code rather than a supplement to it. When the code changes, the comment is rarely updated in full. Long, comprehensive comments drift and mislead. Keep comments focused.

### 12.3 The Outdated Example

An API documentation example, a README code snippet, or a getting-started guide that demonstrates behavior from a prior version and no longer works with the current API. Outdated examples are the most common reason developers abandon documentation and try things by trial and error. Examples are tested in CI.

### 12.4 The Documentation Sprint

Accumulating documentation debt for an entire development cycle with the plan to "document everything in a documentation sprint at the end." Documentation sprints never fully close the debt — there is always more code than time — and the documentation written weeks or months after the decisions were made is less accurate. Documentation is written alongside the code it documents.

### 12.5 The Private Vocabulary Document

A document — typically a glossary or architecture overview — that invents project-specific terminology without defining the terms, assuming readers already know them. New readers cannot use the document without a translator. Terms are defined on first use. A glossary in the constitution defines project-specific terms.

### 12.6 The Architecture Diagram That Lives in Someone's Head

An architectural decision or a system structure that is understood by the engineer who built it but exists nowhere in writing or diagrams. "Just ask Sarah — she knows how the reconnection flow works." When Sarah leaves, the knowledge leaves with her. Architecture that lives in people's heads is architecture that is undocumented.

---

## 13. Forbidden Documentation Practices

### 13.1 Shipping Code With Undocumented Public Interfaces

A public Service method, a public API endpoint, or a public configuration option that is not documented in the appropriate location is not shippable. Public interfaces without documentation are interfaces that callers cannot use correctly.

### 13.2 Documenting Non-Existent Behavior

Documentation that describes behavior the code does not implement — aspirational documentation, documentation of planned features, documentation that was not updated when the code was changed — is actively misleading. Document what the code does, not what it should do. Future plans belong in issue trackers.

### 13.3 Modifying an Accepted ADR

Editing an ADR that has already been accepted and implemented to change the decision or rationale it records. The ADR is a historical record. Changing it retroactively falsifies the history. If the decision has changed, a new ADR is written that supersedes the old one.

### 13.4 Documentation Locked Outside the Repository

Documentation that exists only in an external wiki, a Google Doc, a Notion page, or any system that is not the code repository is documentation that will drift from the code. When the code changes, the external documentation is not updated in the same commit — because it is not part of the commit. All authoritative documentation lives in the repository.

### 13.5 The Copyright-Year-Only Comment File Header

Source file headers that contain nothing except a copyright year and license notice — no description of what the file does — are noise. File headers are used only when a file genuinely requires a license header for legal reasons. Otherwise, the file's purpose is documented through its first docstring or JSDoc comment.

---

## 14. AI Documentation Rules

This section defines how an AI system must approach documentation when generating or modifying code in Void.

### 14.1 The AI Must Document Every New Public Interface

When the AI generates a new Service method, a new Repository method, a new API endpoint, or any other public interface, it must simultaneously generate the full documentation for that interface: purpose, parameters, return value, and every error case. An undocumented public interface is an incomplete deliverable. The AI must not defer documentation to a follow-up.

### 14.2 The AI Must Generate ADRs for Architectural Decisions

When the AI makes an architectural decision — chooses one design pattern over another, introduces a new layer abstraction, establishes a new dependency relationship — it must generate an ADR documenting the decision. The ADR is generated alongside the code that implements the decision. The AI must not implement architectural decisions without documenting them.

An AI-generated ADR includes:
- **Context:** Why this decision was needed
- **Decision:** What was decided, stated clearly
- **Rationale:** Why this approach was chosen over the alternatives the AI considered
- **Consequences:** What the decision means for future work in this area

### 14.3 The AI Must Add Why-Comments for Non-Obvious Code

When the AI generates code that makes a non-obvious choice — uses a particular algorithm, works around a library limitation, handles a specific edge case — it must add a comment explaining why. The AI must not generate code whose reasoning is invisible. A future engineer reading the code must be able to understand the choice without reverse-engineering it.

### 14.4 The AI Must Update Documentation When Changing Code

When the AI modifies existing code, it must identify all documentation that describes the modified code and update it. Modifying a Service method's behavior without updating the Service's documentation, the API spec (if the method has an API surface), and any ADR that describes the design of that method is an incomplete modification.

### 14.5 The AI Must Not Generate Aspirational Documentation

The AI must document what the code it generates actually does — not what it plans to do, not what it might do, not what would be ideal. Documentation that describes planned behavior as if it were implemented behavior is actively misleading. The AI writes documentation for the code as it exists in the generated output.

### 14.6 The AI Must Use the Project's Defined Vocabulary

When the AI generates documentation, it uses the terminology defined in the constitution — Service, Manager, Repository, Command, Plugin, Facebook Layer — not synonyms or external terminology that might mean different things in different contexts. Consistent vocabulary across all documentation reduces ambiguity and makes the entire document set coherent.

### 14.7 The AI Must Flag Missing Documentation It Cannot Supply

When the AI generates code that requires documentation it cannot produce — for example, a new architectural decision whose context requires knowledge of historical decisions the AI does not have — it must explicitly flag the documentation gap and describe what information is needed to fill it. The AI must not silently produce underdocumented code on the grounds that it lacked information.

### 14.8 The AI Must Update the Constitution for Policy Changes

When the AI makes a change that constitutes a policy change — a new rule about how a layer is used, a new constraint on a component type, a new pattern that all future components must follow — it must propose an update to the relevant constitution document. Architectural policy that exists in the code but not in the constitution is policy that will not be followed by the next engineer who encounters the same design problem.

### 14.9 The AI Must Produce Documentation the Reader Can Trust

Documentation the AI generates must be precise, accurate, and verifiable against the code it describes. The AI must not generate documentation with hedging language ("approximately," "in most cases," "generally speaking") for behavior that is defined and deterministic. Hedging documentation cannot be trusted and will be ignored.

### 14.10 The AI Must Apply the Audience Test

Before finalizing generated documentation, the AI must apply the audience test: "would the on-call engineer encountering this at 3 AM, without prior context, understand what this does and why?" If the answer is no — the documentation is too abstract, uses undefined terms, or omits the critical context — the documentation must be revised before delivery.

---

## 15. Review Checklist

Use this checklist for every code review that introduces or modifies documented components.

### Completeness
- [ ] Every new public method has complete documentation: purpose, parameters, return value, and all error cases
- [ ] Every new API endpoint is documented in the OpenAPI specification with all fields, response shapes, and error codes
- [ ] Every new configuration option is documented with type, default, behavior, and sensitivity classification
- [ ] Every new architectural decision has a corresponding ADR or constitution update

### Accuracy
- [ ] Documentation describes the code as it exists — not as it is planned or hoped to be
- [ ] All code examples in documentation have been verified to work
- [ ] Error codes and types in documentation match what the code actually returns
- [ ] No behavior is described that the code does not implement

### Currency
- [ ] Documentation for modified interfaces has been updated in the same commit
- [ ] Deleted code has had its documentation deleted in the same commit
- [ ] ADRs for superseded decisions are marked as deprecated with a reference to the new ADR
- [ ] No stale documentation exists for code that has changed

### Comments
- [ ] Comments explain why, not what
- [ ] TODO comments have an owner, a tracking reference, and a deadline
- [ ] No commented-out code is present
- [ ] Complex algorithms have explanatory algorithmic comments
- [ ] Type assertions have comments explaining why the assertion is safe

### Markdown Standards (for `.constitution/` documents)
- [ ] Document has the Status / Scope / Authority header
- [ ] Heading hierarchy is strict — no skipped levels
- [ ] All code blocks specify their language
- [ ] All internal links are relative
- [ ] Tables are used for structured comparisons and catalogues

### Update Policy
- [ ] Documentation update is in the same commit as the code change
- [ ] No documentation is deferred to a follow-up
- [ ] Stale documentation has been deleted, not left alongside correct documentation

### AI-Generated Documentation Specific
- [ ] Documentation reflects the generated code — not aspirational behavior
- [ ] ADR is present for any architectural decision in the change
- [ ] Why-comments are present for all non-obvious code
- [ ] The project's defined vocabulary is used throughout
- [ ] The documentation passes the audience test (clear to an engineer without prior context)

---

*This document is the official and sole reference for documentation practices in Void. Every important architectural decision must be documented before it can be considered complete. Every public interface must be documented before it can be shipped. Documentation is not a courtesy — it is the mechanism by which the system's design survives the departure of any individual engineer and remains comprehensible to the AI systems that help build it. An undocumented system is a system that must be reverse-engineered by every engineer who encounters it. A documented system is a system that teaches itself.*
