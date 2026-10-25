---
id: T-1270
kind: task
title: T-1267's lifecycle-serialization cases use a 1 s node:test bound that a loaded T1 shard can exceed; its Sessions guard comment omits the startup rollback
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-25T01:20:45.703Z
updated: 2026-10-25T01:20:45.703Z
---

## Summary

oc-rev-1 left two low findings on T-1267, in both its source and evidence verdicts. First, the three new hub/test/lifecycle-serialization.test.ts cases (line 43) set a 1 s node:test timeout, which also covers fixture setup. That's the tightest bound in hub/test, and its T1 peers use 2000 ms; stage-cover shard load has tripled test times before. Second, the Sessions close guards (hub/src/adapters/sessions.ts:1392) throw before the relaunch path releases its launch reservation. releaseInterruptedLaunches rolls it back at the next start, but the new comment doesn't say so.

## Acceptance criteria

- [ ] C1. The three lifecycle-serialization cases use the 2000 ms T1 bound, with the assertions unchanged (test).
- [ ] C2. The Sessions guard comment names releaseInterruptedLaunches as the rollback for a relaunch reservation interrupted by close (docs).
