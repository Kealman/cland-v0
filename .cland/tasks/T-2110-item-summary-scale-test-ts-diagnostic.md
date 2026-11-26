---
id: T-2110
kind: task
title: item-summary-scale.test.ts diagnostic names the interval metric as task/map-only bytes and quotes the old partial baseline
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by:
  - T-2005
topic: null
branch: null
created: 2026-11-25T14:29:21.275Z
updated: 2026-11-25T14:29:21.275Z
---

## Summary

rev-40 raised this as L1 in T-2005's source clear (A-23480). `hub/test/item-summary-scale.test.ts:203` still labels the complete interval metric as task/map-only bytes and quotes the historical partial baseline of 64,062,183 bytes. T-2005 counts every JSON encode in the interval, and the complete baseline is 66,743,717. The 32,000,000-byte bound is still right.

## What to build

Change the diagnostic message to name all interval JSON bytes and quote the complete 66,743,717 baseline, leaving the bound unchanged.

## Acceptance criteria

- [ ] C1. The diagnostic names all interval JSON bytes with the 66,743,717 baseline, and the 32,000,000-byte bound is unchanged (test).
