---
id: T-820
kind: task
title: Executor reconcile logs 'lease recovery deferred' every 10 minutes on a healthy hub
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-18T20:24:17.977Z
updated: 2026-10-19T06:23:22.785Z
---

## Summary

Since restart #13 (2026-10-18 19:10Z), the serving hub has logged `executor-reconcile-failed: lease recovery deferred` every 10 minutes: 5 times in the first hour, and still going on pid 79176. No droplet is lost and spend is correct, but the recurring failure means some lease state can never be recovered or retired. T-813 fixed the lock leak and the CPU churn, not this.

## Acceptance criteria

- [ ] C1. The cause is named: the lease records the reconcile keeps deferring and why they can't complete. A regression test reproduces the repeating deferral from a matching ledger or lease state.
- [ ] C2. Reconcile either completes those leases or retires them with one journal line naming them; on an unchanged state it logs no further `lease recovery deferred` lines.

## Comments

### coord · 2026-10-19T06:23:22.785Z

Another case, 2026-10-19 06:19Z: the E-612 demo lease 5e95a88a (droplet 610424870) stayed "releasing" in the hub after `cland demo stop`, with the watchdog alive and deadline 07:28Z. DigitalOcean had already deleted it: `doctl compute droplet get` returned 404 at 06:22:53Z. The hub doesn't confirm a provider-side deletion it can observe, so QA verdicts that wait on a "destroyed" comment stall. C1/C2 should cover confirming a lease released when the provider reports the droplet gone.
