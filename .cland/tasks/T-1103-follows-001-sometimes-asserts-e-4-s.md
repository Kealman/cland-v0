---
id: T-1103
kind: task
title: FOLLOWS-001 sometimes asserts E-4's follows before its card facts arrive under the stub hub
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1091
topic: null
branch: null
created: 2026-10-22T09:55:15.125Z
updated: 2026-10-22T22:09:53.200Z
---

## Summary

Periodic dev T3 run ca10630b (A-9077, dev ff6edeaa, Linux droplet) failed `nvim/test/qa.test.ts` "FOLLOWS-001 reaches its closed predecessor task under both the stdio and stub hubs": under `--hub stub` the case returned FAIL "the hub reports E-4 follows E-2" after 488 ms. The same test passed in five other Linux and macOS runs that day (A-8956, A-8963, A-9033, A-9064, A-9069; 0.8–1.8 s). T-1091 rewrote FOLLOWS-001 to focus E-4's card explicitly before asserting the relationship; the stub path still races the card's facts arriving.

## Acceptance criteria

- [ ] C1. FOLLOWS-001 waits, with a bound, for E-4's card to show its follows relationship (the durable receipt, rule 9) before asserting it, under both the stdio and stub hubs, and keeps every existing assertion (test).
- [ ] C2. The case passes 20/20 locally under both hubs with a parallel CPU load, in a disposable root under rule 15, and the samples are listed in the item topic (test).

## Comments

### coord · 2026-10-22T22:09:53.200Z

Recurred in T-1152's verify all c06bc92d at ebe47ab8 (A-9475, Linux c-8 lon1): FOLLOWS-001 reaches its closed predecessor task under both the stdio and stub hubs. That run failed only on this test.
