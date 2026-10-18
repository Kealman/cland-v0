---
id: T-813
kind: task
title: executor status RPC hangs while executor reconcile or lease recovery is deferred
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
created: 2026-10-18T16:28:28.718Z
updated: 2026-10-18T16:28:28.718Z
---

## Summary

Since about 16:23Z on 2026-10-18, `cland executor status` on the serving hub (pid 68650, after restart #11) has not answered within 30 s. Other RPCs (`verify queue`, `inbox`, `session list`, `hub status`) answer in under a second. The executor path seems to block the status RPC: a reconcile or lease recovery holding a lock, or a provider call with no deadline.

## Evidence

- Three tries in a row from 16:23Z: "the hub did not answer on .cland/hub.sock within 30000 ms". At 15:24Z, right after restart #11, the same command answered.
- Hub journal: 16:24:14Z `executor-reconcile-failed: lease recovery deferred`; 16:25:17Z `provider sweep deferred`; an executor sweep with leases 3, failures 2.
- The hub was at 95% CPU and load 11 after 11 lane launches between 16:14Z and 16:21Z. The droplets were fine: 2 cland c-8 for cover db7d5479, and no strays.
- Related: in T-810, impl-810 found that a fixture hub's stop takes about 120 s. It logs `stopping`, then `executor-reconcile-failed: lease recovery deferred` at +60 s. That may be the same blocking path.
- Candidate changes since restart #10: T-797 (executor safety), T-802 (spend accounting), T-609 (ledger path).

## Acceptance criteria

- [ ] C1. `cland executor status` answers within 2 s while a reconcile, lease recovery or provider sweep is in progress or deferred, and reports that state.
- [ ] C2. Every provider call and lock wait in the executor reconcile, lease-recovery and sweep paths has a deadline; a regression test with a provider that never answers proves the status RPC and hub stop still finish within their bounds.
