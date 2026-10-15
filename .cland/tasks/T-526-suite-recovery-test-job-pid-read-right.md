---
id: T-526
kind: task
title: "suite-recovery test: job.pid read right after launch is still null under load (Linux)"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T19:50:58.056Z
updated: 2026-10-15T19:50:58.056Z
---

## Problem

`hub/test/suite-recovery.test.ts:158`, 'cancel removes an admitted worker's compatibility FIFO ticket without releasing a racing hand holder', reads `job.pid` immediately after launch and got null on Linux under load. This was in T-502's droplet verify f23a4f38 (A-3310:4109–4126). The worker pid is published asynchronously after admission.

## Acceptance criteria

- [ ] C1. The case waits for the observed worker pid, with a bounded wait on the job record, before asserting on it. Every assertion stays, and the root cause is recorded in the commit.
- [ ] C2. suite-recovery.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
