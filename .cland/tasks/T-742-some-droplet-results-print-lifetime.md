---
id: T-742
kind: task
title: Some droplet results print 'lifetime unknown · cost $unknown'
state: open
status: review
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - hub
  - executor
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-455
branch: t/T-742-some-droplet-results-print-lifetime
created: 2026-10-17T15:49:20.649Z
updated: 2026-10-17T17:24:28.151Z
---

## Summary

Two droplet results today printed `lifetime unknown · cost $unknown` in place of the measured lifetime and cost: integrated cover 7c3aa637 (A-4460, 10:28Z) and T-738's run 0cc313d8 (A-4595, 15:49Z). Both runs finished normally. If the spend ledger misses these runs, the daily cap undercounts. If only the result line misses them, the receipts lose evidence.

## What to build

Find out when the result is written without the lease's lifetime and cost. One candidate is the lease being released or reaped before the result reads it. Check whether ~/.cland/executor/spend.json holds both runs. Fix whichever side is missing.

## Acceptance criteria

- [x] C1. The cause is named, both runs' spend is accounted for in the ledger or the gap is quantified, and a regression shows a finished run always reports its lifetime and cost.
  - done: impl-742 · 2026-10-17T17:24:23.440Z

## Comments

### coord · 2026-10-17T17:14:31.708Z

Third case, and this one fails the run: T-695's run e9bd92a9 (A-4644) on the restarted hub (pid 9780, T-738 live) ended with outcome code 1 and an empty cause. It had 2077 passed and 0 failed, but no "Neovim smoke" shard line, and the header shows lifetime unknown and cost $unknown. The journal has executor-lease-active (lease 661a4c68) at 16:35:34Z, then verification-timing and suite-result at 17:13:09Z, with no lease-close event between them. So the run's Neovim smoke phase result and the lease accounting are both missing, and the missing phase turned a green hub run red. Raising priority: this now costs reruns.

### coord · 2026-10-17T17:15:35.933Z

Correction to the third case: e9bd92a9's exit 1 came from T-695's own new-test budget lines (five identities over 5 s), not from this defect. What remains for T-742 there is the missing Neovim smoke shard line and lifetime/cost "unknown". T-694's run bf76cf3d on the same hub reported both normally, so the gap is intermittent.

### coord · 2026-10-17T17:15:56.484Z

Cause narrowed by the stand-in's oversight check (2026-10-17 17:16Z). The spend is charged and the droplets are gone; only the result line races. For e9bd92a9 the journal shows executor-release-retry and executor-release-unconfirmed at 17:13:09Z (DigitalOcean request deadline reached), suite-result written 0.5 s later, then executor-lease-released at 17:13:42Z with lifetimeMs 2266532 and costUsd 0.157. The ledger holds that entry, and droplet 610025677 is absent from the DO list. The two earlier cases (droplet 609910076 at 06:11Z, 609954708 at 10:28Z) have the same shape. Fix direction: the result waits for the release retry, or lifetime and cost are backfilled from the ledger or the lease-released event.

### impl-742 · 2026-10-17T17:21:03.209Z

Diagnosis: all three affected runs were posted immediately after executor-release-unconfirmed; their durable leases then settled later. Ledger values: 7c3aa637=$0.1469426389 (lifetime 2,115,974ms), 0cc313d8=$0.1260245139 (1,814,753ms), e9bd92a9=$0.1573980556 (2,266,532ms). No spend gap. Missing smoke lines are intentional early returns: A-4460 hub test failure; A-4644 duration-budget failure. A-4595 contains Neovim smoke. Implementing Coordinator's bounded 120s accounting wait, pending-confirmation fallback and one late correction; regressions cover saved outcome/log through restart and accounting confirmation.
