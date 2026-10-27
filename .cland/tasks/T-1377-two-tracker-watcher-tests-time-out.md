---
id: T-1377
kind: task
title: Two tracker-watcher tests time out together in a loaded macOS stage cover
state: open
status: backlog
size: S
labels:
  - qa-found
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-27T19:31:23.217Z
updated: 2026-10-27T19:31:23.217Z
---

## Summary

In the macOS stage cover 5fcc5c84 at dev 605a65a0 (local, 2 workers, peak 1m load 8.45; log A-12870) two tracker-watcher tests timed out in the same 20 s window (19:29:26–19:29:46Z): `hub/test/task-plan.test.ts::invalid hand edits keep the accepted plan across restart, and valid hand edits replace it` (`watcher refuses plan: not within 15000 ms`) and `hub/test/task-prefixes.test.ts::removing an unclaimed child sends its terminal event to the surviving parent Lead` (`removed child is reported: not within 15000 ms`). Alone each passed 5/5 on the same tree; both passed in every other run this session.

## What to build

Find why a hand write or removal under `.cland/tasks/` went unnoticed by two separate fixture hubs for 15 s at the same moment (macOS file-event delivery delayed or coalesced under load, or a hub-side watcher gap). If the watcher can miss an event, that is a product defect: the hub must re-index the file eventually (rescan or equivalent) and the fix lands with a regression. If events only arrive late, move both tests to the exact re-index receipt helper T-1374 added (`reindexedAfter`) with a bound sized for a loaded macOS cover, and record the measured delivery delay.

## Acceptance criteria

- [ ] C1. The failure is attributed with evidence (missed event versus late event) quoted from a reproduction under load.
- [ ] C2. Both identities pass 10/10 under two workers plus owned CPU load on macOS.
