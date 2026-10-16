---
id: T-608
kind: task
title: Rule titles are cut at 80 characters silently and rule.edit cannot change a title
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-611
blocked_by: []
topic: topic-392
branch: t/T-608-rule-titles-are-cut-at-80-characters
created: 2026-10-16T12:50:58.048Z
updated: 2026-10-16T17:39:20.327Z
closed: 2026-10-16T17:39:20.327Z
---

## Summary

`rule.add` (and `cland rule add`) truncates a rule's title to 80 characters without saying so, and `rule.edit` has no title field, so a truncated title cannot be repaired. Seen in the onboarding live try (2026-10-16, sandbox-empty): the rule "The crew decides the stack, the architecture, the test strategy and every other technical question…" became "…and every other".

## Expected

Either the title limit is announced in the tool's description and the add result (and the full text stays in the body), or the limit is lifted; `rule.edit` can change a title.

## Acceptance criteria

- [x] C1. rule.add and cland rule add keep the whole title, or refuse a title over the documented limit with the limit named, never truncating silently, proved by a test.
  - done: impl-608 · 2026-10-16T16:10:47.296Z
  - verified: rev-30 [reviewer] · run rev-20261016-608-source · 2026-10-16T16:12:52.193Z · commit 1b2effa5a473e57081ad2eacdddce8f44380223c
  - verified: rev-30 [reviewer] · run rev-20261016-608-final · 2026-10-16T17:38:44.238Z · commit 1b2effa5a473e57081ad2eacdddce8f44380223c
- [x] C2. rule.edit and cland rule edit can change a rule's title, and the change reaches running sessions as a rule event, proved by a test.
  - done: impl-608 · 2026-10-16T17:38:18.303Z
  - verified: rev-30 [reviewer] · run rev-20261016-608-final · 2026-10-16T17:38:44.238Z · commit 1b2effa5a473e57081ad2eacdddce8f44380223c

## Comments

### impl-608 · 2026-10-16T16:08:05.372Z

Implementation plan: preserve the full first-line default title (explicit titles already preserve length); add optional title to rule.edit and cland rule edit, retaining validation and existing rule-event delivery. Regression coverage for long titles and title-only edits through MCP and CLI.

### impl-608 · 2026-10-16T16:10:49.923Z

Implemented and pushed 1b2effa5a473e57081ad2eacdddce8f44380223c after fetching/merging origin/dev. C1: full derived/explicit titles through MCP and CLI. C2: validated title-only edits persist and emit changed titles; fake Implementer input proves next-turn delivery. Typecheck exit 0 at committed head; rule-sessions 8/8, rule-cli 7/7. Evidence A-3972 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3972-t-608-implementation-and-targeted-validation.md. New test 0.99 s; no new >5 s test or renamed allowance.

### rev-30 · 2026-10-16T16:12:52.193Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-608-source
commit: 1b2effa5a473e57081ad2eacdddce8f44380223c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-608 source review

Commit 1b2effa5a473e57081ad2eacdddce8f44380223c; fixed point 33a932551129804a9545c882955d426b7505564b. Local and origin task tips agree. Eight-file implementation reviewed against T-608 and v0.1.4 §3.5. Both axes performed in-session because delegation is disabled for this role.

## Standards
No findings. Validation stays at the existing rulebook seam: titles remain nonempty single-line strings, invalid writes never reach rename, and read/write authorization rechecks are unchanged. Optional title is threaded through the existing typed protocol, wire validation, MCP schema, CLI allowlist/help and shell dispatch rather than creating another mutation path. Diff whitespace check passes.

## Spec
C1 established by source: add now derives the whole first line without the 80-character slice; explicit long titles and full rule bodies remain preserved. Rulebook serialization and parser contain no replacement length limit. The new integrated test covers both derived and explicit long titles through real MCP and CLI calls.

Title-only editing is accepted independently of text/scope/reason and validated with singleLine before persistence. CLI forwards its allowed title option; MCP forwards its validated frame; the shared writer returns the parsed committed rule. The regression checks unchanged text/reason and correct origin, persisted heading and listing, and refuses empty/whitespace/newline/carriage-return titles without modifying the rulebook.

The existing rule-change comparison already detects title changes. Active rule notices append the new title only when it changed, retain scope-aware recipients and next-turn digest delivery, and do not add a new wake/needs-you path. The new test checks one background rule event to the running Implementer for each tool/CLI title edit. The extended existing native fake Codex test proves the new Title line reaches its next input while retaining no-steer, scope, retirement and event-row assertions.

## Evidence and criteria
A-3972 is the claimant's summarized exact-head validation: typecheck exit 0, rule-sessions 8/8 and rule-cli 7/7 in separate files; the new test measured 0.99 seconds. It documents the original derived-title truncation reproduced before the change. No raw log bundle or Reviewer-run test is claimed.

Source clear, zero findings; C1 source verified. C2's final running-session execution evidence remains pending normal same-head cland verify, including the new test's repetitions. No per-item QA is required and no new allowance is introduced.

Standards 0 findings; Spec 0 findings.
Artifact: A-3982 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3982-t-608-source-clear-complete-titles-and-title-only-rule-edits.md

Criteria: C1 verified.

### impl-608 · 2026-10-16T16:58:59.063Z

Verification 6ee9b87c / A-4041 at 1b2effa5 failed outside the diff: aide.test closed-database Sessions.#inject (T-573 signature), daemon.test unexpected verification-wait log, suite-timeouts.test cleanup-warning deadline. Full/local: 1946/1949 pass; peak load 19.45. New rule-title regression passed 5/5 load repetitions and normal execution; native title event delivery passed. Reported to lead T-608 and holding diagnosis/head pending shared-fix or rerun direction.

### rev-30 · 2026-10-16T16:59:01.577Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-608-local-red
commit: 1b2effa5a473e57081ad2eacdddce8f44380223c
scope: evidence
findings: [{"severity":"medium","text":"M1: Overall task gate is red on three external failures (Aide closed database, shutdown event ordering, cleanup-warning timeout); full-mode Neovim was not reached. Own rule-title cases pass, including 5/5 new-case repetitions. Await lead/Coordinator classification and gate disposition.","file":"hub/test/aide.test.ts","line":54}]
finding_counts: {"high":0,"medium":1,"low":0}

T-608 final evidence not clear at unchanged source-reviewed 1b2effa5a473e57081ad2eacdddce8f44380223c. Source clearance A-3982 remains applicable.

Independently inspected A-4041, run 6ee9b87c-a302-4100-8ef9-5995a8169bee. Local fallback on darwin arm64 completed only the hub phase: 1949 tests, 1946 pass, three failures, no skips. Full mode was selected by protocol.ts, but Neovim was not reached. Suite 1297.67 s, queue wait 1393.82 s, peak load 19.45. No hard budget or failed load-gate line appears in the full log.

Owned evidence is green: all eight rule-sessions tests pass. New long-title/title-only-edit test is 1.410 s ordinarily and 5/5 fresh repetitions (line 2491); the extended fake Implementer next-turn/event/no-steer proof is 5.693 s. These establish the changed behavior but do not make the overall failed task gate clear.

Medium M1 — final gate incomplete due to three external failures, pending lead/Coordinator classification and gate direction:
- hub/test/aide.test.ts:54: fake Claude Aide hook-exit test raises ERR_INVALID_STATE, database is not open, at processes.ts:214 via Sessions.#inject and its continuation (A-4041:4375–4384).
- hub/test/daemon.test.ts:417: exact shutdown-event assertion includes unexpected verification-wait between socket-kept and stopped (A-4041:4386–4407).
- hub/test/suite-timeouts.test.ts:175: one cleanup warning not within 15000 ms (A-4041:4409–4415).

These test files are outside this change; no historical causality or known-defect identity is inferred. C1 source verification stands. C2 final acceptance remains unverified because the gate is red and Neovim missing. No unchanged retry, source change, extra suite or shared-fix pick is requested by this review; classification and next action belong to the item lead/Coordinator.
Artifact A-4042.

Criteria: C2 failed (Final task gate red on three external failures; own title-edit evidence green, Neovim not reached. Classification and gate direction pending; A-4042.).

### impl-608 · 2026-10-16T17:38:22.582Z

Coordinator-authorized unchanged-head explicit-droplet retry e741fa23 / A-4079 is green at 1b2effa5: full Linux c-8, exit 0, 2334 passed, 0 failed, 8 platform skips; hub and Neovim phases completed. C2 claimant done restored and final evidence review requested. Reviewed source/head remain unchanged. Receipt lifetime/cost unknown.

### rev-30 · 2026-10-16T17:38:44.239Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-608-final
commit: 1b2effa5a473e57081ad2eacdddce8f44380223c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-608 final evidence clear at unchanged source-reviewed 1b2effa5a473e57081ad2eacdddce8f44380223c. Source A-3982 remains applicable; no findings.

Independently inspected A-4079, Coordinator-authorized retry e741fa23-2e93-4833-b097-e1f88705c271. Header names the exact head. Host/remote typechecks and both full hub and full Neovim phases complete: hub free 38/38; hub machine 1906 pass, zero fail, five prerequisite skips; Neovim 390 pass, zero fail, three macOS sandbox skips. Aggregate 2342 tests, 2334 pass, zero fail, eight skips, Finished exit 0. No hard budget/load-gate failure.

C1/C2: all eight rule-sessions cases pass. The new real tool/CLI long-title and title-only-edit regression passes ordinarily in 2.086 s and 5/5 fresh repetitions (A-4079:2601). It retains complete titles, validates malformed writes atomically, checks unchanged rule text/reason and scope, and requires title-change notices for running sessions. The extended fake Implementer next-turn proof passes in 8.368 s with its title line, no-steer, scope/retirement and event-row assertions retained. This supplies C2's running-session delivery execution proof alongside source C1.

The earlier local receipt A-4041 remains an honestly recorded failed run; this successful same-head droplet receipt resolves its outstanding final gate and reaches the previously missing Neovim phase. Claimant reports C2 done restored in request 6b9911d7; no head change or dev merge.

Linux x64 c-8 lon1, Node 24.21.0, Neovim 0.12.5, four workers; suite 1408.65 s, peak load 15.31. Droplet lifetime/cost are unknown in the receipt, not inferred. Eight skips concern platform/binary prerequisites, not owned title cases. Both criteria verified; no per-item QA requirement.
Review artifact A-4082.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-16T17:39:20.327Z

Merged 14a493d2fd233ff7c922aacfa137fcd6af6edd4a onto dev.
