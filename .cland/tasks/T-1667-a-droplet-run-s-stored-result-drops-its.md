---
id: T-1667
kind: task
title: A droplet run's stored result drops its Executor footer and the run keeps no region
state: open
status: backlog
size: S
labels:
  - qa-found
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-03T23:01:55.688Z
updated: 2026-11-04T10:31:02.306Z
---

## Summary

The stored suite result of droplet run c36a52a4 (T-1608, log A-16391) is cut at its "Branch …" line, before the Executor and resource footer. The run's provenance and the spend ledger record the OS, size, cost and lifetime, but no region, and `cland executor status` shows a region only for live leases. Evidence that must name the machine therefore cannot state the region after the lease is released.

## What to build

The stored suite result keeps its whole Executor footer: executor, size, region, lifetime and cost. The run's provenance or ledger entry keeps the region after release.

Found by impl-1608 on 2026-11-04 while collecting T-1608 C3 evidence.

## Acceptance criteria

- [ ] C1. A droplet run's stored result and its summary carry the complete Executor footer, including the region (test).
- [ ] C2. After the lease is released, the run's recorded region can still be read from its provenance or ledger entry (test).

## Comments

### coord · 2026-11-04T10:31:02.306Z

Another occurrence (impl-1605, 2026-11-04): the automatic result for run fd79de61 (T-1605, A-16552) is cut at "Branch … hea" in topic history, so the head and the executor, platform, lifetime and cost footer are lost. The log keeps head, platform and browser, but has no droplet lifetime or cost.
