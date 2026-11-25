---
id: T-2093
kind: task
title: fixture-socket-lifecycle "a hub serves requests after refusing an unowned fixture registration" breaches its 5 s budget (6.48 s) inside a full local macOS one-worker verify, while it takes 0.5–0.7 s alone
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-24T19:45:49.348Z
updated: 2026-11-24T19:46:06.440Z
---

## Summary

T-1928's local mode-free verify ae587f23 (A-23086, reviewed head 0a0296c81, macOS arm64, Node 24.21.0, local executor, one worker, under human decision ask 5cf558b5) failed only on a duration budget. The failure was `hub/test/fixture-socket-lifecycle.test.ts::a hub serves requests after refusing an unowned fixture registration 6.483 s > 5 s`, in the selected T3 phase (3,398 s, test summary fail 0, peak load 5.49). The file is untouched by T-1928. Run alone 5 times at the same head (load 2.1), it took 679, 639, 581, 634 and 523 ms. That's a tenfold slowdown under full-run contention on one local worker, not a regression.

## What to build

Make this identity's budget robust to contention in local single-worker full runs: find what it waits on under load (socket accept, hub start, fixture registration) and bound that wait, or give it a reasoned allowance in hub/test/durations.json. Don't leave a budget that fails in local runs.

## Acceptance criteria

- [ ] C1. The identity stays within its budget in a full local one-worker run, or its allowance is recorded with the measured cause (test or measurement).

## Comments

### coord · 2026-11-24T19:46:06.440Z

Evidence for the five isolated runs: A-23087 (impl-1928). The failing suite log is A-23086, run ae587f23.
