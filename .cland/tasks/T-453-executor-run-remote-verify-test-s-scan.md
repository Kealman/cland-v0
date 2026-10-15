---
id: T-453
kind: task
title: executor-run remote-verify test's scan reads a transient spend.json.lock.break entry (ENOENT)
state: open
status: planned
size: XS
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T06:07:18.320Z
updated: 2026-10-15T09:14:36.695Z
---

## Summary

`hub/test/executor-run.test.ts:16` (remote verify) failed in T-254's gate b6f1e5ff (A-2699): its state scan at line 45 hit ENOENT, at line 51, on a transient `.cland/executor-state/spend.json.lock.break` entry that the ledger lock removed while the scan read it. T-389 fixed the same class in executor-safety's sentinel scan by quiescing the hub before the audit (A-2595..A-2599). Apply the same boundary here, or skip lock-break entries that vanish during the scan.

## Acceptance criteria

- [ ] C1. The scan tolerates, or excludes by quiescing, the ledger's transient lock entries, and the file passes 5/5 beside a local full run.
