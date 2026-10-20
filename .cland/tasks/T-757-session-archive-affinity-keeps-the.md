---
id: T-757
kind: task
title: Session archive affinity keeps the earlier verifier item when consecutive holds share one heldAt instant
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - bug
  - hub
  - needs-triage
assignee: null
parent: E-952
blocked_by: []
topic: topic-713
branch: t/T-757-session-archive-affinity-keeps-the
created: 2026-10-17T22:01:23.815Z
updated: 2026-10-20T10:04:40.143Z
closed: 2026-10-20T10:04:40.143Z
---

## Summary

Found by impl-702 while migrating session-archive tests to the fake clock (T-702, 2026-10-17 22:00Z). In hub/src/adapters/sessions.ts:282, a verifier's cleanup item is updated only when `hold.heldAt > cleanupHeldAt`. When two consecutive holds (T-2, then T-3) share one instant, the later hold never replaces the earlier one. Closing T-3 then archives only the Implementer, and the Reviewer/QA stay attached to T-2.

## What to build

Archive affinity follows the latest hold, even when two holds have equal timestamps. Order equal holds by insertion order or by a sequence number, never by wall time alone. T-702 keeps the existing distinct-time assertion by advancing the clock 1 ms between holds. This ticket adds the equal-instant case.

## Acceptance criteria

- [x] C1. A T1/T2 test holds a verifier on T-2 and then on T-3 at the same fake-clock instant. Closing T-3 archives the Reviewer/QA with the Implementer, and the test fails before the fix.
  - verified: rev-31 [reviewer] · run rev-20261020-757-final · 2026-10-20T09:59:05.222Z · commit 5fa73b726d4d414d712782f203027bd83e4f806b
  - done: impl-757 · 2026-10-20T09:59:25.480Z

## Comments

### impl-757 · 2026-10-20T09:43:06.079Z

A-7125 row confirmed: REAL-CREW, XS, strict > still present in Sessions. Regression uses the existing T2 session/task socket seam with the same FakeClock instant for T-2 then T-3, for both Reviewer and QA; distinct-time coverage is retained. qaPolicy scope is none and no QA criteria are present.

### rev-31 · 2026-10-20T09:45:33.327Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-757-source
commit: a2ea92500bd62f277c4352229ee73bc5f1d8fa22
scope: full
findings: [{"severity":"medium","text":">= lets an unrelated change to earlier-held T-2 replay its equal heldAt snapshot and steal cleanup affinity from later-acquired T-3. Order actual hold acquisition, not general item notification arrival; add the replay-before-stop regression.","file":"hub/src/adapters/sessions.ts","line":297}]
finding_counts: {"high":0,"medium":1,"low":0}

A-7268: full source review not clear. General Tracker.onChange publishes all current holds for unrelated item edits; notification order is not acquisition order. Existing new test lacks the earlier-item replay while verifier is running. Keep distinct-time and archive/journal controls, add replay case and fix ordering. No verification at this head before corrected source review.

Criteria: C1 failed (Equal-time T-2 snapshot replay after T-3 acquisition resets affinity to the earlier item; latest-hold ordering remains incorrect.).

### rev-31 · 2026-10-20T09:52:40.759Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-757-source-corrected
commit: 5fa73b726d4d414d712782f203027bd83e4f806b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards and Spec findings: none. A-7287 records the corrected acquisition observation map and startup seeding, resolving M1 without replaying unchanged hold snapshots. A-7285 preserves the original regression red (a2ea9250 plus replay line, exit 1) and whole-file green (source committed unchanged as 5fa73b72, 9/9, exit 0). C1 final verification remains pending the mode-free gate at this exact head and the new equal-time identity's actual 5/5 load receipts.

### impl-757 · 2026-10-20T09:58:06.813Z

Same-head mode-free verification 48fa25e6-1742-4f86-9837-99eef3881304 passed at 5fa73b726d4d414d712782f203027bd83e4f806b: 1528/1528 tests, exit 0. A-7307 line 46521 records the exact new equal-heldAt test identity 5/5 passed; five load-gate finish receipts are present. Linux x64 droplet c-8 lon1, Node v24.21.0, lifetime 264s, cost $0.0183. Durable log: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7307-suite-48fa25e6-1742-4f86-9837-99eef3881304-auto-at-5fa73b7.log. Source clear; final reviewer evidence verdict pending.

### rev-31 · 2026-10-20T09:59:05.222Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-757-final
commit: 5fa73b726d4d414d712782f203027bd83e4f806b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7313: final evidence clear. C1 verified, reconciling prior failure: retained replay red/green A-7285 plus exact-head 48fa25e6/A-7307 green 1528 ordinary passes and five distinct passing new-identity repetitions, explicit 5/5 at raw line 46521. Maximum new case 0.539946772 s; no resource/duration failures. Source unchanged.

Criteria: C1 verified.

### coord · 2026-10-20T10:04:40.143Z

Merged 608ca7715b64ef9979544fc5c2f04c7a5b2b8df8 onto dev.
