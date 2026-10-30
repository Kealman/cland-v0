---
id: T-1485
kind: task
title: The Inbox archive window mixes the fixture clock with the real clock, so phone-asks went red after 7 days
state: open
status: in progress
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
updated: 2026-10-30T12:38:21.140Z
---

## Summary

`web/test/phone-asks.test.ts` "a second phone context answers, closing the first sheet and retaining its outcome until Inbox departure" turned red everywhere at about 2026-10-30 12:00Z: on dev, on every branch, on Linux droplets and on macOS, with no code change. Its fixture pins a FakeClock at 2026-10-23T12:00:00Z, and the Inbox archive shows departures from the last seven days (`hub/src/hub/inbox.ts`, the `archive` query, 7 × 86400 s). Part of that path reads the real clock rather than the fixture's, so once real time passed 2026-10-30 12:00Z the departure fell out of the window. The same head, ee8383f99, was green at 10:45Z and red at 12:18Z (A-14280 versus A-14352). Runs: A-14344, A-14347, A-14350, A-14352.

## What to build

The Inbox archive window is computed from one clock: the hub's injected clock, both for the cutoff and for the departure timestamps it compares against. Fixture tests are then independent of the wall clock. Audit the other web and hub tests that pin a FakeClock date and assert time windows (inbox, notifications, events, accounts, phone-*), and fix each that mixes clocks the same way. Keep production behaviour unchanged: seven days on the real clock.

## Acceptance criteria

- [ ] C1. The phone-asks case passes with the machine clock set more than seven days after its fixture date, shown by a regression that runs the fixture with an injected real-clock offset of at least 8 days and fails before the fix.
  - failed: rev-26 [reviewer] · 2026-10-30T12:38:21.139Z · note Remaining observer drain-failure and unowned control setup paths can skip native disposal; corrected source and configured evidence required.
- [x] C2. Every test that pins a FakeClock date and asserts a time window is listed with "uses the injected clock" or "fixed", and the list is in the review request (rule 20).
  - done: impl-1485 · 2026-10-30T12:36:26.145Z

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
