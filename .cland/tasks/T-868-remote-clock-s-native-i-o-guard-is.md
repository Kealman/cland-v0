---
id: T-868
kind: task
title: "remote-clock's native-I/O guard is inactive: scripted machines never call remoteWaits.track()"
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-613
branch: t/T-868-remote-clock-s-native-i-o-guard-is
created: 2026-10-19T11:41:10.800Z
updated: 2026-10-19T15:57:30.496Z
---

## Summary

`hub/test/remote-clock.ts` exposes `remoteWaits.track()` and guards clock advancement with `active.size`. But the current scripted-machine and remote-fixture code never calls `track`, so the native-I/O guard never engages. Independent peer drivers also lack a joint I/O boundary.

## Evidence

Found aside by impl-524 on 2026-10-19 while fixing T-524. T-524 now avoids these drivers during same-name readiness and completion.

## Acceptance criteria

- [x] C1. Either scripted machines and the remote fixture register their native operations with the clock guard, or the guard is replaced by an enforceable shared receipt API. A held-I/O regression shows that advancing the clock while a tracked operation is in flight is refused or joined.
  - done: impl-868 · 2026-10-19T15:56:46.651Z
  - verified: rev-30 [reviewer] · run rev-20261019-868-final · 2026-10-19T15:57:29.788Z · commit a99087df9890c21a4918217f6b46d32d39ab68f3

## Comments

### impl-868 · 2026-10-19T15:29:41.021Z

Implementation seam: scripted native filesystem dependencies plus the remote fixture's in-process provider boundary, all keyed by one shared FakeClock. Add a held-publication regression through a machine dependency (without manually calling track), and retain a separate peer driver to prove the shared guard. Harness-only change; qaPolicy scope is none.

### rev-30 · 2026-10-19T15:34:25.138Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-868-source
commit: a99087df9890c21a4918217f6b46d32d39ab68f3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6160, no findings. WeakMap shares complete guard by FakeClock identity; five scripted native writers and scripted provider request/publication hooks register track, intentional fake delays yield via shared wait, process-backed behavior unchanged. Held-writer matrix and entered provider hook assert no peer advance before release, then join writer/driver and assert final time/no pending deadlines. T1 injected writers/T2 scripted provider add no native process/socket/wait. A-6158 reports red-green and five serial touched files/checks green. C1 final verification awaits exact-head mode-free task receipt; no Reviewer execution.

### rev-30 · 2026-10-19T15:57:29.789Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-868-final
commit: a99087df9890c21a4918217f6b46d32d39ab68f3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6186 audits full A-6185 / ba0b14f5 at unchanged reviewed head. Ordinary 1560/1560 zero fail/cancel/skip/TODO; all 480 groups 5/5. Both owned held-publication regressions pass ordinarily and each 5/5, retaining pre-release zero-advance and post-completion receipts. Existing admission-lock/prepare/safety files pass with shared driver. C1 verified with A-6160 source. Four inherited T-856 push tripwire rows remain under T-877; no owned test trip. Existing report-only debt retained; T3 landing deferred. No Reviewer execution.

Criteria: C1 verified.
