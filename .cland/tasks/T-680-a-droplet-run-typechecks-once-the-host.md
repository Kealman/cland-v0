---
id: T-680
kind: task
title: "A droplet run typechecks once: the host gate's result travels with the candidate tree hash"
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-409
branch: t/T-680-a-droplet-run-typechecks-once-the-host
created: 2026-10-16T19:59:27.759Z
updated: 2026-10-16T20:02:19.476Z
---

## Summary

Every droplet run typechecks twice: the host gate runs `npm run typecheck` on the Mac before any droplet is made (`hub/src/hub/suites.ts` `#hostGate`, ~12 s), and the droplet runs it again as command 0 (`hub/src/hub/suite-worker.ts` `suiteCommands`, 14–19 s residual) (report-strategy §1.1, memo §5.2.7). The second run proves nothing the first did not, because the tree is the same.

## What to build

The host gate records what it checked: the candidate tree hash, the command and its exit. The run's job carries that record to the droplet. The droplet worker compares the tree it checked out with the recorded one: equal means it skips the typecheck and logs `typecheck: host gate at <tree> (not repeated)`; different, or no record, means it runs the typecheck as today. Local runs, which have no host gate, keep exactly one typecheck in the worker. The result names which machine ran the typecheck.

This is the step later tickets hang the T0 test lint on (T-682), so the "check step" runs once per run wherever it runs. E-614's T-668 moves the host gate to the project's `check` command; whichever of the two lands second carries the rule over to the other's command.

## Acceptance criteria

- [ ] C1. A droplet run whose host gate passed at tree X runs no typecheck on the droplet and logs the reuse line naming X, proved by a remote-fixture test.
- [ ] C2. A droplet run whose delivered tree differs from the host gate's runs the typecheck on the droplet, proved by a planted-difference test.
- [ ] C3. A local run executes the typecheck exactly once, proved by a suite test.
- [ ] C4. Across 10 droplet task runs after the merge, the median lifetime is at least 12 s below the median of the 10 before, recorded on this item from the lease records.
