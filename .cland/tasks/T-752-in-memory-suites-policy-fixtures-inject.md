---
id: T-752
kind: task
title: In-memory Suites policy fixtures inject the duration-budget context instead of reading native Git
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: null
branch: null
created: 2026-10-17T18:44:08.769Z
updated: 2026-10-17T21:48:43.246Z
---

## Summary

Route R2 in T-748's trip list (A-4703): nine T1/T2 suite policy files (suite-cache, suite-cover, executor-run-rules, suite-accounting and others) reach production durationBudgetContext, which reads Git history, so in-memory policy tests start git children.

## What to build

The Suites fixture seam takes a complete duration-budget and history context (manifest, base and legacy keys) as data, and in-memory policy fixtures pass it. Production keeps its Git-backed context, and one T2/T3 test proves the Git-backed path.

## Acceptance criteria

- [ ] C1. The runtime tripwire reports no child_process trip in the nine R2 files, proved by a full droplet run's trip report, with every policy assertion unchanged.
