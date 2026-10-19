---
id: T-881
kind: task
title: suite-timeouts fast-exit pipe cleanup case times out waiting for its one cleanup warning
state: open
status: backlog
size: S
labels:
  - qa-found
  - needs-triage
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-19T15:30:17.413Z
updated: 2026-10-19T15:30:17.413Z
---

## Problem

On 2026-10-19 ~15:29Z, impl-869 ran hub/test/suite-timeouts.test.ts alone in the T-869 worktree with the source unchanged (base fa1999d7). The case 'verify reports unverified fast-exit pipe cleanup once, preserves unrelated processes and admits its successor' failed with 'one cleanup warning: not within 15000 ms' after a 21.06 s run. Seven new implementer sessions were starting on the Mac at the time, so load may be a factor. It has not been diagnosed.

## Acceptance criteria

- [ ] C1. The case's cause is identified and fixed (or the wait is made load-independent), and hub/test/suite-timeouts.test.ts passes 20/20 serially on the Mac, both as a whole file and with that case alone.
