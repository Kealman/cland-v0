---
id: T-1337
kind: task
title: Test cleanup refuses after observing a native exit because it cannot confirm the exited process's descendants
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
regression_of: T-543
topic: null
branch: null
created: 2026-10-26T10:49:09.893Z
updated: 2026-10-29T15:58:53.934Z
---

## Summary

Since T-543, the test harness's process cleanup sometimes refuses at teardown with "native process identity unavailable for pid N; fixture preserved; captured: known; current: native exit observed; listed descendants are not confirmed gone". The cleanup observes the process's native exit, but cannot then confirm its listed descendants, so a passing test fails in its after-hook. It hit hub/test/init-process.test.ts::"a Claude Code session launched in the initialised project gets the project hooks and reads AGENTS.md…" in T-1328's rule 6 run d8110385 (A-12357, Linux). The same message appears in A-12067 and A-12158. The case passed 5/5 alone.

## What to build

When cleanup observes a recorded process's native exit, confirm each listed descendant by its own captured identity (gone, or a different birth), instead of refusing because the parent's identity is no longer readable. Keep refusing when a descendant is still alive with the captured identity. The precise identity rules from T-543 stay intact.

## Acceptance criteria

- [ ] C1. A recorded process that exits during teardown, with descendants that exited too, is cleaned without a refusal, while a descendant still alive under its captured identity is still reported, shown with injected process facts (test).
