---
id: T-1086
kind: task
title: demo status reports a lease active while demo exec still refuses it as missing
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: null
branch: null
created: 2026-10-21T22:43:41.082Z
updated: 2026-10-24T06:46:18.992Z
---

## Summary

During `cland demo start E-1006 --commit <sha>`, a concurrent `cland demo status` already reported the lease (7e756c3c) as active at that commit. `cland demo exec` then refused twice with "no active demo lease; start a demo or run locally at the same commit" until the start call returned at 22:41:55Z (qa-676, 2026-10-21). Status and exec disagree about when a lease is usable.

## Acceptance criteria

- [ ] C1. `demo status` reports a lease as active only once `demo exec` accepts it, or it reports a distinct "provisioning" state until then (test).
- [ ] C2. `demo exec` during provisioning refuses with a message that names the provisioning lease, not "no active demo lease" (test).
