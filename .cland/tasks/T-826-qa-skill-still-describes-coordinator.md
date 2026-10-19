---
id: T-826
kind: task
title: QA skill still describes Coordinator batch covers instead of the merge queue protocol
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: t/T-826-qa-skill-still-describes-coordinator
created: 2026-10-19T03:58:09.423Z
updated: 2026-10-19T04:46:56.613Z
---

## Summary

`.agents/skills/qa/SKILL.md` (around line 61) still tells QA that the Coordinator runs integrated suites per batch of about three merges. Since T-711 and T-713, the merge queue builds batches of up to three items and runs their T1/T3 coverage, and task verify runs T0, T1 and selected T2 tests on queue-enabled projects. Found by impl-718 during T-718's clause audit and kept out of its reviewed head.

## Acceptance criteria

- [ ] C1. The QA skill describes the live protocol: task runs cover T0–T2, merge-queue batches run T1/T3, close occasions and the soak add T4; when QA needs a full suite on a non-dev head it uses `verify all` as the skill says. The wording matches docs/agents/tests.md and the merge skill after T-718.
