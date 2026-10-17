---
id: T-742
kind: task
title: Some droplet results print 'lifetime unknown · cost $unknown'
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - hub
  - executor
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-17T15:49:20.649Z
updated: 2026-10-17T15:49:20.649Z
---

## Summary

Two droplet results today printed `lifetime unknown · cost $unknown` in place of the measured lifetime and cost: integrated cover 7c3aa637 (A-4460, 10:28Z) and T-738's run 0cc313d8 (A-4595, 15:49Z). Both runs finished normally. If the spend ledger misses these runs, the daily cap undercounts. If only the result line misses them, the receipts lose evidence.

## What to build

Find out when the result is written without the lease's lifetime and cost. One candidate is the lease being released or reaped before the result reads it. Check whether ~/.cland/executor/spend.json holds both runs. Fix whichever side is missing.

## Acceptance criteria

- [ ] C1. The cause is named, both runs' spend is accounted for in the ledger or the gap is quantified, and a regression shows a finished run always reports its lifetime and cost.
