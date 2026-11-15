---
id: T-1862
kind: task
title: DigitalOcean provider 422-pause test cancelled at its 2 s timeout in a macOS cover
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
created: 2026-11-15T02:43:23.130Z
updated: 2026-11-15T04:20:48.049Z
---

## Summary

`hub/test/host-provider-digitalocean.test.ts::digitalocean 422 pauses every create until retry time without POST cascades or token leaks` was cancelled at its 2 s test timeout (2.0098 s, `timedOut: true`) in the E-1537 stage-4 macOS cover 145e3085 at 881114bfd. That run was local, macOS arm64, workers 1, peak load 3.43, log A-19474. Its duration baseline is 0.012 s. The cancellation ended T2 with exit 1, so T3, T4 and Web never ran. Afterwards, at the same tree, it passed 5 out of 5 runs alone and 5 out of 5 whole-file runs (80 tests each) on the same Mac.

## What to build

Find what the 422 branch waits on that can take two seconds: fixture setup, the fake API server, the declaration refresh, or a real-time wait that escaped FakeClock. Then do one of these:
- remove the real-time dependency;
- give the test a load-scaled bound, using the shared wait helpers with a named reason, if the work is legitimately slower under load.

The behaviour assertions stay exact: the retry time, the POST count and the token-leak checks. The 429 sibling shares the same `testWaitMs(2000)` timeout, so check it as well.

## Acceptance criteria

- [ ] C1. The cause is named in the item from a reproduction, for example under induced load or with an instrumented fixture, and the fix removes it or bounds it with the shared load-scaled wait (test).
- [ ] C2. Both the 429 and the 422 cases pass 20 out of 20 runs at a 1-minute load of at least 8 on macOS, with unchanged assertions (test).
