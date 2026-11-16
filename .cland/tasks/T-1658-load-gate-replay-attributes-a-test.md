---
id: T-1658
kind: task
title: Load-gate replay attributes a test registered in a shared helper module to the helper file and replays nothing
state: closed
status: done
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-03T06:03:45.647Z
updated: 2026-11-16T07:28:04.309Z
closed: 2026-11-16T07:28:04.309Z
---

## Summary

T-1625's verify edce9e0b (A-16187) passed both generated contract tests in their base run on Linux. The T3 load gate then failed each one 0/5 with "expected one passing receipt, received …". The reporter attributes the tests to `hub/test/transport-contract.ts`, the shared helper that calls `test()`, and the load-gate replay runs that helper file alone, which registers no tests. A shared contract suite, the pattern E-1538 asks for, can't pass the load gate unless every `test()` call moves into the entry files.

## What to build

Either the load gate replays the entry file that imported the registering helper, or test lint refuses `test()` registration outside `*.test.ts` and names the fix. Pick one, and record why.

## Acceptance criteria

- [ ] C1. A T3 test registered through a shared helper either passes load-gate replay through its entry file, or is refused by test lint with a message naming the entry-file fix; there is no silent 0/5 (test).

## Comments

### coord · 2026-11-16T07:28:04.309Z

Merged into T-1575 (triage A-19813): same root cause (`hub/test/load-gate.ts` launches the source file of `test()`). T-1658's lint option is kept as an alternative fix for T-1575.
