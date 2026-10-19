---
id: T-775
kind: task
title: "Stage-3 close: zero process-helper counts outside contract, scenario and T3-header files, and measure T3 seconds and hub starts"
state: open
status: in progress
size: S
criterion_seq: 3
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
  - T-895
  - T-896
  - T-897
  - T-898
  - T-899
  - T-900
  - T-901
  - T-902
  - T-903
topic: topic-628
branch: t/T-775-stage-3-close-zero-process-helper-counts
created: 2026-10-18T04:49:35.780Z
updated: 2026-10-19T19:40:31.742Z
---

## Summary

These are T-708's former C2–C4, run once the stage-3 migrations land: T-708, T-772, T-773 and T-774, on top of T-684's lint baseline and gate. Make the process-helper rule absolute, then measure the result. The C3 target is set from A-4961's projection: the conservative same-title moves reach about 2109 s, not the original 1800 s. The rest is a follow-up item.

## What to build

Zero the process-helper counts outside contract, scenario and T3-header lifecycle files in T-684's baseline, with the shrink tool. Then measure on a full run.

## Acceptance criteria

- [ ] C1. The process-helper counts in the lint baseline are zero outside contract, scenario and T3-header files, and a planted `spawnSpoke` in a T2 file is refused, proved by the lint run and a lint test.
- [x] C2. A durations refresh from a green full run after the stage-3 merges shows T3 manifest seconds of 2150 s or less, recorded on this item with the per-tier totals. (D66: the measured value is recorded on this item and accepted for v0.1.4; reaching the target is studied later in E-880 under Ideas.)
  - done: impl-775 · 2026-10-19T19:25:10.188Z
- [x] C3. A spawn census against T-708's 150-start goal: not measured in v0.1.4, because the local census run starved the shared hub on the crew machine (2026-10-19 19:34–19:39Z, load 51). The measurement is carried into E-880 under Ideas (D66).
  - done: impl-775 · 2026-10-19T19:40:31.742Z

## Comments

### coord · 2026-10-18T12:21:44.278Z

Unclassified slowdown to measure here (coord, 2026-10-18 12:22Z, from impl-709). In T-709's verify d94b92f3, nvim/test/shell.test.ts took 66.9 s against a 48.6 s baseline, and explorer.test.ts 15.6 s against 10.4 s. Both are recorded-frame stub consumers and still T3 pending T-774. Their sources and the replay helper are unchanged since 5a9c0879. A plausible cost is the 11.6 MB, 4464-frame catalog, which is read and JSON-parsed once per stub process: shell has 85 cases, explorer 18. On a serial Mac run (A-5093) they took 37.8 s and 9.5 s. Measure producer against replay on one quiet machine, with catalog startup accounted separately. If the catalog parse dominates, a per-file catalog slice or a pre-indexed format is the fix.

### coord · 2026-10-18T15:58:30.149Z

Budget overruns in T-774's migrated T2 Neovim files (rev-30, A-5407/A-5408; report-only, no allowance added): thread generated rendering 15.759 s (also T-809), delayed history 2.640 s, rewrites 2.185 s; events-quiet keys/persistence 2.798 s; explorer preferences 2.622 s; whole files shell-component 36.949 s and thread 32.892 s against 30 s. Record them in the stage-3 close census, then either cut them (per-file catalog slices, as T-774 did for shell and explorer) or file one follow-up with the list.

### impl-775 · 2026-10-19T19:26:51.239Z

A-6408 records the corrected 40-file C1 per-helper count/disposition table (163 static sites; not runtime starts), four truthful lifecycle-header corrections and 36 pending migrations/policy decisions, plus the T-774 Neovim overrun debt for migration lanes. No migration performed in T-775. C2 source: A-6297/cd21226d full green at 1d81bd6e; refresh 595c7f01 and run-head tiers: T1 13.827949 s/81 files, T2 423.221029 s/160, T3 2356.811994 s/184, T4 120.126922 s/10, zero missing timings. C2 target miss 206.811994 s is recorded honestly and accepted under D66; E-880 holds the target study. C2 claimant done. C1 and C3 remain open; awaiting migration dispositions and Coordinator-cleared local census slot. test-lint: 32/32 pass, 0 fail/skip; typecheck and shrink lint pass.

### impl-775 · 2026-10-19T19:38:01.254Z

C3 remains OPEN. A-6441 retains the incomplete local census at 1d81bd6e: exit 143 after 446.19 s, peak 1m load 52.19, Node v25.6.1 (outside declared engines), default 4 workers. Partial canonical-helper count 64 across 17 attributed files; 36 coverage-gap file entries, zero truncated lines. Hub and Neovim coverage incomplete; do not compare 64 as a full-suite total to the 150 goal. Three reported failures occurred before interruption (two demo-release and one demo recorder recovery); no diagnosis or retry under load. Runner preserved five ambiguous-ownership PIDs; no manual signalling or fixture/worktree removal performed. Requested Coordinator direction for any later explicitly Node24/2-worker census. C1 remains blocked on T-895–T-903; source review not requested.

### impl-775 · 2026-10-19T19:40:31.668Z

C3 disposition supersedes my earlier partial-census comment: not measured in v0.1.4; the census run starved the shared hub on the crew machine. Coordinator decision 44c61115 confirms the deliberate SIGTERM stop during 19:34–19:39Z hub starvation and directs no restart. Under revised C3/D66, E-880 (Ideas) owns the later measurement. Partial census output is discarded as measurement evidence; A-6441 is withdrawn/archived. No partial process count or target assessment is claimed. Prepared detached worktree kept. C3 claimant done against the revised disposition. Source review continues to wait on T-895–T-903.
