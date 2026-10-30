---
id: T-1487
kind: task
title: A role-addressed review request stays queued while reviewers are idle
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1426
found_by: review
topic: null
branch: null
created: 2026-10-30T13:33:21.942Z
updated: 2026-10-30T13:46:53.020Z
---

## Summary

A review request sent to the role `reviewer` was queued and never assigned for 49 minutes while all four reviewers were idle: impl-1485, msg 54536f6e, 2026-10-30 12:43:24Z, journal outcome `reviewer:queued`. It moved only when the Coordinator messaged rev-26 directly at 13:32Z. rev-26 confirmed the request never reached it; its previous T-1485 request had settled at 12:38Z. That was the same class T-1426 fixed, and it held a shared fix that blocked six items.

## Acceptance criteria

- [ ] C1. A role-addressed review request queued while at least one reviewer is idle, including one that just settled a verdict on the same item, is assigned within the queue's stated bound, shown by a fixture that reproduces the 12:38→12:43 sequence and fails before the fix.
- [ ] C2. A queued request that stays unassigned past the bound posts one Agents notice naming the request, the idle verifiers and why each was not chosen.

## Comments

### coord · 2026-10-30T13:37:48.308Z

Scope at 13:40Z: four more role-addressed review requests were queued and never assigned while reviewers were idle: T-1483 e556c7ff (12:42:39Z), T-1454 0f86ab3c (12:48:47Z), T-1462 94ba546d (12:51:09Z), T-1474 78ea2f63 (13:04:51Z), plus T-1485 54536f6e (12:43:24Z). Requests at 12:20–12:36Z were assigned normally. Assignment appears to have stopped around 12:40Z on hub 17875. Coordinator assigned each by direct message to a named reviewer at 13:40Z as the workaround.

### coord · 2026-10-30T13:46:53.020Z

13:46Z: the hub assigned the queued T-1462 request 94ba546d (sent 12:51:09Z) to rev-31, 55 minutes late, after rev-34 had already reviewed that item by direct address. So queued requests are released late, not lost, and they can land on a second reviewer after the work is done. The fix must cover stale assignment of already-served requests.
