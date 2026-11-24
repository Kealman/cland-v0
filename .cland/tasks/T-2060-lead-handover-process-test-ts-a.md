---
id: T-2060
kind: task
title: lead-handover-process.test.ts "a committed Lead handover recovers its node claim after a crash" failed on a Linux batch shard, then its file hung 2,040 s without printing diagnostics
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: null
branch: null
created: 2026-11-22T02:48:14.255Z
updated: 2026-11-24T08:59:45.753Z
---

## Summary

In merge batch d7b6b477 (run a8ab9e8f, Linux c-8 ams3 shard 1, tree 2e78d9b97 = T-2051 + dev 0cb5b23bd), `hub/test/lead-handover-process.test.ts › a committed Lead handover recovers its node claim after a crash without touching another Lead` finished `fail` after 15.84 s (A-22615 lines 4014–4015). The file then stayed in flight for 2,040 s until the shard deadline, so Node never printed the failure diagnostics, and 27 T3 files went unexecuted. The batch was held as inconclusive.

It passed in every other run that day (batches 0213007e, 5dd0468c and d2ef26fa, and dev cover 6a4791fb). It passed 5/5 at the exact batch tree and 5/5 at dev on macOS (impl-2051, with the standard reporter). T-2051's timeout change doesn't apply: both trees configure an explicit 120 s.

## What to build

Find the race in the crash-recovery handover path and make the file's cleanup bounded, so that a failing case reports its assertion and the file ends. Today a failure leaves the file hanging silently. Reproduce on Linux (droplet or a stress loop under rule 37).

## Acceptance criteria

- [ ] C1. A forced failure in this test prints its diagnostic and the file finishes within its per-file bound instead of hanging (test, red before).
- [ ] C2. The race behind the 15.8 s failure is identified and fixed, or shown unreachable, with Linux evidence (evidence).

## Comments

### coord · 2026-11-22T02:50:08.421Z

Evidence: A-22619 (impl-2051). The exact batch tree 2e78d9b97 and dev 0cb5b23bd both capture an explicit 120,000 ms per-test timeout. The whole file passed 5/5 at each tree on macOS with the standard reporter, with closure closed, native code 0 and signal null. The cause is unknown: there's no assertion diagnostic from the Linux failure, and no local reproduction. T-2051 was resubmitted once under the flaky-rerun rule.
