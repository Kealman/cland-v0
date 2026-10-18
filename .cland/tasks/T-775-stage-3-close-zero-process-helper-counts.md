---
id: T-775
kind: task
title: "Stage-3 close: zero process-helper counts outside contract, scenario and T3-header files, and measure T3 seconds and hub starts"
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - tests
  - ready-for-agent
assignee: null
parent: E-677
blocked_by:
  - T-684
  - T-708
  - T-772
  - T-773
  - T-774
topic: null
branch: null
created: 2026-10-18T04:49:35.780Z
updated: 2026-10-18T04:49:35.780Z
---

## Summary

These are T-708's former C2–C4, run once the stage-3 migrations land: T-708, T-772, T-773 and T-774, on top of T-684's lint baseline and gate. Make the process-helper rule absolute, then measure the result. The C3 target is set from A-4961's projection: the conservative same-title moves reach about 2109 s, not the original 1800 s. The rest is a follow-up item.

## What to build

Zero the process-helper counts outside contract, scenario and T3-header lifecycle files in T-684's baseline, with the shrink tool. Then measure on a full run.

## Acceptance criteria

- [ ] C1. The process-helper counts in the lint baseline are zero outside contract, scenario and T3-header files, and a planted `spawnSpoke` in a T2 file is refused, proved by the lint run and a lint test.
- [ ] C2. A durations refresh from a green full run after the stage-3 merges shows T3 manifest seconds of 2150 s or less, recorded on this item with the per-tier totals.
- [ ] C3. A spawn census of that full run shows the hub process-start count, with a per-file table recorded on this item, against T-708's 150-start goal; any gap is carried into the follow-up.
