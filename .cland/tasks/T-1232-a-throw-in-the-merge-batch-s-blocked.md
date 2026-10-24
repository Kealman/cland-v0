---
id: T-1232
kind: task
title: A throw in the merge batch's blocked-report path crashes the hub
state: open
status: in progress
size: S
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: topic-978
branch: t/T-1232-a-throw-in-the-merge-batch-s-blocked
created: 2026-10-24T10:52:41.334Z
updated: 2026-10-24T12:30:08.840Z
---

## Summary

Hub pid 78479 died at about 10:49:13Z on 2026-10-24 from an uncaught throw. The batch had landed T-1209 and its follow-up failed ("stop sessions: ps failed or timed out"). `MergeBatches.tick`'s catch handler then called `boundary.report`, which addressed `lead T-1209` for a closed item. At that dev build `#itemLead` threw for a closed item; T-1209 fixed that. The throw inside the `.catch` handler became an unhandled rejection and ended the process.

## What to build

A failure inside the batch's blocked-report path is logged and retained on the batch. It never escapes as an unhandled rejection. The same applies to the other fire-and-forget hub timers that report through `noticeTo`.

## Acceptance criteria

- [ ] C1. A batch whose blocked report throws keeps the hub serving, logs the report failure and keeps the batch blocked with its reason (test).
- [ ] C2. The hub's interval/tick loops catch report errors; an audit lists them in the ready report (test where reachable).

## Comments

### impl-1232 · 2026-10-24T12:30:08.840Z

Red→green: injected batch blocked report produced `Got unwanted rejection. Actual message: "report boundary failed"`; injected T3-search blocked report produced `Actual message: "blocked notice failed"`; nightly/periodic skip callbacks produced `Error: skip notice failed`. All now contained. Local macOS arm64 targeted files passed individually: merge-batches (63 tests), dev-t3-search (5), suite-scheduling (7); hub typecheck passed. Implemented additive retained batch.reportError plus logging and terminal guards. Audit in progress; full verification waits for source review.
