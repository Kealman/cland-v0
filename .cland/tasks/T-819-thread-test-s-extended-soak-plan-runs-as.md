---
id: T-819
kind: task
title: thread.test's extended soak plan runs as a T2 test and takes 61 s in stage runs
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
regression_of: T-809
topic: null
branch: null
created: 2026-10-18T19:57:07.798Z
updated: 2026-10-18T19:57:07.798Z
---

## Summary

Since T-809 merged, the extended 4×25 replay in `nvim/test/thread.test.ts` › "generated live appends, ask evictions and delivery changes equal a full render" runs under the soak selection of stage runs. It took 61.4 s and the file 78.4 s in the E-678 stage-1 Linux run 8695f749 (A-5551), against a T2 budget of 2 s per test and 30 s per file. That is report-only today, but it would fail once budgets turn hard.

## Acceptance criteria

- [ ] C1. The extended soak plan of the thread test is a separate test tagged T4 (or selected only by the soak), and the ordinary T2 test keeps its 2×12 plan within the T2 budgets; tiers.json and durations.json carry both.
