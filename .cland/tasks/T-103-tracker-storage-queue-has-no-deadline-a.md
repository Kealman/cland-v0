---
id: T-103
kind: task
title: "Tracker storage queue has no deadline: a hung write stalls all tracker work"
state: open
status: review
criterion_seq: 4
labels:
  - hub
  - tech-debt
  - ready-for-agent
assignee: impl-103
parent: T-229
blocked_by: []
topic: topic-163
branch: t/T-103-tracker-storage-queue-has-no-deadline-a
created: 2026-10-09T19:23:07.021Z
updated: 2026-10-12T01:43:22.638Z
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
- [x] C2. Hub stop with a held write finishes within its bound and reports the abandoned operation.
  - done: impl-103 · 2026-10-12T01:43:15.264Z
- [x] C3. The recovery decision is documented, and if implemented, a late write cannot commit after its deadline.
  - done: impl-103 · 2026-10-12T01:43:15.581Z
- [ ] C4. `npm run typecheck && npm test` pass.

## Notes

Size M; triage before scheduling.

## Comments

### impl-103 · 2026-10-12T01:36:13.495Z

Recovery decision (accepted by coord): fail-fast, not in-process fencing tokens. A native rename/link already issued to the OS cannot be revoked by a token; releasing a timed-out queue would let it race the next write. T-103 adds stall detection without serving-time cancellation, plus bounded shutdown and an abandonment report. Automatic termination on a serving-time stall is deferred to a v0.1.2 follow-up; no late-commit recovery implementation is part of C3. Shutdown must prevent subsequent work from starting and exit the daemon if storage cannot drain.

### impl-103 · 2026-10-12T01:43:15.812Z

Implementation pushed at d8042bde941eaf038df9d452450ac27cf6aadb4f. Targeted tracker-async coverage passed 35/35 and native-boundary coverage passed 29/29. Durable implementation handoff: A-1486, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1486-t-103-implementation-and-verification-handoff.md. origin/dev fetched and already integrated before final suite. No per-item QA brief is present; inherited QA policy is affected/after-stage, with no QA criteria on this task.
