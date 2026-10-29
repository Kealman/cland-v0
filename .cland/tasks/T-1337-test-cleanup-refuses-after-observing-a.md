---
id: T-1337
kind: task
title: Test cleanup refuses after observing a native exit because it cannot confirm the exited process's descendants
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
regression_of: T-543
topic: topic-1213
branch: t/T-1337-test-cleanup-refuses-after-observing-a
created: 2026-10-26T10:49:09.893Z
updated: 2026-10-29T19:09:35.067Z
---

## Summary

Since T-543, the test harness's process cleanup sometimes refuses at teardown with "native process identity unavailable for pid N; fixture preserved; captured: known; current: native exit observed; listed descendants are not confirmed gone". The cleanup observes the process's native exit, but cannot then confirm its listed descendants, so a passing test fails in its after-hook. It hit hub/test/init-process.test.ts::"a Claude Code session launched in the initialised project gets the project hooks and reads AGENTS.md…" in T-1328's rule 6 run d8110385 (A-12357, Linux). The same message appears in A-12067 and A-12158. The case passed 5/5 alone.

## What to build

When cleanup observes a recorded process's native exit, confirm each listed descendant by its own captured identity (gone, or a different birth), instead of refusing because the parent's identity is no longer readable. Keep refusing when a descendant is still alive with the captured identity. The precise identity rules from T-543 stay intact.

## Acceptance criteria

- [x] C1. A recorded process that exits during teardown, with descendants that exited too, is cleaned without a refusal, while a descendant still alive under its captured identity is still reported, shown with injected process facts (test).
  - done: impl-1337 · 2026-10-29T19:09:34.959Z

## Comments

### impl-1337 · 2026-10-29T19:08:12.623Z

Scope/seam: existing synthetic OS boundary in hub/test/process-cleanup.test.ts, explicitly required by C1 (injected process facts). Consumer search: process-cleanup.ts is test-only; requireIdentities serves recorded and discovered cleanup and final signal waits. process table retention is also used by production system-processes.ts; leave that contract unchanged. Existing process-cleanup tests cover native exit, unreadable birth, replacement PID, group/ancestry ownership; preserve these and add final-wait captured-descendant controls. No wire/schema/credential or production permission change.
