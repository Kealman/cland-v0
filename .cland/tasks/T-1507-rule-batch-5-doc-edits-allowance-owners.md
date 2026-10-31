---
id: T-1507
kind: task
title: "Rule batch 5 doc edits: allowance owners, synthetic-PID fixtures, epic QA topics, memory probe guide"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-31T08:18:54.756Z
updated: 2026-10-31T08:18:54.756Z
---

## Summary

Doc edits from rule batch 5 (A-14855), accepted by the human on 2026-10-31. No code changes.

## Acceptance criteria

- [ ] C1. The duration-allowance section of `docs/agents/tests.md` says that an allowance names a standing container (E-880) as its owner from the start, carries added, expires and a reason, and is admitted only after at least two recorded passing samples replay through the production checker.
- [ ] C2. `docs/agents/tests.md` says that synthetic-PID T2 fixtures inject the complete liveness and identity observer, with a child-launch guard from setup through shutdown, and that native-default observer coverage stays in T3.
- [ ] C3. The qa skill says that an epic QA request goes in a topic bound to the epic, never in Agents, because QA can publish artifacts only where its request arrived.
- [ ] C4. The measure-memory per-file test guide says that copied state is prepared in a separate process before the measured subject launches, and that a startup-memory artifact records a digest of the measured startup files.
