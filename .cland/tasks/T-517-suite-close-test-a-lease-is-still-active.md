---
id: T-517
kind: task
title: "suite-close test: a lease is still active right after a successful sharded result (Linux)"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-395
topic: null
branch: null
created: 2026-10-15T17:18:57.301Z
updated: 2026-10-15T17:18:57.301Z
---

## Problem

`hub/test/suite-close.test.ts:82` expects the executor's leases to be `[]` after a successful sharded result. On Linux, in T-394's droplet verify 8970a57f (A-3204, peak load 12.6), one lease and its watchdog were still active when the test looked. Either the lease release completes after the result is reported, so the test reads too early, or the release is genuinely late. A late release would matter for spend and the `cland` tag listing. It's T-395's file, so it's rework of T-395.

## Acceptance criteria

- [ ] C1. Decide and record which it is. If release is by design asynchronous after the result, the test waits for the observed release within a bounded window. If the result should come only after release, the hub releases first, as a product fix. Every other assertion stays.
- [ ] C2. suite-close.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
