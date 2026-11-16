---
id: T-1898
kind: task
title: Delivery fail-fast and one-command fallback off droplets
state: open
status: backlog
size: M
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1859
topic: null
branch: null
created: 2026-11-16T07:29:46.497Z
updated: 2026-11-16T07:29:48.454Z
---

## Summary

`configuration.ts:239` lists `verification.executor` and `verification.droplet` as applied on reload, yet restarts #71–#75 were used to switch (unverified why). One command switches executor, workers and batch location live and verifies the switch. It also adds a pre-submit reachability probe and T-1664's C2 (replace the droplet once). Merges impl #7 and §7 #7.

Kind: product. Triage ticket H-10 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [ ] C1. `cland verify executor local\|droplet` (name unverified) switches executor and workers without a hub restart, and the next queued run uses the new executor (test).
- [ ] C2. A transport-level delivery failure after T-1842's retry replaces the droplet once within the run (test).
- [ ] C3. A region whose API or SSH probe fails before submission is skipped with a reason naming it (test).

## Dependencies

T-1859
