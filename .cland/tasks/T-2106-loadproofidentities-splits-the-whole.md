---
id: T-2106
kind: task
title: loadProofIdentities splits the whole retained log into an array; scan it line by line like T-1936's completion summary
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-25T13:17:00.593Z
updated: 2026-11-25T13:17:00.593Z
---

## Summary

`loadProofIdentities` in `hub/src/suite-load-gate-plan.ts` still builds a whole-log `split`/`flatMap` array, the same unbounded allocation T-1936 removed from `loadGateCompletionSummary`. rev-40 raised it as an aside in T-1936's source clear (A-23414); it was outside T-1936's scope.

## What to build

Walk the log by index the way T-1936 does, keeping only the current line and the identity set, and preserve the exact grammar and result order.

## Acceptance criteria

- [ ] C1. A large-log case proves loadProofIdentities allocates no whole-log array, by a work or allocation count, with the same identities in the same order as before (test).
