---
id: T-2013
kind: task
title: Test lint's elapsed-time taint follows a bounded setup wrapper into unrelated result fields, refusing non-timing assertions
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: null
branch: null
created: 2026-11-19T19:55:40.939Z
updated: 2026-11-24T08:59:55.147Z
---

## Summary

The test lint's elapsed-time taint follows a generic bounded setup wrapper into every field its result returns. In T-1695, a helper returning `within(..., setupDeadline - performance.now())` caused four wall-clock-assertion refusals for `launch.ok`, `sent.ok`, `held.job` and `rows.every(status === 'running')` in host-survival-native, none of which compares elapsed time (impl-1695, full lint 2, 2026-11-19). T-1695 keeps four reasoned lint comments in the meantime.

## What to build

Narrow the taint so a deadline that only bounds acquisition doesn't taint unrelated result data, while true elapsed-time assertions are still detected.

## Acceptance criteria

- [ ] C1. A regression shows a value returned through a deadline-bounded setup wrapper isn't flagged, and an assertion comparing measured elapsed time still is (test).
- [ ] C2. T-1695's four reasoned comments in host-survival-native can be removed with lint still passing (test).
