---
id: T-215
kind: task
title: "Shard the hub suite by resource: lock only the tests that need the machine"
state: closed
status: done
criterion_seq: 4
labels:
  - ready-for-agent
assignee: impl-215
parent: E-230
blocked_by:
  - T-174
  - T-232
topic: topic-154
branch: t/T-215-shard-the-hub-suite-by-resource-lock
created: 2026-10-11T06:30:53.758Z
updated: 2026-10-12T00:05:28.624Z
---

## What to build

Mark the hub tests that touch shared machine state (real ports, `/tmp/cland-suite.lock`, headless Neovim, real-time waits) and run them as the **locked shard**. Everything else runs on its own tmp hub and forms the **free shard**. Several branches may run the free shard at the same time without the lock, under a per-run concurrency cap that keeps the machine under load 15 (T-173 showed that two full runs overload it).

Depends on T-174: fewer real-time waits shrink the locked shard.

## Acceptance criteria

- [x] C1. A test manifest or tag decides each test's shard, and a lint fails on an unmarked test that touches the listed resources.
  - done: impl-215 · 2026-10-11T21:01:19.687Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-215-1 · 2026-10-11T21:08:25.846Z · commit 55b5c365d2cbe2447941a93790210cf3104e7a94
  - verified: rev-18 [reviewer] · run rev-18-20261011-215-3 · 2026-10-11T22:10:46.433Z · commit 228227811c416bff44b35d479450f975410c192c
- [x] C2. The free shard runs green twice concurrently on dev.
  - done: impl-215 · 2026-10-11T21:01:20.119Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-215-1 · 2026-10-11T21:08:25.846Z · commit 55b5c365d2cbe2447941a93790210cf3104e7a94
  - verified: rev-18 [reviewer] · run rev-18-20261011-215-3 · 2026-10-11T22:10:46.433Z · commit 228227811c416bff44b35d479450f975410c192c
- [x] C3. The locked shard's duration appears in the suite report.
  - done: impl-215 · 2026-10-11T21:01:20.669Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-215-1 · 2026-10-11T21:08:25.846Z · commit 55b5c365d2cbe2447941a93790210cf3104e7a94
  - verified: rev-18 [reviewer] · run rev-18-20261011-215-3 · 2026-10-11T22:10:46.433Z · commit 228227811c416bff44b35d479450f975410c192c
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-215 · 2026-10-11T23:02:56.810Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-215-3 · 2026-10-11T23:03:15.139Z · commit 228227811c416bff44b35d479450f975410c192c

## Notes

Requested by the human via the stand-in, 2026-10-11. v0.1.1 backlog: do not launch in v0.1.

## Comments

### coord · 2026-10-11T18:06:17.252Z

Input from T-232 (2026-10-11 18:06Z): cland verify ships with an admission budget capped at 1 full run; values above 1 are reserved. Overlapping V1 workers need a shared compatibility broker (for hand runs and pre-V1 branches holding /tmp/cland-suite.lock) and per-run recovery records. Both belong here, together with deciding which shards may run side by side.

### impl-215 · 2026-10-11T20:53:35.725Z

Claimed from dev 5608e12. Reading T-218/A-1142 and T-232 compatibility implementation. Confirmed test seams: runner CLI, public suite-lock API, and real-hub verify frame/CLI. Starting with conservative classification and budget 1; shared compatibility admission and per-run recovery must keep hand/pre-V1 runs excluded.

### impl-215 · 2026-10-11T21:00:03.190Z

Implemented explicit manifest (5 free/116 machine), admission lint, per-run compatibility broker records and machine-only phase lease; budget remains 1 per confirmed fallback. Typecheck passed. Targeted runner: 40/40; suite selection: 38/38; real-hub budget/hand/pre-V1/borrow checks: 6/6; crash/recovery checks: 3/3. Repeated two-free-shard experiment on integrated dev passed 3 pairs (60/60 each), average pair 2.480 s versus sequential 4.310 s, observed peak load 13.04. Evidence A-1387 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1387-t-215-shard-overlap-measurement-and-budget-one-decision.md); raw data A-1388 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1388-t-215-repeated-free-shard-measurement-data.json). Whole-suite after measurement will be the final managed suite log; historical baseline is A-1363 (862.15 s wall, 2771.54 s wait).

### impl-215 · 2026-10-11T21:05:44.942Z

C2 supported-runtime correction: repeated the sequential baseline and all 3 overlapping pairs explicitly on Node v24.21.0 (driver and each runner use the pinned process.execPath), against integrated dev ef7c9101ae07f3fdafd1b100280f01d91097c7d8. All 6 overlapping lanes pass 30/30 each (60/60 per pair), zero failures/cancellations. Sequential pair wall 1.088 s; overlapping pairs 0.571/0.577/0.588 s (mean 0.579 s); observed peak 1m load 10.88; direct queue wait 0. Node 25 measurements are superseded for C2. Supported-runtime note A-1391: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1391-t-215-c2-supported-runtime-overlap-result.md. Reproduction driver, exact runtime/dev metadata and all 8 lane logs in A-1392: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1392-t-215-node-24-21-0-repeated-free-shard-evidence. Budget-one decision unchanged; task head 55b5c36 unchanged so queued full suite retains exact binding.

### rev-18 · 2026-10-11T21:08:25.846Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-215-1
commit: 55b5c365d2cbe2447941a93790210cf3104e7a94

No high or medium findings. Reviewed the explicit manifest, admission lint, machine-only phase lease, legacy compatibility fence and per-run recovery records against the approved budget-one fallback. C2 uses Node 24.21.0 evidence A-1391/A-1392: three overlapping pairs pass 60/60 each; the five free files match integrated dev ef7c910. C3 runner/report timing paths and regressions checked. C4 remains pending exact-head typecheck/full-suite evidence; this is not final merge readiness. Standards and Spec details: A-1394 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1394-t-215-review-at-55b5c36-c1-c3-clear-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-18 · 2026-10-11T22:05:20.097Z

verdict: review
result: not clear
by: rev-18 [reviewer]
run: rev-18-20261011-215-2
commit: 55b5c365d2cbe2447941a93790210cf3104e7a94

Medium — hub/test/suite-runner.test.ts:704: absolute private fixture paths inherit /tmp/cland-suite in managed TMPDIR and trip the raw source lint before either sharded-package fixture runs. Medium — hub/test/suite.test.ts:602: finished state precedes report publication; history counts can still be incomplete (A-1409 expects 2, sees 1 at :609). C4 fails: typecheck passes but full suite exits 1 with 1282/1285 hub tests, three failures, and Neovim omitted. Preserve resource/ordering assertions while fixing the fixture and settlement observation. Details: A-1411 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1411-t-215-full-suite-review-fixture-lint-rejection-and-settlement-race.md

Criteria: C4 failed (A-1409 exits 1: both generated free fixtures trip resource lint under suite TMPDIR; priority history sees incomplete publication; Neovim not run.).

### impl-215 · 2026-10-11T22:09:45.048Z

Corrected C4 findings at 228227811c416bff44b35d479450f975410c192c. Lint now recognizes actual legacy lock names rather than private /tmp/cland-suite-* roots; sharded fixtures always exercise the managed root shape and both shared lock path rejection cases remain. Priority/restart waits for finished AND reported before exact topic-history counts. A controlled 500ms final-artifact-read hold reproduced the old 1-versus-2 failure and passed after correction; temporary instrumentation removed. Merged origin/dev through T-233 badc088/T-249 0e3d011; candidate-tree checks before/after, exact head, cache provenance and original receipt timestamps preserved. Pinned Node 24.21.0: typecheck and manifest lint passed; shard/lint/newer-record targets 6/6; priority/compatibility/crash/report/cache targets 10/10. Evidence A-1412: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1412-t-215-c4-reproduced-fixture-lint-and-report-settlement-fixes.md. Supported-runtime C2 evidence remains A-1391/A-1392. Failed/partial A-1409 is explicitly documented. Requesting corrected-head review then fresh full suite; C4 remains failed/pending until green.

### rev-18 · 2026-10-11T22:10:46.433Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-215-3
commit: 228227811c416bff44b35d479450f975410c192c

No high or medium source findings remain. Exact shared lock-path lint removes private-root rejection while new cases retain shared-lock/timer detection; managed-root fixtures retain resource/recovery checks. Priority now awaits finished && reported with counts/head/order unchanged. Rechecked integrated T-233 worker cache/head/receipt paths against fixed badc088. C1–C3 freshly verified; C2's five free files remain byte-identical to supported Node 24.21.0 evidence A-1391/A-1392. C4 remains pending a successful exact-head full suite; prior failed mark is not successful evidence. Details: A-1413 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1413-t-215-corrected-head-review-at-2282278-c1-c3-clear.md

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-11T23:03:42.004Z

Merged fa3a864d34af713cdcd1ff7c260a9dca6d3fa129 onto dev.

### coord · 2026-10-11T23:35:53.960Z

Dev defect after merge (2026-10-11 23:35Z): the shard manifest at fa3a864 omits hub/test/launch-recovery.test.ts (T-129 landed before the manifest commit), so every full suite on dev exits at admission with 'unclassified hub test'. Shared one-line fix, byte-identical across branches: add "hub/test/launch-recovery.test.ts": "machine" after launch-admission in hub/test/shards.json (as in T-234's 382d0d8). Lesson: a new hub test file must be classified in the same merge window; the lint catches it only at the next suite.

### coord · 2026-10-12T00:05:28.624Z

Second manifest gap (2026-10-12 00:05Z): T-102 merged hub/test/termination-ownership.test.ts unclassified, because its branch predated the manifest and its own suite ran without it. Shared fix, as in T-211's fc6afcd: add "hub/test/termination-ownership.test.ts": "machine" after task-worktrees in hub/test/shards.json. Follow-up candidate: run the shard lint in the merge gate or in a pre-merge check, so a new test file can't land unclassified.
