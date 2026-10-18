---
id: T-761
kind: task
title: test:tiers refuses a duration allowance owned by a task, so a merge can't make dev's manifest invalid
state: open
status: planned
size: XS
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T22:53:23.993Z
updated: 2026-10-18T07:19:20.230Z
---

## Summary

On 2026-10-17 at 22:53Z, T-707 merged nine scenario allowances in hub/test/durations.json that named T-707 as their owner. Merging closed T-707, and verify-tiers then refused every run on dev with "duration allowance has closed owner T-707". coord re-owned them to E-677 in 315af806. The task's own review and verify passed, because the owner was still open then.

## What to build

The static gate (`npm run test:tiers`, in T0) refuses an allowance whose owner is a task-kind item and names the open container to use instead. An epic, release or category owner stays valid while it is open.

## Acceptance criteria

- [ ] C1. A T1 test feeds test:tiers's manifest check an allowance owned by an open task, gets a refusal naming the line and saying an epic owner is required, and fails before the fix.
