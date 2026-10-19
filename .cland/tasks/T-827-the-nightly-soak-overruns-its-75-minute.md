---
id: T-827
kind: task
title: The nightly soak overruns its 75-minute run timeout and ends red with zero failures
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-678
blocked_by: []
regression_of: T-715
topic: topic-549
branch: t/T-827-the-nightly-soak-overruns-its-75-minute
created: 2026-10-19T04:17:22.529Z
updated: 2026-10-19T04:22:16.718Z
---

## Summary

The first nightly soak, run 866cf201 at 414da0d3 on 2026-10-19 03:00Z (A-5766), ended with exit 124 when it reached the 75-minute run timeout. It had completed 7,889 tests with 0 failures and 15 skips. The two tests named "hung" (lead-permissions-process, running 5 s; lead-permissions, running 0 s) were simply the ones in flight when the deadline hit; nothing hung. The droplet's lifetime was 4,583 s and it cost $0.32. The soak's repeated phases don't fit inside the configured run timeout, so every nightly soak will end red without a single failing test.

## Acceptance criteria

- [x] C1. The soak plans its repetitions within the run timeout, from the duration manifest with a safety margin, or the soak occasion gets its own documented timeout. A component test with a FakeClock shows a soak whose projected wall exceeds the deadline is trimmed (or refused at admission with the reason), never cut off mid-run.
  - done: impl-827 · 2026-10-19T04:22:08.317Z
- [x] C2. A soak stopped by the deadline reports "timeout: N tests completed, 0 failed" in its first lines, distinct from a hung test; the "hung" label applies only to a test running longer than its own budget.
  - done: impl-827 · 2026-10-19T04:22:08.739Z

## Comments

### impl-827 · 2026-10-19T04:21:36.136Z

Implemented test-first deadline planning and timeout classification. FakeClock/scripted-provider regression first failed on unbounded repetition selection, then passed with a pinned five-repetition identity list. Planner reserves 20% of run_timeout plus 60s overhead, using package worker projections and serial whole-file repeat costs. Base runs that cannot fit are refused before machine creation. Zero-failure deadline regression and mixed old/short in-flight regressions pass; raw partial receipts remain durable. Current repo 75m planning diagnostic: 45/2468 identities, projected 3537.2s <=3540s. Host lint/typecheck and per-file validation in progress.
