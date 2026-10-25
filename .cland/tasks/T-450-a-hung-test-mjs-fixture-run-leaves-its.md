---
id: T-450
kind: task
title: A hung.test.mjs fixture run leaves its runner and child alive for hours (orphan from the hung-run tests)
state: open
status: in progress
size: S
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
regression_of: T-385
topic: null
branch: t/T-450-a-hung-test-mjs-fixture-run-leaves-its
created: 2026-10-15T03:49:38.455Z
updated: 2026-10-25T17:08:50.392Z
---

## Summary

impl-397 found two orphan node processes, about 15 h old (PID 48761 under PPID 1, and its child 48920), at 0% CPU. They were running `hung.test.mjs` from the suite directory `/private/tmp/cland-suite-cb5d74ec-…`. They are the leftover of T-385's hung-run test fixture from a run on 2026-10-14 about 12:25Z, which survived both its suite and the phase orphan sweep. The Coordinator terminated them on 2026-10-15 03:50Z, after checking the command lines. The hung-run tests must reap their own hung child even when the run times out, and the phase sweep should catch such a runner.

## Acceptance criteria

- [ ] C1. A test that starts a hung fixture run kills its runner and children on every exit path, and the file passes 5/5 with no node process left afterwards.
- [ ] C2. The runner's phase sweep reports a leaked hung fixture runner, proven by a test that leaks one on purpose.
