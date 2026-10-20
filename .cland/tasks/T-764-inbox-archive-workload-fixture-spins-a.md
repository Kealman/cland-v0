---
id: T-764
kind: task
title: inbox-archive-workload fixture spins a setImmediate turn counter through startup and archive I/O
state: open
status: in progress
size: S
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: null
branch: t/T-764-inbox-archive-workload-fixture-spins-a
created: 2026-10-17T23:34:30.008Z
updated: 2026-10-20T09:42:22.100Z
---

## Summary

Found by impl-703 on 2026-10-17 at 23:34Z, during T-703. hub/test/inbox-archive-workload.ts keeps a continuously rescheduled setImmediate turn counter running across projectHub startup and archive I/O. It spins CPU while the fixture waits on filesystem work, which slows the inbox workload cases and loads the machine. The assertions need the counter only to check that the final stop sweep is unique.

## What to build

Observe turns only during the stop-coalescing phase that the assertion checks, so no counter runs during startup or archive I/O. The uniqueness assertion stays unchanged.

## Acceptance criteria

- [ ] C1. The turn counter runs only within the stop-coalescing phase, the sweep-uniqueness assertion is unchanged, and the inbox workload files' Mac 5/5 medians drop or stay the same, recorded with before and after.
