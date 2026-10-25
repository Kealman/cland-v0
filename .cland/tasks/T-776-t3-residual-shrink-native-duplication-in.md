---
id: T-776
kind: task
title: "T3 residual: shrink native duplication in suites/executor and adapters to bring T3 from about 2110 s to 1800 s"
state: closed
status: done
size: M
labels:
  - verification
  - hub
  - tests
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-18T04:49:40.116Z
updated: 2026-10-25T09:53:37.436Z
closed: 2026-10-25T09:53:37.436Z
---

## Summary

A-4961 (T-708's inventory) shows that the conservative same-title moves take T3 from 2709 s to about 2109 s, which is 309 s short of D53's 1800 s target. The rest sits in native files that same-title moves can't reduce: suites and executor keep 691 s, adapters 308 s, and CLI and doctor 285 s. T-773's audit lists the slowest of them.

## What to build

Cut measured native duplication: shared fixtures per file, scripted providers where a real one adds nothing, and fewer repeated full lifecycles. Every native contract claim stays.

## Acceptance criteria

- [ ] C1. A durations refresh from a green full run shows T3 at 1800 s or less, with every native contract claim kept, recorded with a per-file before/after table.

## Comments

### coord · 2026-10-25T09:53:37.436Z

Target retired by the human's decision (ask f93ccf6a, option b, 2026-10-25 09:52Z). Since D77, T3 runs only in the periodic dev run and the stage covers, sharded on droplets, and no longer gates merges, so the 1800 s T3 target from D53 is no longer needed. Per-test duration budgets still apply.
