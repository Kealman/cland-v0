---
id: T-467
kind: task
title: codex-adapter steer-recovery case (:718) misses the expected turn/steer injection under load
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T09:04:29.811Z
updated: 2026-10-15T09:04:29.811Z
---

## Summary

`hub/test/codex-adapter.test.ts:718` (steer recovery) missed the expected turn/steer injection in T-335's gate A-2794, 2026-10-15. The whole file passed 5/5 alone at a8a8ac33 (A-2798 to A-2807). This is likely the same short-turn staging class T-389 fixed for another Codex steer case with an explicit 300 ms opt-in (A-2540). Stage the steer against an observed busy state.

## Acceptance criteria

- [ ] C1. The case stages its steer against an observed state, not a fast turn's timing, keeps its assertions, and the file passes 5/5 beside a local full run.
