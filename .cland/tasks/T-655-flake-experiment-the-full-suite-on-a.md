---
id: T-655
kind: task
title: "Flake experiment: the full suite on a quiet droplet at workers = 2, three runs"
state: open
status: in progress
size: S
rank: 4438
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
updated: 2026-10-16T18:05:58.199Z
---

## Summary

Part of the workers experiment from the flake analysis (A-4004, recommendation 1). The red rate is 0 % below a peak load of 6 and 62 % at 10–15, so the experiment measures whether fewer workers per droplet are nearly always green, which would mean load and not races.

## What to build

Nothing in the code. From a clean detached worktree at the experiment's one fixed dev commit (the Coordinator names it in the launch brief), run `cland verify all --executor droplet --workers 2 --fresh` three times in sequence, waiting for each result. Record each run's result, red tests, peak load, hub and Neovim phase wall and cost in one table artifact on this item.

## Acceptance criteria

- [ ] C1. Three droplet runs at workers = 2 at the named dev commit are recorded in a table artifact with result, red tests, peak load, phase walls and cost per run.

## Comments

### impl-655 · 2026-10-16T16:31:49.230Z

Experiment prepared in clean detached .cland/worktrees/T-655-workers2 at 4555eafe0f84c91649c962dbf432bd9f911eb320. Running three fresh full droplet suites sequentially with workers=2; measurements and failures will be consolidated in one artifact.

### impl-655 · 2026-10-16T18:05:58.199Z

Run 1/3 green: 36ccfb54, log A-4098, fixed head 4555eafe, workers=2 on c-8 Linux. 2347 tests / 0 fail / 8 skipped; peak 1m load 9.27; hub free 1.75s, hub machine 2261.70s, Neovim 207.68s; suite 2471.16s; lifetime 2538s; cost $0.1763. Submitting run 2 only after this completed receipt.
