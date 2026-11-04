---
id: T-1671
kind: task
title: "Codex failed-launch settlement is lost across a hub restart: the async unforward callback lives only in memory"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by:
  - T-1607
regression_of: T-1606
topic: null
branch: null
created: 2026-11-04T02:35:52.074Z
updated: 2026-11-04T02:35:54.675Z
---

## Summary

impl-1607 found during T-1607 (2026-11-04) that Sessions persists a failed launch's pending files, but `#recoveryObservers`, which carry the `LaunchSettled` callback, live only in memory. After a hub restart the generic rollback succeeds and `#settleFailedLaunch` has no callback, so the role can be released without the adapter's native settlement. T-1606's Codex callback (close or delete live, then unforward on the host) is exposed to the same gap. T-1607 adds an optional `HarnessAdapter.settleFailedLaunch(process)` fallback for Claude.

## What to build

Codex implements `settleFailedLaunch`. It rebuilds its bounded settlement (close and unforward) from exact-generation state after a restart, and fails closed with `cleanup-incomplete` and the role held when it cannot.

## Acceptance criteria

- [ ] C1. A hub restart between a failed remote Codex launch and its settlement still unforwards on the host before the role is released (test).
- [ ] C2. When the generation state is missing after the restart, the row stays held with `cleanup-incomplete` and its cause (test).
