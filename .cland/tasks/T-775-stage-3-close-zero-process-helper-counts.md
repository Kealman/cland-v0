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
updated: 2026-10-18T15:58:30.149Z
---

## Summary

These are T-708's former C2–C4, run once the stage-3 migrations land: T-708, T-772, T-773 and T-774, on top of T-684's lint baseline and gate. Make the process-helper rule absolute, then measure the result. The C3 target is set from A-4961's projection: the conservative same-title moves reach about 2109 s, not the original 1800 s. The rest is a follow-up item.

## What to build

Zero the process-helper counts outside contract, scenario and T3-header lifecycle files in T-684's baseline, with the shrink tool. Then measure on a full run.

## Acceptance criteria

- [ ] C1. The process-helper counts in the lint baseline are zero outside contract, scenario and T3-header files, and a planted `spawnSpoke` in a T2 file is refused, proved by the lint run and a lint test.
- [ ] C2. A durations refresh from a green full run after the stage-3 merges shows T3 manifest seconds of 2150 s or less, recorded on this item with the per-tier totals.
- [ ] C3. A spawn census of that full run shows the hub process-start count, with a per-file table recorded on this item, against T-708's 150-start goal; any gap is carried into the follow-up.

## Comments

### coord · 2026-10-18T12:21:44.278Z

Unclassified slowdown to measure here (coord, 2026-10-18 12:22Z, from impl-709). In T-709's verify d94b92f3, nvim/test/shell.test.ts took 66.9 s against a 48.6 s baseline, and explorer.test.ts 15.6 s against 10.4 s. Both are recorded-frame stub consumers and still T3 pending T-774. Their sources and the replay helper are unchanged since 5a9c0879. A plausible cost is the 11.6 MB, 4464-frame catalog, which is read and JSON-parsed once per stub process: shell has 85 cases, explorer 18. On a serial Mac run (A-5093) they took 37.8 s and 9.5 s. Measure producer against replay on one quiet machine, with catalog startup accounted separately. If the catalog parse dominates, a per-file catalog slice or a pre-indexed format is the fix.

### coord · 2026-10-18T15:58:30.149Z

Budget overruns in T-774's migrated T2 Neovim files (rev-30, A-5407/A-5408; report-only, no allowance added): thread generated rendering 15.759 s (also T-809), delayed history 2.640 s, rewrites 2.185 s; events-quiet keys/persistence 2.798 s; explorer preferences 2.622 s; whole files shell-component 36.949 s and thread 32.892 s against 30 s. Record them in the stage-3 close census, then either cut them (per-file catalog slices, as T-774 did for shell and explorer) or file one follow-up with the list.
