---
id: T-517
kind: task
title: "suite-close test: a lease is still active right after a successful sharded result (Linux)"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-395
topic: topic-331
branch: t/T-517-suite-close-test-a-lease-is-still-active
created: 2026-10-15T17:18:57.301Z
updated: 2026-10-15T22:32:52.583Z
---

## Problem

`hub/test/suite-close.test.ts:82` expects the executor's leases to be `[]` after a successful sharded result. On Linux, in T-394's droplet verify 8970a57f (A-3204, peak load 12.6), one lease and its watchdog were still active when the test looked. Either the lease release completes after the result is reported, so the test reads too early, or the release is genuinely late. A late release would matter for spend and the `cland` tag listing. It's T-395's file, so it's rework of T-395.

## Acceptance criteria

- [ ] C1. The product race is fixed: reconcile revalidates the current lease and watchdog after its asynchronous liveness probe, under a per-lease mutation queue shared with release, so a completed release is never resurrected as active (A-3407); a deterministic executor regression that fails on the old code proves it, and suite-close assertions stay unchanged.
- [ ] C2. suite-close.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-517 · 2026-10-15T22:31:53.402Z

C1 diagnosis: product race, not a read-too-early assertion. Suites already awaits confirmed DropletExecutor.release() for every shard before publishing the merged result. reconcile() could hold an old active lease across a watchdog liveness/startup await, then rearm/save it after release had persisted released and stopped the old watchdog. A deterministic public executor regression held replacement startup across a completed release and reproduced A-3204 exactly on unchanged product code: active lease + watchdogAlive:true, while provider droplets/keys were empty (1.03s). Fix revalidates the current lease/watchdog under a per-lease mutation queue shared with release's transition to releasing, preserving released ownership and stopping an unused replacement. suite-close assertions remain unchanged.
