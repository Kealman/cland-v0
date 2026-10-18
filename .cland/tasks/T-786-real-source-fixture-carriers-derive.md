---
id: T-786
kind: task
title: Real-source fixture carriers derive their copied file set from the import graph instead of hand-written lists
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-18T07:21:29.054Z
updated: 2026-10-18T07:21:29.054Z
---

## Summary

Tests that copy real sources into a temp project keep hand-written lists of roots and helpers: suite-coverage's harness copy, typecheck's compiler fixture and the archived selector. On 2026-10-18 these lists broke three times. T-684 added until.ts (A-4990), T-709's neutral extraction missed shared/test-support (its M2), and T-709 and T-684 then conflicted on the same list. Each new harness module means another manual edit and another red run.

## What to build

One shared helper computes each carrier's copy set from the import closure of its entry files, using T-744's reachable-import analysis or an equivalent, plus an explicit list of non-import assets. Every carrier uses it. The actual-source coverage proof stays as it is.

## Acceptance criteria

- [ ] C1. Adding a new module imported by harness.ts needs no change to any carrier list, proved by a test that plants such a module and runs the coverage carrier green. The carriers' existing assertions stay unchanged.
