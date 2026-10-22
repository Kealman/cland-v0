---
id: T-1103
kind: task
title: FOLLOWS-001 sometimes asserts E-4's follows before its card facts arrive under the stub hub
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1091
topic: topic-877
branch: t/T-1103-follows-001-sometimes-asserts-e-4-s
created: 2026-10-22T09:55:15.125Z
updated: 2026-10-22T23:37:03.555Z
---

## Summary

Periodic dev T3 run ca10630b (A-9077, dev ff6edeaa, Linux droplet) failed `nvim/test/qa.test.ts` "FOLLOWS-001 reaches its closed predecessor task under both the stdio and stub hubs": under `--hub stub` the case returned FAIL "the hub reports E-4 follows E-2" after 488 ms. The same test passed in five other Linux and macOS runs that day (A-8956, A-8963, A-9033, A-9064, A-9069; 0.8–1.8 s). T-1091 rewrote FOLLOWS-001 to focus E-4's card explicitly before asserting the relationship; the stub path still races the card's facts arriving.

## Acceptance criteria

- [x] C1. FOLLOWS-001 waits, with a bound, for E-4's card to show its follows relationship (the durable receipt, rule 9) before asserting it, under both the stdio and stub hubs, and keeps every existing assertion (test).
  - done: impl-1103 · 2026-10-22T23:36:39.731Z
- [x] C2. The case passes 20/20 locally under both hubs with a parallel CPU load, in a disposable root under rule 15, and the samples are listed in the item topic (test).
  - done: impl-1103 · 2026-10-22T23:36:40.161Z

## Comments

### coord · 2026-10-22T22:09:53.200Z

Recurred in T-1152's verify all c06bc92d at ebe47ab8 (A-9475, Linux c-8 lon1): FOLLOWS-001 reaches its closed predecessor task under both the stdio and stub hubs. That run failed only on this test.

### coord · 2026-10-22T23:32:09.461Z

Recurred again in T-1152's verify all a1a29f10 at ebe47ab8 (A-9529, Linux c-8 lon1, 2026-10-22 23:31Z), the only failure in 3691 tests: under `--hub stub` FOLLOWS-001 returned FAIL "the hub reports E-4 follows E-2" after 415 ms while the card was still "loading the agents' text…". T-1152 cannot reach this path: nvim/test/stub-hub.ts imports only types from hub/src, and T-1152 changes hub startup (daemon, dispatch, server). Third Linux sighting (dev ff6edeaa, then T-1152 twice); it fails at a rate that now blocks gates, so it needs a fix soon.

### impl-1103 · 2026-10-22T23:34:11.074Z

Implementation started at the existing FOLLOWS-001 rendered-card seam. Reproduction uses a copied disposable repository, allowlisted environment with scratch HOME/XDG/Git config and shared credential filter, pinned Neovim v0.12.5, and at most two owned yes processes. Local suite queue had no holder before the batch. No timeout change is planned.
