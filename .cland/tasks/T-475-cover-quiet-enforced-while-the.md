---
id: T-475
kind: task
title: "Cover-quiet enforced: while the Coordinator's integrated cover holds the slot, the test harness refuses to start a fixture hub"
state: open
status: backlog
size: M
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-425
blocked_by: []
topic: null
branch: null
created: 2026-10-15T09:13:18.684Z
updated: 2026-10-15T09:13:18.684Z
---

## Summary

Retrospective A-2783, STOP 1: all 7 flaky red covers had other sessions' test runs beside them. The cover-quiet rule (2026-10-15) is an agreement. Make it a refusal: a test process outside the cover itself does not start while an integrated cover runs.

## What to build

`hub/test/harness.ts` and `nvim/test`'s runner ask the project's hub (`suite.slot` read-only) at start. When the local holder is an integrated run, the process exits with a `cover-quiet` message naming the run, unless it is that run's own worker (an inherited lease) or `CLAND_TEST_IGNORE_COVER=1` is set by the human. Without a hub, there is no refusal.

## Acceptance criteria

- [ ] C1. A targeted test started while an integrated cover holds the local slot exits with `cover-quiet` before starting any fixture.
- [ ] C2. The cover's own workers and runs without a project hub are unaffected.
- [ ] C3. docs/agents/tests.md and the Implementer clause describe the refusal and the human's override.
