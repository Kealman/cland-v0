---
id: T-1504
kind: task
title: test:tiers refuses a duration allowance owned by an epic
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-31T08:18:54.263Z
updated: 2026-10-31T08:18:54.263Z
---

## Summary

`test:tiers` refuses a duration allowance owned by a task (T-761). An allowance owned by an epic passes, and the epic then cannot close. Extend the refusal to epics, so allowances are owned by a standing container such as E-880 from the start. Rule batch 5 (A-14855) C1, accepted by the human on 2026-10-31.

## Evidence

E-1466 owned the measure-memory analyzer allowance, and `task close E-1466` was refused. Re-owning it to E-880 (e5b310a78) changed `hub/test/durations.json`, which staled the clear QA demo, so a third demo was needed.

## Acceptance criteria

- [ ] C1. `test:tiers` refuses an allowance whose owner is an epic, with the same message shape as the task-owner refusal, naming the allowance key and a standing container to use instead.
- [ ] C2. The existing allowances in `hub/test/durations.json` pass the new check, or are re-owned in the same item with their added/expires/reason kept.
