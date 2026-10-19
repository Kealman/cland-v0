---
id: T-913
kind: task
title: Stream the hub's remaining whole-suite-log reads (T-912 audit A-6744)
state: open
status: in progress
size: M
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by:
  - T-912
regression_of: T-885
topic: topic-656
branch: t/T-913-stream-the-hub-s-remaining-whole-suite
created: 2026-10-19T21:51:09.495Z
updated: 2026-10-19T22:06:30.385Z
---

## Summary

T-912's audit (A-6744) lists the hub's remaining whole-suite-log reads, all without a byte bound. The per-admission ones can repeat the T-912 heap blow-up: cached admission (suites.ts ~522) and `#stageIdentities` (~637). The rest run once per completion but load whole logs, and shard aggregation loads every shard log at once. T-667's command excerpt slices the whole command output before taking its 20-line tail.

## What to build

- Stream or reduce incrementally every reader in A-6744's table: cached admission, stage identities, shard aggregation, machine health, progress, tier and duration reports, new-task proof capture, the integrated cover, `receipt()` and dispatch result publication. Per-admission readers share one in-flight computation and cache their derived result.
- T-667's command excerpt keeps a bounded ring of the last 20 lines instead of materializing the whole output.
- Shard aggregation stops holding every shard log in memory at once.

## Acceptance criteria

- [ ] C1. A T2 test with several 20 MB fake logs and concurrent admissions (cached and stage) shows each log read at most once per derived result, with heap growth bounded.
- [ ] C2. The command excerpt and shard aggregation keep memory bounded on a 50 MB fake output, proved by a T2 test.
- [ ] C3. A grep for `readFile(` on suite logs in hub/src lists only streaming or bounded-tail readers, and the report names each one.
