---
id: T-661
kind: task
title: The duration budget fails a known test only when it's slower than twice its own baseline and over 5 s
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - flaky
  - verification
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-16T16:29:57.261Z
updated: 2026-10-16T16:29:57.261Z
---

## Summary

119 tests sit against the 5 s cliff, so load alone pushes them over and turns runs red (A-4004, recommendation 6). A known test fails the budget only when it's slower than twice its own recorded baseline and over 5 s; a new test still needs its allowance in the same change.

## What to build

The durations check compares a known test with its own baseline in hub/test/durations.json: over 2× and over 5 s fails, anything else is a notice line. A new test absent from the baseline keeps today's rule. File budgets follow the same 2× rule.

## Acceptance criteria

- [ ] C1. A known test at 1.9× its baseline and over 5 s produces a notice, not a failure, and one at 2.1× and over 5 s fails, proved by a durations test.
- [ ] C2. A new test over 5 s without an allowance still fails, and passes with an allowance in the same change, proved by the same test file.
- [ ] C3. docs/agents/tests.md and hub/README.md (Tests) describe the relative budget.
