---
id: T-655
kind: task
title: "Flake experiment: the full suite on a quiet droplet at workers = 2, three runs"
state: closed
status: done
size: S
rank: 4438
criterion_seq: 1
labels:
  - v0.1.4
  - flaky
  - verification
assignee: null
parent: E-482
blocked_by: []
topic: topic-397
branch: t/T-655-flake-experiment-the-full-suite-on-a
created: 2026-10-16T16:29:55.579Z
updated: 2026-10-16T19:42:43.320Z
closed: 2026-10-16T19:42:43.320Z
---

## Summary

Part of the workers experiment from the flake analysis (A-4004, recommendation 1). The red rate is 0 % below a peak load of 6 and 62 % at 10–15, so the experiment measures whether fewer workers per droplet are nearly always green, which would mean load and not races.

## What to build

Nothing in the code. From a clean detached worktree at the experiment's one fixed dev commit (the Coordinator names it in the launch brief), run `cland verify all --executor droplet --workers 2 --fresh` three times in sequence, waiting for each result. Record each run's result, red tests, peak load, hub and Neovim phase wall and cost in one table artifact on this item.

## Acceptance criteria

- [x] C1. Three droplet runs at workers = 2 at the named dev commit are recorded in a table artifact with result, red tests, peak load, phase walls and cost per run.
  - done: impl-655 · 2026-10-16T19:42:32.375Z

## Comments

### impl-655 · 2026-10-16T16:31:49.230Z

Experiment prepared in clean detached .cland/worktrees/T-655-workers2 at 4555eafe0f84c91649c962dbf432bd9f911eb320. Running three fresh full droplet suites sequentially with workers=2; measurements and failures will be consolidated in one artifact.

### impl-655 · 2026-10-16T18:05:58.199Z

Run 1/3 green: 36ccfb54, log A-4098, fixed head 4555eafe, workers=2 on c-8 Linux. 2347 tests / 0 fail / 8 skipped; peak 1m load 9.27; hub free 1.75s, hub machine 2261.70s, Neovim 207.68s; suite 2471.16s; lifetime 2538s; cost $0.1763. Submitting run 2 only after this completed receipt.

### impl-655 · 2026-10-16T18:48:03.700Z

Run 2/3 green: a46448d4, log A-4119, fixed head 4555eafe, workers=2 on c-8 Linux. 2347 tests / 0 fail / 8 skipped; peak 1m load 8.90; hub free 1.63s, hub machine 2127.87s, Neovim 188.58s; suite 2318.10s; lifetime 2393s; cost $0.1662. Submitting run 3 after this completed receipt.

### impl-655 · 2026-10-16T19:42:32.759Z

Experiment complete: 3/3 fresh full droplet runs passed at 4555eafe0f84c91649c962dbf432bd9f911eb320 with workers=2, zero red tests each. Consolidated table A-4156: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4156-t-655-workers-2-three-run-results-table.md. Logs A-4098, A-4119, A-4155. Peak loads 9.27 / 8.90 / 7.91; total cost $0.5171; mean suite wall 2411.96s. C1 marked done. No code change, review or merge, per launch brief.

### coord · 2026-10-16T19:42:43.320Z

Closed by the Coordinator. Experiment ticket, no code change. A-4156 records three green full droplet runs at workers = 2: peak load 7.9–9.3, suite wall 2318–2471 s, $0.17 each. D53 sets droplet workers = 2. The comparison with workers = 4 is T-656 C2.
