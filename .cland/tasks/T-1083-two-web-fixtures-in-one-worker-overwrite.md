---
id: T-1083
kind: task
title: Two Web fixtures in one worker overwrite each other's failure trace
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: null
branch: null
created: 2026-10-21T19:12:58.162Z
updated: 2026-10-24T06:46:20.877Z
---

## Summary

`web/test/harness.ts` keeps its failure-trace serial inside `webFixture`, so two fixtures in one worker can write the same `${pid}-0.zip`. In impl-1071's red run (T-1071), the copied-tracker case and the 300-item case both reported `web/test-results/51103-0.zip`, and one failure trace overwrote the other.

## Acceptance criteria

- [ ] C1. Two failing Web fixtures in one worker leave two distinct trace files, each named in its own failure (test).
