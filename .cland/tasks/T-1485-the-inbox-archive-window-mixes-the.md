---
id: T-1485
kind: task
title: The Inbox archive window mixes the fixture clock with the real clock, so phone-asks went red after 7 days
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1240
branch: t/T-1485-the-inbox-archive-window-mixes-the
created: 2026-10-30T12:19:45.148Z
updated: 2026-10-30T14:28:18.951Z
closed: 2026-10-30T14:28:18.951Z
---

## Summary

`web/test/phone-asks.test.ts` "a second phone context answers, closing the first sheet and retaining its outcome until Inbox departure" turned red everywhere at about 2026-10-30 12:00Z: on dev, on every branch, on Linux droplets and on macOS, with no code change. Its fixture pins a FakeClock at 2026-10-23T12:00:00Z, and the Inbox archive shows departures from the last seven days (`hub/src/hub/inbox.ts`, the `archive` query, 7 × 86400 s). Part of that path reads the real clock rather than the fixture's, so once real time passed 2026-10-30 12:00Z the departure fell out of the window. The same head, ee8383f99, was green at 10:45Z and red at 12:18Z (A-14280 versus A-14352). Runs: A-14344, A-14347, A-14350, A-14352.

## What to build

The Inbox archive window is computed from one clock: the hub's injected clock, both for the cutoff and for the departure timestamps it compares against. Fixture tests are then independent of the wall clock. Audit the other web and hub tests that pin a FakeClock date and assert time windows (inbox, notifications, events, accounts, phone-*), and fix each that mixes clocks the same way. Keep production behaviour unchanged: seven days on the real clock.

## Acceptance criteria

- [x] C1. The phone-asks case passes with the machine clock set more than seven days after its fixture date, shown by a regression that runs the fixture with an injected real-clock offset of at least 8 days and fails before the fix.
  - done: impl-1485 · 2026-10-30T14:00:08.455Z
  - verified: rev-26 [reviewer] · run rev-20261030-1485-evidence-3 · 2026-10-30T14:19:20.927Z · commit 380e4105565d18266d7162c30a32231c0dacdb3f
- [x] C2. Every test that pins a FakeClock date and asserts a time window is listed with "uses the injected clock" or "fixed", and the list is in the review request (rule 20).
  - verified: rev-26 [reviewer] · run rev-20261030-1485-source-3 · 2026-10-30T13:34:11.548Z · commit 4f537e14099cab2cb048b725e7a8725d788e4950
  - verified: rev-26 [reviewer] · run rev-20261030-1485-source-4 · 2026-10-30T13:40:49.242Z · commit 73d470384eab918acbf99814c1a0b81a2b7e37fb
  - done: impl-1485 · 2026-10-30T14:00:09.291Z
  - verified: rev-26 [reviewer] · run rev-20261030-1485-source-5 · 2026-10-30T14:00:37.523Z · commit 380e4105565d18266d7162c30a32231c0dacdb3f
  - verified: rev-26 [reviewer] · run rev-20261030-1485-evidence-3 · 2026-10-30T14:19:20.927Z · commit 380e4105565d18266d7162c30a32231c0dacdb3f

## Comments

### impl-1485 · 2026-10-30T12:25:01.725Z

Diagnosis: hub p.now and Store departure timestamps already share the injected Core clock. First mismatched clock is browser InboxArea Date.now -> InboxArchive cutoff. Red reproduced after rebuilding bundle: archive question locator timed out at 3000ms; explicit +8-day browser Date red also recorded. Fix is test-only Date synchronization with native timers preserved and FakeClock advances observed. Consumer/time-window inventory: docs/agents/tests/T-1485-clock-audit.md. All six phone-asks cases green; affected Web files running serially locally.

### rev-26 · 2026-10-30T12:31:30.618Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1485-source-1
commit: cd2648ed1787ee56a7d8b9074fa2bcdb72901eb7
scope: full
findings: [{"severity":"medium","text":"M1: queued asynchronous Date updates lack immediate rejection ownership and disposal join; unobserve follows browser close and cannot revoke admitted snapshots. Shared pre-owned bounded update lifetime must drain before context/browser close, with omitted/aborted/held/rejected controls.","file":"hub/test/fake-clock.ts","line":17},{"severity":"medium","text":"M2: C2 complete inventory omits fixed/default FakeClock window consumers including web-auth expiry, session-archive dated thresholds and subscription-hygiene coalescing boundaries. Audit remaining consumers and record producer/reader scope/status without changing already-correct tests.","file":"docs/agents/tests/T-1485-clock-audit.md","line":60}]
finding_counts: {"high":0,"medium":2,"low":0}

A-14367 consolidates M1/M2 only. Browser is first mismatched clock; hub cutoff and departure already use injected time, so test-only Date boundary otherwise fits with native timers retained. Correct both, restore done marks and request exact-head source review before verification. No Reviewer workloads.

Criteria: C1 failed (New Date update producer lacks owned drainage before native fixture shutdown; corrected source and same-head configured evidence required.), C2 failed (Claimed complete time-window consumer inventory omits concrete existing pinned/default FakeClock tests.).

### coord · 2026-10-30T12:33:00.909Z

Periodic dev T3 3707a6ed at 3762dc80e (A-14368) went red with only this phone-asks identity, and the hub started a culprit search (816226a4, 12:32Z). Its result will name a false culprit. The failure depends on wall-clock time (red on every head after 2026-10-30 12:00Z, including be8d9c3d4, which was green at 10:34Z, A-14277), so every probe after that time fails no matter which commit it tests. Read any culprit it names (likely T-1467 or T-1469) as a time-based false attribution. Coordinator cannot cancel the hub's search run (verify cancel is own-run only).

### rev-26 · 2026-10-30T12:38:21.140Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1485-source-2
commit: 3295dd67869afda32bf212af63f47ea99e3628f4
scope: full
findings: [{"severity":"medium","text":"M1 remains: observation drain rejection occurs before native context/browser/hub cleanup; resource failure does not fence root removal. Use shared cancellation/removal-barrier ownership and pre-register gate release/join with separate bounded setup/effect observations in new controls.","file":"web/test/harness.ts","line":125}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14374 replacement audit: immediate rejection ownership/allSettled updates accepted; M2 inventory omissions resolved in source. Remaining M1 only: drain timeout skips native teardown and new held controls lack pre-registered fallback/separate setup bounds. No Reviewer workloads; no verification before corrected exact-head source verdict.

Criteria: C1 failed (Remaining observer drain-failure and unowned control setup paths can skip native disposal; corrected source and configured evidence required.).

### rev-26 · 2026-10-30T13:34:11.548Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1485-source-3
commit: 4f537e14099cab2cb048b725e7a8725d788e4950
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14388 source3 clear: remaining M1 resolved by native disposal after initial drain failure, actual post-cancellation drainage and independent ordinary/signal root-removal guard; shared pre-owned controls retain missing/abort/held/removal sensitivity. M2 inventory remains resolved; C2 verified in source. Eight-day/archive/native-timer facts retained; C1 final runtime pending unchanged-head configured original evidence. No Reviewer workloads or sub-agents.

Criteria: C2 verified.

### rev-26 · 2026-10-30T13:39:33.770Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1485-evidence-1
commit: 4f537e14099cab2cb048b725e7a8725d788e4950
scope: evidence
findings: [{"severity":"medium","text":"M3: unchanged test-docs index/H1 guard rejects task audit in per-test-only folder. Coordinator4c7781fb requires artifact+item-comment audit only, remove repo file and committed links; preserve guard red/green before source-delta review and rerun.","file":"docs/agents/tests/T-1485-clock-audit.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14391 original audit:1191ordinarypass1fail+120loadpass;T0passT1failT2/Webunexecuted,T3/T4notselected. Three Date clock unit identities pass; no final C1 runtime settlement. C2 content provenance retained separately. Source3 clear is not full green evidence; no Reviewer workloads.

### impl-1485 · 2026-10-30T13:39:44.855Z

C2 inventory is retained entirely outside the repo in A-14378, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14378-t-1485-source3-clock-drainage-and-removal-evidence.md. It lists fixed Web FakeClock consumers, injected-clock hub consumers with P/R/injection source anchors, detailed web-auth/session-archive/subscription-hygiene windows, native-clock exceptions, and test-only observation/removal helper consumers. Removing the repo audit and its skill link fixes our own A-14389 failure: each per-test document must be indexed exactly once. Unchanged test-docs file red at source3 (2/3), green after removal (3/3). A-14389 did not execute T2 or Web, including phone-asks; final C1 runtime remains pending.

### rev-26 · 2026-10-30T13:40:49.242Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1485-source-4
commit: 73d470384eab918acbf99814c1a0b81a2b7e37fb
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14394 audit-removal delta clear: only repo audit deletion, removed skill link and destination guidance/CHANGES. Coordinator4c7781fb satisfied; C2 full inventory retained A-14378+item comment. No runtime/test/guard changes; unchanged guard red/green A-14392. Prior A-14389/A-14391 failed remains separate. C1 final runtime pending one configured unchanged-head rerun; no Reviewer workloads.

Criteria: C2 verified.

### rev-26 · 2026-10-30T13:58:59.314Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1485-evidence-2
commit: 73d470384eab918acbf99814c1a0b81a2b7e37fb
scope: evidence
findings: [{"severity":"medium","text":"M4: injected drain deadline is load-scaled by until (20ms on droplet factor2), but test advances10ms and expects10ms then awaits rejection, hanging120s; load repetitions0/5. Preserve root/settlement assertions while aligning with shared load policy, confirm factor2 red/green, source-review before retry.","file":"hub/test/fixture-endpoints.test.ts","line":136}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14412 original audit:3580ordinarypass1cancelled+120completedloadpass;3700completed-progresspasses excludescancel. T0/T1pass,T2red,Webunexecuted,T3/T4notselected. No successful120s duration claim or allowance. Source mismatch was missed in source3 review; C2 audit remains separate. No Reviewer workloads.

Criteria: C1 failed (New root-drain control cancels after120s and load repetitions0/5; Web archive/runtime proof unexecuted.).

### impl-1485 · 2026-10-30T13:59:54.739Z

Owned failed retry A-14410: T0/T1 green, T2 hung/cancelled on new root-drain control; Web unexecuted. Reproduced unchanged control under CLAND_TEST_LOAD_FACTOR=2 with 1500ms native bound: cancelled1, test timed out after1500ms. Changed only that control to observe the shared until scheduler's actual duration, advance it and expect that timeout; factor2 targeted receipt says effective deadline20ms, pass1/1; whole fixture-endpoints11/11. No observer/drain machinery, budgets or docs changed. Red/green A-14413. Fresh exact-head delta review required before one rerun.

### rev-26 · 2026-10-30T14:00:37.523Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1485-source-5
commit: 380e4105565d18266d7162c30a32231c0dacdb3f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14415 source5 delta clear. Only failing control changes: observes actual until deadline after timer scheduling, drives that exact value and matches exact error; no duplicated load policy, root-preservation/positive-removal unchanged. A-14413 factor2 local red/green limited correctly; no Reviewer workload. Failed A-14410 remains separate. C1 final runtime pending one configured unchanged-head rerun.

Criteria: C2 verified.

### rev-26 · 2026-10-30T14:19:20.927Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1485-evidence-3
commit: 380e4105565d18266d7162c30a32231c0dacdb3f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14418 final original A-14417 audit clear:4260ordinarypasses+125scopedloadpasses,T0/T1/allfallbackT2/Webcomplete,T3/T4notselected. Exact8day phone archive2.128714488s; native Web clock/failure controls pass; root-removal+3clock cases each5/5load. C1/C2verified with source/A-14378 item audit. Prior failed receipts preserved; report-only warnings not enforced timing passes; no Reviewer workloads. Coordinator owns integrated/landing sequencing.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-30T14:28:18.951Z

Merged 96019173506cd51b1470e70cc9793773871e917c onto dev.
