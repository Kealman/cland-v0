---
id: T-1211
kind: task
title: A sharded cover whose shards were all refused before running reads as red
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-974
branch: t/T-1211-a-sharded-cover-whose-shards-were-all
created: 2026-10-24T08:21:28.177Z
updated: 2026-10-24T11:51:36.044Z
---

## Summary

Found aside by impl-1144 during T-1144 review (2026-10-24 08:21Z). The shard aggregation for stage, epic and release covers (hub/src/hub/suites.ts, near line 834 at T-1144's base) drops each child's `outcome.notRun`. When every shard is refused before any test runs (provider capacity, bundling failure), each child result is unavailable but the parent cover reads failed/red. T-1015 and T-1144 fixed only the unsharded periodic and task paths.

## Acceptance criteria

- [ ] C1. A sharded cover whose shards were all refused before execution reports a not-run outcome naming each shard's cause, with no red wording and no culprit search (test).
- [ ] C2. A cover where some shards ran and others were refused reports the executed results and names the unexecuted shards; it is never green (test).

## Comments

### impl-1211 · 2026-10-24T11:50:58.867Z

Implementation started at ad611df9. Existing claim retained. Investigating shard aggregation loss of outcome.notRun; test-first at the existing sealed scheduler/fake-executor seam, pending lead seam confirmation. Label edit refused by Implementer scope; left needs-triage.
