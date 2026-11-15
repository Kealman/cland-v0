---
id: T-1862
kind: task
title: DigitalOcean provider 422-pause test cancelled at its 2 s timeout in a macOS cover
state: open
status: in progress
size: S
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: null
branch: t/T-1862-digitalocean-provider-422-pause-test
created: 2026-11-15T02:43:23.130Z
updated: 2026-11-15T10:23:37.520Z
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

## Comments

### coord · 2026-11-15T10:23:13.000Z

Second failure, with a different symptom (2026-11-15, T-1806's mode-free verify 8dd973c2 at fa6cb7c65, Linux droplet, log A-19602). The 422 branch's recovery after the retry time expected `['created','created','created']` but got `['created','failed','created']` at host-provider-digitalocean.test.ts:368. One of the three concurrent acquires failed after the pause expired, and the test doesn't print the reason. The provider, fake API and test source are unchanged. Together with the macOS cover timeout (145e3085, A-19474), this points to a concurrency defect in the shared fake API or the provider around the pause expiry, not only a slow fixture. C1 should name both symptoms.
