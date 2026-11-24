---
id: T-2000
kind: task
title: durations-runner.test.ts's existing cases still use the legacy fixture path without a pre-acquisition owner
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: null
branch: null
created: 2026-11-19T06:48:58.122Z
updated: 2026-11-24T08:59:59.585Z
---

## Summary

The existing cases in `hub/test/durations-runner.test.ts` still use the legacy `fixture()`/`run()` path, with no whole-caller owner registered before acquisition and no separately named setup bound. T-1575 moved only its new wrapper case onto `suiteCase`, as its reviewer asked (impl-1575, 2026-11-19).

## What to build

Move the file's remaining cases onto `suiteCase`, with a whole-caller owner registered before any acquisition and named setup and native-completion bounds. Every assertion keeps its meaning, and the file stays in its tier.

## Acceptance criteria

- [ ] C1. Every case in durations-runner.test.ts runs through `suiteCase` with a pre-acquisition owner and named setup bounds, and all assertions are unchanged (test, diff review).
- [ ] C2. A positively controlled launch guard and the cleanup census still pass for the whole file (test).
