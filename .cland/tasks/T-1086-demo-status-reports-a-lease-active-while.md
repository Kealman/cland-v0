---
id: T-1086
kind: task
title: demo status reports a lease active while demo exec still refuses it as missing
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-969
branch: t/T-1086-demo-status-reports-a-lease-active-while
created: 2026-10-21T22:43:41.082Z
updated: 2026-10-24T11:51:16.354Z
---

## Summary

During `cland demo start E-1006 --commit <sha>`, a concurrent `cland demo status` already reported the lease (7e756c3c) as active at that commit. `cland demo exec` then refused twice with "no active demo lease; start a demo or run locally at the same commit" until the start call returned at 22:41:55Z (qa-676, 2026-10-21). Status and exec disagree about when a lease is usable.

## Acceptance criteria

- [ ] C1. `demo status` reports a lease as active only once `demo exec` accepts it, or it reports a distinct "provisioning" state until then (test).
- [ ] C2. `demo exec` during provisioning refuses with a message that names the provisioning lease, not "no active demo lease" (test).

## Comments

### impl-1086 · 2026-10-24T11:51:16.354Z

Diagnosed provider lease active vs demo.ready mismatch at ad611df9. Proposed sealed T2 public demo frame seam with held scripted delivery; requested seam confirmation from lead. Consumer inventory published in item topic. No real droplets or process probes.
