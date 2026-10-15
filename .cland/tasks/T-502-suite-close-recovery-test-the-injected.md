---
id: T-502
kind: task
title: "suite-close-recovery test: the injected machine loss can land after shard 1 already passed (Linux)"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-395
topic: null
branch: null
created: 2026-10-15T14:57:11.991Z
updated: 2026-10-15T14:57:11.991Z
---

## Problem

`hub/test/suite-close-recovery.test.ts:54`, T-395's lost-machine case, expects `/shard-1: remote machine lost/`. In T-456's droplet verify ae7c7a40 (A-3082:3993–4018) on Linux, both shards passed with exit 0 instead. The fake machine loss apparently lands after shard 1 has already finished, so the test races its own fault injection. This is T-395's new test, so it's rework of T-395.

## Acceptance criteria

- [ ] C1. The fault is injected at an observed point where shard 1 is still running, using a gate in the fake executor rather than wall-clock timing, so the case always exercises the lost-machine path. Every assertion stays, and the root cause is recorded in the commit.
- [ ] C2. suite-close-recovery.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
