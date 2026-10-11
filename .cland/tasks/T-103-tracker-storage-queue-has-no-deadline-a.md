---
id: T-103
kind: task
title: "Tracker storage queue has no deadline: a hung write stalls all tracker work"
state: open
status: backlog
labels:
  - needs-triage
  - hub
  - tech-debt
assignee: null
parent: T-216
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:23:07.021Z
updated: 2026-10-11T06:35:52.990Z
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

- [ ] A held write past the threshold produces the event and the status flag, which a test proves.
- [ ] Hub stop with a held write finishes within its bound and reports the abandoned operation.
- [ ] The recovery decision is documented, and if implemented, a late write cannot commit after its deadline.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M; triage before scheduling.
