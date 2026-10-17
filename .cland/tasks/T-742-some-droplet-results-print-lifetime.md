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
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-17T15:49:20.649Z
updated: 2026-10-17T17:14:31.801Z
---

## Summary

Two droplet results today printed `lifetime unknown · cost $unknown` in place of the measured lifetime and cost: integrated cover 7c3aa637 (A-4460, 10:28Z) and T-738's run 0cc313d8 (A-4595, 15:49Z). Both runs finished normally. If the spend ledger misses these runs, the daily cap undercounts. If only the result line misses them, the receipts lose evidence.

## What to build

Find out when the result is written without the lease's lifetime and cost. One candidate is the lease being released or reaped before the result reads it. Check whether ~/.cland/executor/spend.json holds both runs. Fix whichever side is missing.

## Acceptance criteria

- [ ] C1. The cause is named, both runs' spend is accounted for in the ledger or the gap is quantified, and a regression shows a finished run always reports its lifetime and cost.

## Comments

### coord · 2026-10-17T17:14:31.708Z

Third case, and this one fails the run: T-695's run e9bd92a9 (A-4644) on the restarted hub (pid 9780, T-738 live) ended with outcome code 1 and an empty cause. It had 2077 passed and 0 failed, but no "Neovim smoke" shard line, and the header shows lifetime unknown and cost $unknown. The journal has executor-lease-active (lease 661a4c68) at 16:35:34Z, then verification-timing and suite-result at 17:13:09Z, with no lease-close event between them. So the run's Neovim smoke phase result and the lease accounting are both missing, and the missing phase turned a green hub run red. Raising priority: this now costs reruns.
