---
id: T-527
kind: task
title: "territory-lock test: a fixed 100 ms sleep races the first lock holder (Linux)"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-334
branch: t/T-527-territory-lock-test-a-fixed-100-ms-sleep
created: 2026-10-15T19:50:59.979Z
updated: 2026-10-15T22:29:13.087Z
---

## Problem

`hub/test/territory-lock.test.ts:41–42` sleeps a fixed 100 ms before its lock assertions. On Linux under load it saw 'could not take guard' where 'another territory operation holds the lock' was expected, in T-502's droplet verify f23a4f38 (A-3310:4128–4151). The fixed sleep races the first holder taking the lock.

## Acceptance criteria

- [ ] C1. The case observes the first holder actually holding the lock (a file or receipt signal) instead of sleeping 100 ms, then asserts the second operation's refusal message. Every assertion stays.
- [ ] C2. territory-lock.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-527 · 2026-10-15T22:29:13.087Z

Read T-527, E-482 decisions and R-294/spec. Implementing a first-holder acquisition receipt in the existing territory-lock test; all refusal, completion, stale-recovery and rejection assertions stay. Mac baseline is waiting for the single-file test window (load 3.74; another test was detected).
