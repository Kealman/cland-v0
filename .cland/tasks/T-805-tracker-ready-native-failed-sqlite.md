---
id: T-805
kind: task
title: 'tracker-ready-native: "failed SQLite identity adoption…" asserts the injected failure right after presence, before adoption has run (macOS under load)'
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-18T13:55:15.045Z
updated: 2026-10-18T13:55:15.045Z
---

## Summary

hub/test/tracker-ready-native.test.ts:481 failed in E-678's macOS stage run 262de16a (A-5335), at peak load 15. `assert.ok(failures >= 1)` runs right after `rev.waitForPresence(['rev'])`, but the identity-adoption transaction that hits the mocked `update tracker_written_verdicts set session_id` runs asynchronously after presence, so under load the counter is still 0. Alone on the Mac it passes 5/5 (15/15 tests each).

## Acceptance criteria

- [ ] C1. The test waits on an observed adoption attempt (failures ≥ 1, through the existing eventually helper or an adoption event) before its assertions, keeping every assertion. It passes 20/20 under a planted delay of the adoption step.
