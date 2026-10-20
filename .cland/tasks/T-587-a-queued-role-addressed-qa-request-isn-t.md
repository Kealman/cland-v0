---
id: T-587
kind: task
title: A queued role-addressed QA request isn't delivered when the verifier goes idle
state: open
status: review
size: S
criterion_seq: 2
labels:
  - needs-triage
  - hub
assignee: null
parent: E-952
blocked_by: []
topic: topic-712
branch: t/T-587-a-queued-role-addressed-qa-request-isn-t
created: 2026-10-16T10:42:55.641Z
updated: 2026-10-20T09:51:49.152Z
---

## Summary

A `qa request E-387` sent to the `qa` role at 10:28:27Z came back `queued` ("waiting for the next free live verifier for E-387; the hub will deliver automatically"). It stayed undelivered for about 20 minutes, while the only QA session, qa-27, was idle with no holds (`who` at about 10:48Z). The Coordinator resent it to qa-27 by name, and that reached it.

## Context

- At queue time, qa-27 had just recorded its E-423 verdict (10:27:34Z) and released its E-423 hold. It was probably still busy finishing its turn.
- The hub had restarted at 10:13:46Z (pid 29477).
- Likely cause: the queue is drained only on a specific verifier event, such as a hold release or a state change to idle, and that event fired before the request was queued, or isn't wired for that event.

## Acceptance criteria

- [x] C1. A role-addressed review or QA request that is queued while every verifier is busy reaches the first verifier that becomes idle or free, within one state change, including after a hub restart.
  - done: impl-587 · 2026-10-20T09:51:37.411Z
- [x] C2. A test reproduces the order: verdict, then hold release, then request queued while the verifier's turn is still running, then the verifier goes idle. The request is delivered.
  - done: impl-587 · 2026-10-20T09:51:38.184Z

## Comments

### coord · 2026-10-16T12:11:01.529Z

Second instance, 2026-10-16 12:10Z: `qa request E-426` to the `qa` role in topic-372 came back `queued` ("waiting for the next free live verifier for E-426"). qa-27 had released its E-387 hold at 11:35Z and sent its last report at 11:35Z. The Coordinator pointed qa-27 to it by name. The first instance, E-387 at 10:28Z, was delivered 14 minutes later at 10:42:44Z.

### coord · 2026-10-16T12:11:20.213Z

Correction to the 12:11Z entry: the queued E-426 request was assigned to qa-27 at 12:11:13Z, about 1 minute after it was queued. qa-27 was probably still finishing a turn, so this second instance is normal queueing, not the bug. The 10:28Z case (14 minutes while idle) stands.

### impl-587 · 2026-10-20T09:51:37.378Z

Reproduced the queue stall at T2. Correction to Context: drain hooks are present; hasPendingWork counted an old uncertain delivery indefinitely. Read-only live evidence found uncertain tracker-storage-fatal notices for rev-23 and rev-26 with empty pool-handoff values. Coordinator approved excluding uncertain non-verification traffic from staffing, while preserving received/held verification reservations. Fix and tests cover QA/review, restart, exact outage notice, prior-reviewer affinity, pending-to-hold transition and pool reuse. Targeted 15/15 tests, hub typecheck, static checks and diff checks pass; preparing source review.
