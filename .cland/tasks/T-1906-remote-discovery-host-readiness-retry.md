---
id: T-1906
kind: task
title: remote-discovery-host readiness retry and cleanup waits are fixed 3000/2000 ms and time out under Linux load
state: open
status: backlog
size: XS
labels:
  - flaky
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: null
branch: null
created: 2026-11-16T07:55:28.994Z
updated: 2026-11-16T07:55:28.994Z
---

## Summary

In impl-1731's loaded Linux evidence (2026-11-16, Docker `--init`, Node 24.21.0, CPU cap 4, load 8.1 rising to 13.3, T-1731 candidate 60e82345), `hub/test/remote-discovery-host.test.ts`, which T-1731 didn't change, failed two cases:
- "readiness timeout aborts and drains before autonomous retry": `autonomous retry publishes up: not within 3000 ms`, from `eventually(…, 3000)` at line 108;
- "undrained readiness fences ownership and stop reports cleanup incomplete": `explicit incomplete cleanup receipt: not within 2000 ms`, from line 121.
Both are fixed real-time setup and observation waits under load, the class that T-1889 (H-1, load-aware waits) addresses.

## What to build

After T-1889 lands, re-measure. If these waits are setup or observation waits, they use the load-scaled default. If either bounds a product behaviour, name it with T-1889's `behaviour` option and keep it exact. Only the observation of that behaviour scales. Assertions stay unchanged.

## Acceptance criteria

- [ ] C1. Each of the two waits is classified as a setup wait (scaled) or a behaviour bound (exact, named), with the reason in the test (test).
- [ ] C2. The file passes 20/20 in a Linux `--init` container at a 1-minute load of at least 10, with assertions unchanged (evidence).
