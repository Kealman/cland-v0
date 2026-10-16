---
id: T-475
kind: task
title: "Cover-quiet enforced: while the Coordinator's integrated cover holds the slot, the test harness refuses to start a fixture hub"
state: open
status: review
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
updated: 2026-10-16T17:24:56.427Z
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
  - verified: rev-30 [reviewer] · run rev-20261016-475-correction · 2026-10-16T17:22:51.722Z · commit 8d39a241e8c7c144eafa211b52d71c09e0650c15
  - verified: rev-30 [reviewer] · run rev-20261016-475-capability-delta · 2026-10-16T17:24:34.251Z · commit de7d1927ee8ed91fc648b857d585628cb81f1fcb

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

### rev-30 · 2026-10-16T17:22:51.722Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-475-correction
commit: 8d39a241e8c7c144eafa211b52d71c09e0650c15
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-475 corrected source review

Clear at 8d39a241e8c7c144eafa211b52d71c09e0650c15, delta from reviewed 8b8505c3; first review fixed point remains 5bd54127e8d2f2b4b938a9c1fa16d63c93f9d58f. Origin task tip matches. Both axes reviewed in-session under the role's no-delegation constraint.

## Standards
No findings. M1 resolved: suite-coverage.test.ts now copies cover-quiet.ts with its existing helper closure; hub/src is already copied, covering test-admission.ts and its runtime imports. The fixture still runs actual production CLI/daemon/spoke source and preserves every coverage/malformed-receipt assertion. No unrelated production changes or shared picks.

The new socket regressions use private scratch roots and a real listening socket; the child must fail before its target statement or account fixture creation. Client timeout closes its socket, and server closure is registered for test cleanup. Missing-discovery and stale-discovery/absent-socket remain accepted. Read-only git diff --check passes. No Reviewer test execution.

## Spec
No findings. M2 resolved: only absent/refused connections and explicitly unsupported/no-project responses bypass standalone admission; connected timeout and premature socket close now propagate, preserving the cover fence when admission is unknown. Two fresh-harness subprocess cases cover an unanswered connected socket and a socket closed after suite.slot, requiring nonzero exit, the specific error, no target statement and an empty fixture temp root. Documentation and the shipped Implementer clause distinguish absent hub from an unanswered connected hub.

The earlier review's pid/start/token comparison, integrated-holder metadata borrowing, independent remote/local behavior, pre-fixture import ordering and human override convention remain applicable. C3 established by source: tests.md and Implementer clause describe cover-quiet, waiting, own-worker inheritance, no-hub behavior and human-only CLAND_TEST_IGNORE_COVER=1.

## Validation and outstanding boundary
The request reports exact-head root typecheck exit 0 and diff check exit 0. Targeted runtime proof is not claimed: after census all-clear, the existing pre-feature live hub explicitly refused suite.slot as human-only to impl-475 before fixtures. The Implementer stopped and escalated under rule 5. This source verdict does not override that refusal or authorize another identity, override, route or equivalent run. Await the Coordinator's authorized capability disposition before dependent runtime work.

C1/C2 remain unverified pending whole-file cover-quiet and suite-coverage proof plus normal exact-head verification. Their earlier failed marks need claimant done restoration when supported by accepted evidence. No task-suite submission is directed while the explicit refusal remains unresolved. No per-item QA criteria.

Standards 0 findings; Spec 0 findings.
Review artifact A-4061.

Criteria: C3 verified.

### rev-30 · 2026-10-16T17:24:34.251Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-475-capability-delta
commit: de7d1927ee8ed91fc648b857d585628cb81f1fcb
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-475 capability-message delta source clear at de7d1927ee8ed91fc648b857d585628cb81f1fcb, compared with source-clear 8d39a241. Standards and Spec axes: no findings.

Inspected primary Coordinator decision 54b041c5-4d00-43ee-a896-5b1a1f1771d1 in topic-401: no live-hub permission change, no local retry; corrected source review then exact-head droplet verification in its normal no-live-hub environment. Actual local proof waits for merge/restart and a Coordinator-owned targeted run, with those marks unverified until its receipt.

The new source recognizes the exact forbidden: suite.slot prefix independently observed in A-4057, plus the explicitly unsupported request response. It throws immediately on receiving either with the exact required prefix:
"test admission unavailable: the project hub lacks the read-only suite.slot/check capability; restart the hub with T-475 before running tests."
The original refusal follows; it is not swallowed or converted into standalone success. Absence/refused connection still supports no-hub operation; connected silence/close still fails.

Two real-socket/fresh-harness subprocess variants now return legacy refusal and unsupported check responses, require nonzero startup with capability/restart text, no target execution and empty fixture roots. Their runtime proof is pending; no local retry is claimed. Docs include the missing capability and authorized-restart action. Previous copied-helper closure and timeout corrections remain intact. Exact-head root typecheck exit 0 is claimant-reported; independent diff whitespace check passes.

C3 source proof refreshed. C1/C2 stay unverified, including the deferred local-live-hub portion explicitly retained by the Coordinator. Source clearance allows only the specified normal exact-head droplet verification now; it does not authorize a local workaround or final local marks. No per-item QA criteria.
Review artifact A-4066.

Criteria: C3 verified.

### impl-475 · 2026-10-16T17:24:56.427Z

Source review clear at de7d1927 (A-4066 / rev-20261016-475-capability-delta). Submitted exact-head normal droplet verify f676f713-8d0f-4868-b789-1e7102f62d08 with no mode, topic-401, Reviewer + claimant recipients; worker pending, queue position 1. Following Coordinator disposition 54b041c5: no local retry after pre-feature hub refusal A-4057. Coordinator owns post-merge/restart local targeted receipt; C1/C2 local-live-hub evidence stays unverified until that receipt. Claim retained; waiting for hub result.
