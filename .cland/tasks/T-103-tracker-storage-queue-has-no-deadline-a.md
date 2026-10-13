---
id: T-103
kind: task
title: "Tracker storage queue has no deadline: a hung write stalls all tracker work"
state: closed
status: done
criterion_seq: 4
labels:
  - hub
  - ready-for-agent
assignee: impl-103
parent: E-229
blocked_by: []
topic: topic-163
branch: t/T-103-tracker-storage-queue-has-no-deadline-a
created: 2026-10-09T19:23:07.021Z
updated: 2026-10-12T02:42:59.977Z
closed: 2026-10-12T02:43:00.084Z
---

## Parent

Part of T-19, a follow-up to T-77. Found by rev-6 on T-77's head f1463bb on 2026-10-09 at 19:22Z. The Coordinator accepted it for T-77 as a known limitation: a hung write used to block the whole event loop, and now it blocks only tracker work.

## What happened

T-77 made every tracker mutation, import and serving-time watcher read go through one tracker-wide queue, at hub/src/tracker/tracker.ts:619. That queue waits for each filesystem operation with no deadline. A held or hung `writeFile` leaves every later view, every other item's comment, and hub stop pending until it returns. Client reply timeouts and the slow-answer log do not cancel storage work. Simply releasing a timed-out queue tail would let the late write race the next one.

## What to build

- Stall detection: when a queued storage operation exceeds a threshold, emit a `tracker-storage-stalled` event naming the operation and the item, and show it in `hub status`. No cancellation in this first step.
- Then decide recovery. One option is fencing tokens, so a write that completes after its deadline cannot commit. Another is failing the hub fast with a clear error. Record the decision in an ADR or in hub/README.md.
- Hub stop must finish within its bound even with a stalled write, and report what it abandoned.

## Acceptance criteria

- [x] C1. A held write past the threshold produces the event and the status flag, which a test proves.
  - done: impl-103 · 2026-10-12T01:43:15.051Z
  - verified: rev-21 [reviewer] · run rev-20261012-103-2 · 2026-10-12T02:42:43.743Z · commit 7d3a5a350f6e9c50fa85682b030aac85d892969a
- [x] C2. Hub stop with a held write finishes within its bound and reports the abandoned operation.
  - done: impl-103 · 2026-10-12T01:43:15.264Z
  - verified: rev-21 [reviewer] · run rev-20261012-103-2 · 2026-10-12T02:42:43.743Z · commit 7d3a5a350f6e9c50fa85682b030aac85d892969a
- [x] C3. The recovery decision is documented, and if implemented, a late write cannot commit after its deadline.
  - done: impl-103 · 2026-10-12T01:43:15.581Z
  - verified: rev-21 [reviewer] · run rev-20261012-103-2 · 2026-10-12T02:42:43.743Z · commit 7d3a5a350f6e9c50fa85682b030aac85d892969a
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-103 · 2026-10-12T02:42:16.950Z
  - verified: rev-21 [reviewer] · run rev-20261012-103-2 · 2026-10-12T02:42:43.743Z · commit 7d3a5a350f6e9c50fa85682b030aac85d892969a

## Notes

Size M; triage before scheduling.

## Comments

### impl-103 · 2026-10-12T01:36:13.495Z

Recovery decision (accepted by coord): fail-fast, not in-process fencing tokens. A native rename/link already issued to the OS cannot be revoked by a token; releasing a timed-out queue would let it race the next write. T-103 adds stall detection without serving-time cancellation, plus bounded shutdown and an abandonment report. Automatic termination on a serving-time stall is deferred to a v0.1.2 follow-up; no late-commit recovery implementation is part of C3. Shutdown must prevent subsequent work from starting and exit the daemon if storage cannot drain.

### impl-103 · 2026-10-12T01:43:15.812Z

Implementation pushed at d8042bde941eaf038df9d452450ac27cf6aadb4f. Targeted tracker-async coverage passed 35/35 and native-boundary coverage passed 29/29. Durable implementation handoff: A-1486, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1486-t-103-implementation-and-verification-handoff.md. origin/dev fetched and already integrated before final suite. No per-item QA brief is present; inherited QA policy is affected/after-stage, with no QA criteria on this task.

### rev-21 · 2026-10-12T02:14:10.407Z

verdict: review
result: not clear
by: rev-21 [reviewer]
run: rev-20261012-103-1
commit: d8042bde941eaf038df9d452450ac27cf6aadb4f

Medium — hub/test/init.test.ts:338: The initialized-project test compares the full tracker status with { levels }, while dispatch.ts:1194 adds tracker.storage; the exact-head full suite fails this assertion, so C4 is not satisfied. Update the expanded status expectation and rerun full verification.

No high/medium implementation findings otherwise. C1–C3 were checked against code, passing held-storage regressions in A-1493, and the Coordinator-accepted recovery scope. Reviewer typecheck passed. Full suite: 1328/1329 pass, exit 1. Review details are in the artifact posted to topic-163.

Criteria: C4 failed (Full suite 56a20b9a exits 1: hub/test/init.test.ts:338 still expects tracker status to contain only levels, but the new storage field is present.).

### impl-103 · 2026-10-12T02:14:25.194Z

Fixed the full-suite C4 failure at init.test.ts:338 by asserting the loaded tracker.levels config instead of the complete tracker object, which now also exposes storage health. Targeted initialized-project test passes. Merged freshly fetched origin/dev, pushed revised head 7d3a5a350f6e9c50fa85682b030aac85d892969a. Re-requesting review and full verification at this exact head.

### impl-103 · 2026-10-12T02:42:17.137Z

C4 complete at 7d3a5a350f6e9c50fa85682b030aac85d892969a: final full verification 1dbc9b00-fbcc-4706-b60b-d16b686c3859 exited 0; typecheck plus all 1623 tests passed (hub and Neovim). Durable log A-1497: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1497-suite-1dbc9b00-fbcc-4706-b60b-d16b686c3859-all-at-7d3a5a3.log. No further code commits; awaiting exact-head reviewer verdict.

### rev-21 · 2026-10-12T02:42:43.743Z

verdict: review
result: clear
by: rev-21 [reviewer]
run: rev-20261012-103-2
commit: 7d3a5a350f6e9c50fa85682b030aac85d892969a

No remaining high, medium or low findings. Standards and spec review clear at 7d3a5a350f6e9c50fa85682b030aac85d892969a.

The prior C4 failure at hub/test/init.test.ts:338 is fixed: the assertion checks configured tracker.levels while allowing storage health. C1–C2 are established by the passing real-daemon and direct held-storage regressions; C3 matches the documented fail-fast decision and Coordinator-accepted detection-only scope. C4 is established by full suite 1dbc9b00: typecheck and 1623/1623 tests pass, exit 0 (A-1497). All four criteria checked at this exact head.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-12T02:42:59.977Z

Merged 44b35566fe1ba02093d7421fa6a3c7991e7a630a onto dev.
