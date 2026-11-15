---
id: T-1863
kind: task
title: "suite-cancel: run worker found dead right after a refused cross-session cancel (Linux cover)"
state: open
status: backlog
size: S
labels:
  - needs-triage
  - flaky
assignee: null
parent: R-1530
blocked_by: []
topic: null
branch: null
created: 2026-11-15T03:12:15.172Z
updated: 2026-11-15T04:20:48.501Z
---

## Summary

`hub/test/suite-cancel.test.ts::suite cancel refuses another session's run while the human can cancel it by id` failed at line 141, `assert.equal(pidAlive(job.pid!), true)`, with false !== true after 2.5 s. This was in the E-1537 stage-4 Linux droplet cover 3845b0b3 at 881114bfd (shard-2, c-8, workers 2), log A-19475. Other files in the stage were unrelated, and the test file has been unchanged since 5a0ce0799 (2026-11-03). The assertion means the worker of the launched fake run (`node -e "setTimeout(()=>{},30000)"`) was already gone by the time the reviewer's refused cancel returned. So either the worker exited or was reaped early under load, or the refused path still signalled it.

## What to build

Find out why the worker pid was dead. There are three candidates: the fake worker's own lifetime, launch completing before the pid is recorded, or a refused cancel that still reaches the process. A refused cancel must never signal the run. If that is the cause, it's a product defect and the fix goes in the cancel path, not the test. If the test is at fault, make the liveness check wait on the run's recorded state, not a single pidAlive sample. The behaviour assertions stay exact.

## Acceptance criteria

- [ ] C1. The cause is shown from a reproduction under load or from instrumentation. A refused cross-session cancel is proven to send no signal to the run's process group (test).
- [ ] C2. The test passes 20 out of 20 runs at a 1-minute load of at least 8 on Linux, with unchanged refusal and human-cancel assertions (test).
