---
id: T-1302
kind: task
title: roles-timing's malformed-refresh case reads its clock before T-1230's async refresh completes
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1280
blocked_by: []
regression_of: T-1230
found_by: cover
topic: null
branch: null
created: 2026-10-25T12:32:13.237Z
updated: 2026-10-25T12:32:27.130Z
---

## Summary

`hub/test/roles-timing.test.ts` "150 ms of malformed parsing plus 150 ms of failure logging counts as one 300 ms roles continuation" fails deterministically on dev since T-1230 (8acdd283): `assert.equal(result.clock, 300)` gets 0, because the roles refresh no longer completes within the single `setImmediate` the test waits after `mock.timers.tick(ROLES_REFRESH_MS)` (T-1230 made role-clause assembly's skill inventory asynchronous). It passes at 82cf0f6c and fails 5/5 at 8acdd283, c966b086 and 0026fcd0 (Coordinator, local macOS). T-1230's merge batch ran T1 only; the failure surfaced in T-521's rule 6 suite 55b87b2c (A-11908).

The fix waits on the refresh's own completion receipt (the `roles-unreadable` event, or a promise RolesFile exposes for its current refresh), not on a fixed number of event-loop turns, and keeps every assertion.

## Acceptance criteria

- [ ] C1. The case passes 5/5 locally and on the Linux droplet at the fix head with its four assertions unchanged, and waits on a refresh completion receipt rather than a counted setImmediate; a negative control that skips the wait fails.
