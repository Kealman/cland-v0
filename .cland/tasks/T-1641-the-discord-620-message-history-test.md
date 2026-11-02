---
id: T-1641
kind: task
title: The Discord 620-message history test times out at 10 s on a loaded droplet
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-02T20:13:15.234Z
updated: 2026-11-02T20:13:15.234Z
---

## Summary

`hub/test/telegram-polling-restart.test.ts:346` "Discord fresh history forwards newest 500 of 620 once with one silent overflow line" failed in T-1631's verify run 8a85617c (Linux droplet, A-15966) with `Error: 500 inputs and overflow settlement: not within 10000 ms` (until.ts:26). T-1631 is a docs-only split. The test passed 5/5 alone on macOS at 20:12Z. Its duration has been rising today: 5.17 s in its baseline, then 6.15–6.18 s in batches, already over its 5 s per-test budget.

## What to build

Make the settlement wait event-driven or proportional to its work, not a fixed 10 s wall-clock deadline (rule 23, wall-clock waits). If the work itself grew, bound it so the test stays inside its budget.

## Acceptance criteria

- [ ] C1. The test settles without a fixed 10 s wall-clock deadline, and passes 20/20 under a load gate at 10 (test).
- [ ] C2. Its per-test time returns under its budget, or it gets a dated allowance with samples.
