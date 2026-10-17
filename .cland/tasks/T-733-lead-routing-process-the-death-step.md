---
id: T-733
kind: task
title: "lead-routing-process: the death step waits for a pid poll that now runs on the test's FakeClock"
state: open
status: in progress
size: XS
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
regression_of: T-696
topic: topic-431
branch: t/T-733-lead-routing-process-the-death-step
created: 2026-10-17T10:29:48.524Z
updated: 2026-10-17T10:30:10.660Z
---

## Summary

Dev defect from integrated cover 7c3aa637 (A-4460) at 601d9cde. It fails 5/5 alone on the Mac. T-696 moved the Claude Code adapter's pid-check poll onto the hub Clock. T-701's `lead-routing-process.test.ts` runs its hub on a FakeClock, SIGKILLs the implementer and then waits 5 s of real time for `impl died`. The FakeClock is never advanced past the poll, so the death is never seen. Each item was green alone; together they fail.

## What to build

Make the death step drive the hub's time the way the idle step already does: after the SIGKILL, advance the FakeClock by the adapter's poll interval (until the death event, if needed) instead of waiting on real time. Check whether any other test hosts a hub on a FakeClock and waits on real time for an adapter's pid poll, and fix those the same way.

## Acceptance criteria

- [ ] C1. `long idle and death climb from item to epic to release; stopped Leads leave inherited routing` passes 5/5 alone on the Mac and in the task's droplet verify, with every assertion unchanged.
- [ ] C2. The review request lists every test found that hosts a FakeClock hub and waits on an adapter pid poll, each with its fix or the reason it's unaffected.
