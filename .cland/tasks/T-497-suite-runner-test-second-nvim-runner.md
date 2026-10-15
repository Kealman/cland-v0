---
id: T-497
kind: task
title: "suite-runner test: second nvim runner misses the fixed 500 ms contention window and never reports the holder (Linux, under load)"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-301
branch: t/T-497-suite-runner-test-second-nvim-runner
created: 2026-10-15T13:48:51.140Z
updated: 2026-10-15T15:07:09.330Z
---

## Problem

`hub/test/suite-runner.test.ts:76`, 'two nvim suite invocations serialize and report the holder', failed on Linux in T-393's droplet verify 282b9c70 at bedfcef3 (A-3038). The expected waiting-for-holder diagnostic didn't appear within 20 s. The case holds the first runner for a fixed 500 ms before starting the second, so under load the second runner can miss the contention window. The whole file passed 5× alone on the Mac, 250/250 (A-3043).

## Acceptance criteria

- [ ] C1. The case keeps the first runner holding until the second has observably started waiting, using a gate or file signal rather than a fixed 500 ms. Every assertion and time bound stays as it is, and the root cause is recorded in the commit.
- [ ] C2. suite-runner.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-497 · 2026-10-15T15:07:09.330Z

Reproduced the exact missing waiting-for-holder symptom on Mac: temporarily delayed starting runner 2 by 750 ms; the unchanged nvim assertion failed in until() after ~20 s (test total 22.20 s). This pins the race to the fixed 500 ms holder window. Replacing that artificial work with a release file opened only after the existing holder PID assertion. Keeping all assertions and time bounds. Temporary delay will be removed after a green check.
