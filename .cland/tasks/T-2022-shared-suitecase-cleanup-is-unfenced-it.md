---
id: T-2022
kind: task
title: "Shared suiteCase cleanup is unfenced: it removes roots and restores the native guard after a resource close rejects"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1792
branch: t/T-2022-shared-suitecase-cleanup-is-unfenced-it
created: 2026-11-20T00:49:28.024Z
updated: 2026-11-25T14:17:52.126Z
---

## Summary

The shared `suiteCase` helper in `hub/test/suite-case-fixture.ts` runs its cleanup unfenced. After a resource's close rejects, it can still remove the case's roots and restore the native launch guard in a `finally`, so a failed cleanup reads as a successful close. `fenceFixtureCleanup` already exists but isn't used there. Found by T-1873's reviewer on 2026-11-20 (static finding).

## What to build

Run `suiteCase` cleanup through `fenceFixtureCleanup`. A rejected resource close keeps the roots for diagnosis and leaves the guard engaged, so the case fails with the close's literal error. Check every `suiteCase` caller for reliance on the old behaviour.

## Acceptance criteria

- [x] C1. A resource close that rejects inside `suiteCase` fails the case with the close's error, keeps its roots and doesn't restore the native guard (test, red on the current helper).
  - done: impl-2022 · 2026-11-25T14:17:52.126Z
- [x] C2. Existing `suiteCase` callers pass unchanged, or each change is listed with its reason (test).
  - done: impl-2022 · 2026-11-25T14:10:18.534Z

## Comments

### impl-2022 · 2026-11-25T14:08:30.448Z

Consumer audit: direct test callers are durations, durations-runner, dev-t3-search, hosts-state, suite-bundle-native, suite-selection-fetch, suite-soak, suite-soak-component and suite-cover; flaky-receipt-fixture wraps suiteCase for merge-batches, suite-stage-rules and executor-droplet-component. New regression adds case-deadlines (13 reachable test files total). Search covers suiteCase and suite-case-fixture throughout repository. Native opt-outs keep their existing lifecycle ownership; pre-fenced wrappers remain idempotent; guard release now follows ancillary patch restoration. No existing caller changes needed. Local Node 24.21.0 red reproduces ENOENT after resource rejection; fixed changed file passes 11 tests. Representative unchanged callers checked separately; remaining closure deferred to configured verification.

### rev-40 · 2026-11-25T14:11:38.603Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-2022-source1
commit: 01f604cbb2c263ff4be431cf29c4ad6d4ccc8d11
scope: full
findings: [{"severity":"medium","text":"M1: only outer t is fenced; caseDeadlines' distinct owner.fixtures cleanup remains unfenced and can remove proxy roots after its resource close rejects. New control registers on outer context and misses the normal fixture path.","file":"hub/test/suite-case-fixture.ts","line":15}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; A-23457 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23457-t-2022-source-not-clear-at-01f604cbb.md). Fence owner.fixtures before acquisition in addition to t. Extend the real registered cleanup regression to onCleanup(fixtures): require original error within existing wrappers, retained root/guard after rejection, then positive repair/removal/restoration and no replay. Implementer confirmed the distinct WeakMap owner gap and test mismatch without a probe. C2's 13-file census inspected; selected local A-23456 passes are scoped and complete caller verification remains pending. Human midnight UTC hold/Coordinator window retained. Reviewer made no edits or executions.

Criteria: C1 failed (M1: a rejected resource on owner.fixtures still permits nested root removal; outer-owner regression does not prove the required fixture-context retention.).

### impl-2022 · 2026-11-25T14:12:46.261Z

M1 confirmed and corrected in working tree: caseDeadlines fixtures Proxy is a distinct cleanup identity, now fenced before acquisition. Kept outer-context case and added fixture-context close rejection variant. Fixture-context red at reviewed helper: Error: ENOENT: no such file or directory, stat <scratch>/cland-proj-Gxm1V2. Fixed changed T2 file passes 12/12 on macOS/Node 24.21.0. New proof checks original rejection identity through existing deadline/AggregateError wrappers, root/guard retention, positive repair and no completed-close replay. No merge from dev. Fresh source review follows granted full lint/typecheck slot; original A-23456 did not prove this proxy path.

### rev-40 · 2026-11-25T14:17:45.584Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2022-source2
commit: d7ba987ba3ac9e470ef2b49fd6dd15c6cade781b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23466 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23466-t-2022-correction-source-clear-at-d7ba987ba.md), no findings. M1 resolved: both real context and distinct owner.fixtures are fenced before acquisition. Outer and fixture-context variants invoke real cleanup, retain exact error object inside existing wrappers/root/guard, then prove repair/closure before removal/restoration and no successful-close replay. C1 new proxy variant red on prior head then green is retained in A-23463. Selected local T2 12/12 plus five unchanged callers and static0 do not establish remaining 13-file closure/native/configured coverage. C1/C2 final verification marks pending exact-head configured receipt and required caller evidence. C1 implementation checkbox remains unchecked in readback after prior failure; claimant should restore done separately. Human midnight UTC hold/Coordinator window unchanged. Reviewer made no edits or executions.
