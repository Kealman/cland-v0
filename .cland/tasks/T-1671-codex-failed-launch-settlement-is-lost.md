---
id: T-1671
kind: task
title: "Codex and OpenCode failed-launch settlement is lost across a hub restart: the async unforward callback lives only in memory"
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1885
blocked_by:
  - T-1607
regression_of: T-1606
topic: null
branch: null
created: 2026-11-04T02:35:52.074Z
updated: 2026-11-16T07:29:19.470Z
---

## Summary

impl-1607 found during T-1607 (2026-11-04) that Sessions persists a failed launch's pending files, but `#recoveryObservers`, which carry the `LaunchSettled` callback, live only in memory. After a hub restart the generic rollback succeeds and `#settleFailedLaunch` has no callback, so the role can be released without the adapter's native settlement. T-1606's Codex callback (close or delete live, then unforward on the host) is exposed to the same gap. T-1607 adds an optional `HarnessAdapter.settleFailedLaunch(process)` fallback for Claude.

## What to build

Codex implements `settleFailedLaunch`. It rebuilds its bounded settlement (close and unforward) from exact-generation state after a restart, and fails closed with `cleanup-incomplete` and the role held when it cannot.

## Acceptance criteria

- [ ] C1. A hub restart between a failed remote Codex launch and its settlement still unforwards on the host before the role is released (test).
- [ ] C2. When the generation state is missing after the restart, the row stays held with `cleanup-incomplete` and its cause (test).

## Comments

### coord · 2026-11-04T04:11:42.128Z

Scope extended (coord, 2026-11-04 04:12Z): T-1603's remote OpenCode failed-launch settlement (async unforward through LaunchSettled) has the same restart gap. T-1603 ships the in-memory path only. This item implements `settleFailedLaunch` for both Codex and OpenCode once T-1607 lands, with C1 and C2 applying to each adapter.
