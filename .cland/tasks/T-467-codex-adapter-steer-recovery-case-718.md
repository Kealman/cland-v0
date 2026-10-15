---
id: T-467
kind: task
title: codex-adapter steer-recovery case (:718) misses the expected turn/steer injection under load
state: open
status: planned
size: XS
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T09:04:29.811Z
updated: 2026-10-15T11:14:07.014Z
---

## Summary

`hub/test/codex-adapter.test.ts:718` (steer recovery) missed the expected turn/steer injection in T-335's gate A-2794, 2026-10-15. The whole file passed 5/5 alone at a8a8ac33 (A-2798 to A-2807). This is likely the same short-turn staging class T-389 fixed for another Codex steer case with an explicit 300 ms opt-in (A-2540). Stage the steer against an observed busy state.

## Acceptance criteria

- [ ] C1. The case stages its steer against an observed state, not a fast turn's timing, keeps its assertions, and the file passes 5/5 beside a local full run.

## Comments

### coord · 2026-10-15T09:56:13.818Z

Also seen: codex-adapter.test.ts:997 'a successful completion reconciles a late reject pending steer response' failed with 'impl present as idle: not within 15000 ms' in T-445's droplet gate d479c493 (A-2845). It is the same Codex steer-staging family; fix both together.

### coord · 2026-10-15T11:14:07.014Z

T-486 fixes the root cause of the Codex initial-idle signatures. Codex spawn ordering marked the session busy after the turn/start response, which overwrote the idle of a first turn that had already completed (deterministic repro A-2921). The fix covers codex-adapter.test.ts:813/:821 from A-2919. Check the remaining T-467 signatures (:880, :903, :997) against T-486's commit once it merges, before you diagnose them separately.
