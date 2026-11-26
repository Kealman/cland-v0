---
id: T-2022
kind: task
title: "Shared suiteCase cleanup is unfenced: it removes roots and restores the native guard after a resource close rejects"
state: closed
status: done
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
updated: 2026-11-26T19:57:49.940Z
closed: 2026-11-26T19:57:49.940Z
---

## Summary

The shared `suiteCase` helper in `hub/test/suite-case-fixture.ts` runs its cleanup unfenced. After a resource's close rejects, it can still remove the case's roots and restore the native launch guard in a `finally`, so a failed cleanup reads as a successful close. `fenceFixtureCleanup` already exists but isn't used there. Found by T-1873's reviewer on 2026-11-20 (static finding).

## What to build

Run `suiteCase` cleanup through `fenceFixtureCleanup`. A rejected resource close keeps the roots for diagnosis and leaves the guard engaged, so the case fails with the close's literal error. Check every `suiteCase` caller for reliance on the old behaviour.

## Acceptance criteria

- [x] C1. A resource close that rejects inside `suiteCase` fails the case with the close's error, keeps its roots and doesn't restore the native guard (test, red on the current helper).
  - done: impl-2022 · 2026-11-25T14:17:52.126Z
  - verified: rev-40 [reviewer] · run rev-40-20261126-2022-final · 2026-11-26T01:58:40.436Z · commit d7ba987ba3ac9e470ef2b49fd6dd15c6cade781b
  - verified: rev-41 [reviewer] · run rev-41-20261126-2022-final · 2026-11-26T18:46:42.007Z · commit ab38e13e4b0377479297bc53c85768e5393c2326
- [x] C2. Existing `suiteCase` callers pass unchanged, or each change is listed with its reason (test).
  - done: impl-2022 · 2026-11-25T14:10:18.534Z
  - verified: rev-40 [reviewer] · run rev-40-20261126-2022-final · 2026-11-26T01:58:40.436Z · commit d7ba987ba3ac9e470ef2b49fd6dd15c6cade781b
  - verified: rev-41 [reviewer] · run rev-41-20261126-2022-final · 2026-11-26T18:46:42.007Z · commit ab38e13e4b0377479297bc53c85768e5393c2326

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

### rev-40 · 2026-11-26T01:58:40.436Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261126-2022-final
commit: d7ba987ba3ac9e470ef2b49fd6dd15c6cade781b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1/C2 verified. A-23524 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23524-t-2022-final-clear-at-d7ba987ba.md). Exact-head6736134b/A-23522 passed; canonical1e9eaa14 executable match. Both outer/proxy exact retention-repair cases pass base+5/5, preserving literal error/root/guard retention, positive repair/removal/restoration and2attempt/no-replay assertions. All13 unchanged caller files have positive structured base identities. T0/T1/fallbackT2/11selectedT3/Web exit0, Linuxc8nyc1 workers2 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156 noncached,7789pass/1macOS-prerequisite skip/0fail. RemainingT3 batch/T4 unexecuted; budgets/allowance suggestions advisory. Prior A-23457 not-clear retained historical; no findings or Reviewer edits/executions.

Criteria: C1 verified, C2 verified.

### rev-41 · 2026-11-26T18:01:54.033Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261126-2022-delta1
commit: ab38e13e4b0377479297bc53c85768e5393c2326
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge delta source clear at ab38e13e4b0377479297bc53c85768e5393c2326 after Coordinator-requested devf72b000e9 under taskd7ba987ba. Both parent comparisons inspected. Optional timeoutMs/conditional passthrough retained beside outer and fixture-proxy pre-acquisition fences and fenced guard release. Both old rejection/repair variants plus dev held-child/held-configuration runner-close cases and final assertions retained; matching guide consistent. Standards/Spec no findings. A-23552 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23552-t-2022-merge-delta-source-review-clear-at-ab38e13e4.md. C1/C2 runtime marks from rev40/A-23524 are old-head/stale, not carried forward; new-head configured verification pending. A-23551 selected local macOSarm64 Node24.21 checks/static0 do not prove full13caller closure. Reviewer ran no tests/native/browser processes. Lead may request fresh Coordinator verify window.

### rev-41 · 2026-11-26T18:46:42.007Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261126-2022-final
commit: ab38e13e4b0377479297bc53c85768e5393c2326
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1/C2 verified at merged source-clearab38e13e4. Runf721185e/A-23569 exactsource/tree2b9b75a4 match; producer code0/causeempty, completeT0/T1/T2/T3/Webexit0. Both exact outer/proxy rejection-repair controls matchedbase+5/5load and filepasses; imported held-child/configuration controls basepass. All13 inventoried caller files have positive base identities and filefinishpass (counts in A-23570), retaining exact error/root/guard, positive repair and no-replay assertions. A-23570 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23570-t-2022-merged-head-final-review-clear-at-ab38e13e4.md. Linuxx64c8nyc1workers2 Node24.21/Nvim0.12.5 HeadlessShell1248/CFT156.0.8078.4, noncached, one macOS-stage-selector skip;11selectedT3once/remainingT3batch/T4unexecuted; budgets/lintadvisory. Oldrev40/A-23524 runtime remains oldhead evidence. No findings or Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-26T19:57:49.940Z

Merged 54e4f8cd82d4648daf0f2386893b79a15b6012a1 onto dev.
