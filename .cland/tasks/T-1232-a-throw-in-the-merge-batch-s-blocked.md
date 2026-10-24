---
id: T-1232
kind: task
title: A throw in the merge batch's blocked-report path crashes the hub
state: open
status: backlog
size: S
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: null
branch: null
created: 2026-10-24T10:52:41.334Z
updated: 2026-10-24T10:52:41.334Z
---

## Summary

Hub pid 78479 died at about 10:49:13Z on 2026-10-24 from an uncaught throw. The batch had landed T-1209 and its follow-up failed ("stop sessions: ps failed or timed out"). `MergeBatches.tick`'s catch handler then called `boundary.report`, which addressed `lead T-1209` for a closed item. At that dev build `#itemLead` threw for a closed item; T-1209 fixed that. The throw inside the `.catch` handler became an unhandled rejection and ended the process.

## What to build

A failure inside the batch's blocked-report path is logged and retained on the batch. It never escapes as an unhandled rejection. The same applies to the other fire-and-forget hub timers that report through `noticeTo`.

## Acceptance criteria

- [ ] C1. A batch whose blocked report throws keeps the hub serving, logs the report failure and keeps the batch blocked with its reason (test).
- [ ] C2. The hub's interval/tick loops catch report errors; an audit lists them in the ready report (test where reachable).
