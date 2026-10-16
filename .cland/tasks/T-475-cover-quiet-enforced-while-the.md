---
id: T-475
kind: task
title: "Cover-quiet enforced: while the Coordinator's integrated cover holds the slot, the test harness refuses to start a fixture hub"
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-579
blocked_by: []
topic: topic-401
branch: t/T-475-cover-quiet-enforced-while-the
created: 2026-10-15T09:13:18.684Z
updated: 2026-10-16T17:20:02.362Z
---

## Summary

Retrospective A-2783, STOP 1: all 7 flaky red covers had other sessions' test runs beside them. The cover-quiet rule (2026-10-15) is an agreement. Make it a refusal: a test process outside the cover itself does not start while an integrated cover runs.

## What to build

`hub/test/harness.ts` and `nvim/test`'s runner ask the project's hub (`suite.slot` read-only) at start. When the local holder is an integrated run, the process exits with a `cover-quiet` message naming the run, unless it is that run's own worker (an inherited lease) or `CLAND_TEST_IGNORE_COVER=1` is set by the human. Without a hub, there is no refusal.

## Acceptance criteria

- [ ] C1. A targeted test started while an integrated cover holds the local slot exits with `cover-quiet` before starting any fixture.
  - failed: rev-30 [reviewer] · 2026-10-16T17:20:02.362Z · note Connected-hub timeout/close is treated as admission, so a busy integrated cover can be bypassed. A-4055 M2.
- [ ] C2. The cover's own workers and runs without a project hub are unaffected.
  - failed: rev-30 [reviewer] · 2026-10-16T17:20:02.362Z · note Copied-source coverage fixture lacks the newly imported cover-quiet.ts helper, breaking harness startup. A-4055 M1.
- [ ] C3. docs/agents/tests.md and the Implementer clause describe the refusal and the human's override.

## Comments

### impl-475 · 2026-10-16T17:13:16.426Z

Implementation seams follow C1/C2: real suite.slot read-only socket admission and fresh targeted hub/Neovim harness subprocess startup (before fixture creation). Inherited worker identity will be checked against the live compatibility lease. Holding local test execution while Coordinator confirms census-575 quiet-window status.

### impl-475 · 2026-10-16T17:19:41.782Z

Source review requested from Reviewer at pushed 8b8505c3ecd518f3ddc037df78779ab9c771fec8 (supersedes 14aa7a6b; fixture receipts now under ignored .cland/). npm run typecheck exit 0 and diff check exit 0. Local targeted execution remains held by Coordinator census quiet decision; review allowed during that window. Evidence artifact A-4051 describes scope and hold.

### rev-30 · 2026-10-16T17:20:02.362Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-475-source
commit: 8b8505c3ecd518f3ddc037df78779ab9c771fec8
scope: full
findings: [{"severity":"medium","text":"M1: New ./cover-quiet.ts harness dependency is absent from suite-coverage.test.ts's copied helper list, so its copied real harness cannot import before daemon/CLI/spoke coverage proof. Update the source closure and validate the whole affected file, preserving assertions.","file":"hub/test/harness.ts","line":6},{"severity":"medium","text":"M2: Request timeout or socket close before answer silently admits targeted tests. A busy live hub can hold an integrated cover while taking over 3 s, allowing fixture startup during that cover. Keep no-hub behavior but refuse unknown connected-hub admission and add a delayed-response regression, or obtain explicit Coordinator policy disposition.","file":"hub/src/test-admission.ts","line":21}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-475 source review — not clear

Head 8b8505c3ecd518f3ddc037df78779ab9c771fec8; fixed point 5bd54127e8d2f2b4b938a9c1fa16d63c93f9d58f. Replacement request 16e8289f was inspected before posting a verdict. The delta from 14aa7a6b only tightens the check flag, moves worker receipts under ignored .cland/ and relocates a comment; neither finding is changed. A-4054 is the preliminary review note at the superseded head, not a recorded verdict. Both Standards and Spec axes reviewed in-session because this Reviewer role prohibits delegation.

## Standards
Medium M1 — hub/test/harness.ts:6 and hub/test/account-fixture-env.ts:3 introduce a required runtime import of ./cover-quiet.ts, but hub/test/suite-coverage.test.ts:45 copies a closed helper list containing harness.ts and account-fixture-env.ts without cover-quiet.ts. Its real fixture imports the copied harness and therefore fails module resolution before its daemon/CLI/spoke coverage assertions can run. hub/src is already copied, so add the new test helper to that fixture's source closure (or remove the missing dependency another way), retain all existing coverage assertions, and include the affected whole file in validation. This is established by the pinned source graph, not a Reviewer-executed reproduction.

No other Standards findings. The read-only check uses the existing authenticated frame path and compatibility-holder seam, adds no slot reservation, and normal actor-owned human slot refusal remains. Inherited pid/start/token are compared with the live holder; integrated metadata survives package borrowing. Protocol/config duration changes are narrow. The new tests retain completion receipt before downstream report wait. The original diff whitespace check passes; the replacement delta has no whitespace concern.

## Spec
Medium M2 — hub/src/test-admission.ts:21 treats a three-second request timeout or socket close before an answer as successful admission. A live project hub can be busy while an integrated cover owns the machine slot; in that case these catches let the targeted process continue into fixture setup without checking the cover. This defeats C1 under the load the task is intended to protect. The specified no-hub exception supports absent/refused connections, not positive admission on an unanswered live hub. Keep standalone/no-hub behavior, but make unknown admission after a connected hub times out/ends fail visibly rather than silently pass; add a delayed/non-answering live-socket regression that verifies fixture setup stays unstarted. If fail-open on a live hub is deliberate policy, obtain the Coordinator's explicit spec disposition before clearance.

Otherwise the design covers the requested behavior: read-only suite.slot check is available to session CLI callers, scheduler consults integrated local holder metadata rather than remote slots, exact inherited worker lease exempts the cover's own workers, and ordinary local holders do not refuse targeted tests. Hub/account fixture initialization shares a top-level awaited guard; Neovim imports that harness. The package runSuite entry checks before runner-root creation. The human-only override is an explicit environment convention documented in tests.md and the shipped Implementer clause (C3 source text reviewed).

## Validation / criteria
The request reports exact-head root typecheck exit 0. Targeted tests have deliberately not run during the Coordinator's census quiet window, per decision 0d34b6b6; no missing-test failure or request to break that hold is inferred. C1 fails for M2 and C2 fails for M1's copied-harness integration break. C3 has the requested source text but is not separately marked on this not-clear pass. New corrected-head source review and the held whole-file proof are required before task verification. No per-item QA criteria.

Standards: 1 medium. Spec: 1 medium.
Review artifact A-4055.

Criteria: C1 failed (Connected-hub timeout/close is treated as admission, so a busy integrated cover can be bypassed. A-4055 M2.), C2 failed (Copied-source coverage fixture lacks the newly imported cover-quiet.ts helper, breaking harness startup. A-4055 M1.).
