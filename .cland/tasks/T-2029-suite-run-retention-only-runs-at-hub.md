---
id: T-2029
kind: task
title: Suite-run retention only runs at hub start and on suite launch, so an idle hub never sweeps its backlog
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-20T08:02:00.111Z
updated: 2026-11-20T08:02:00.111Z
---

## Summary

Suite-run retention (T-1957, T-1992) runs one pass at hub start (`dispatch.ts:594`) and afterwards only when a suite job launches (`suites.ts:1112`). Each pass handles a bounded number of pending indexed runs plus one 4,096-entry unindexed sweep, so an idle hub never sweeps, and a large backlog takes about one suite launch per 4,096 entries. After restart #91 on 2026-11-20, two passes ran and none followed for 14 minutes (cland-impl's observation).

## What to build

Give retention its own bounded schedule, for example a pass every few minutes while work remains and a slower idle cadence, in addition to the launch trigger. Keep the per-pass bounds and the single-pass-at-a-time guard. Report the backlog and progress in the heartbeat or doctor.

## Acceptance criteria

- [ ] C1. With no suite launches, retention still completes passes on its own schedule until the backlog is swept (test with a fake clock).
- [ ] C2. Passes never overlap, and the per-pass bounds are unchanged (test).
