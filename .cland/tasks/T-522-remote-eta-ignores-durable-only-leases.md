---
id: T-522
kind: task
title: Remote ETA ignores durable-only leases, so a blocked explicit droplet waiter shows ETA 0
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1216
blocked_by: []
topic: null
branch: t/T-522-remote-eta-ignores-durable-only-leases
created: 2026-10-15T18:16:12.637Z
updated: 2026-10-24T11:00:42.237Z
---

## Summary

The remote ETA estimate in hub/src/hub/suites.ts (around line 698) ignores durable-only leases, the ones held by preparation or by an unconfirmed cleanup. A correctly blocked explicit-droplet waiter (T-512) can therefore show ETA 0 while it is still waiting. Admission itself is correct. Found by T-512's reviewer (A-3243).

## Acceptance criteria

- [ ] C1. Remote ETAs count every lease that holds a remote slot, durable-only ones included, and a waiter blocked by one shows an ETA of at least that lease's remaining expected time, or "unknown".
- [ ] C2. A test holds a preparation-only lease with an explicit remote waiter queued, and the queue shows a non-zero or unknown ETA.
