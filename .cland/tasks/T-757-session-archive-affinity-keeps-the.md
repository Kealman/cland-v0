---
id: T-757
kind: task
title: Session archive affinity keeps the earlier verifier item when consecutive holds share one heldAt instant
state: open
status: in progress
size: S
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
updated: 2026-10-20T09:42:20.441Z
---

## Summary

Found by impl-702 while migrating session-archive tests to the fake clock (T-702, 2026-10-17 22:00Z). In hub/src/adapters/sessions.ts:282, a verifier's cleanup item is updated only when `hold.heldAt > cleanupHeldAt`. When two consecutive holds (T-2, then T-3) share one instant, the later hold never replaces the earlier one. Closing T-3 then archives only the Implementer, and the Reviewer/QA stay attached to T-2.

## What to build

Archive affinity follows the latest hold, even when two holds have equal timestamps. Order equal holds by insertion order or by a sequence number, never by wall time alone. T-702 keeps the existing distinct-time assertion by advancing the clock 1 ms between holds. This ticket adds the equal-instant case.

## Acceptance criteria

- [ ] C1. A T1/T2 test holds a verifier on T-2 and then on T-3 at the same fake-clock instant. Closing T-3 archives the Reviewer/QA with the Implementer, and the test fails before the fix.
