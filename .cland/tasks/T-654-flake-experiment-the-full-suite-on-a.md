---
id: T-654
kind: task
title: "Flake experiment: the full suite on a quiet droplet at workers = 1, three runs"
state: open
status: in progress
size: S
rank: 4429
labels:
  - v0.1.4
  - flaky
  - verification
assignee: null
parent: E-482
blocked_by: []
topic: topic-396
branch: t/T-654-flake-experiment-the-full-suite-on-a
created: 2026-10-16T16:29:55.212Z
updated: 2026-10-16T17:24:41.119Z
---

## Summary

Part of the workers experiment from the flake analysis (A-4004, recommendation 1). The red rate is 0 % below a peak load of 6 and 62 % at 10–15, so the experiment measures whether fewer workers per droplet are nearly always green, which would mean load and not races.

## What to build

Nothing in the code. From a clean detached worktree at the experiment's one fixed dev commit (the Coordinator names it in the launch brief), run `cland verify all --executor droplet --workers 1 --fresh` three times in sequence, waiting for each result. Record each run's result, red tests, peak load, hub and Neovim phase wall and cost in one table artifact on this item.

## Acceptance criteria

- [ ] C1. Three droplet runs at workers = 1 at the named dev commit are recorded in a table artifact with result, red tests, peak load, phase walls and cost per run.

## Comments

### impl-654 · 2026-10-16T16:31:30.153Z

Created clean detached worktree .cland/worktrees/T-654-workers-1 at fixed commit 4555eafe0f84c91649c962dbf432bd9f911eb320. Beginning three sequential fresh droplet full-suite trials with workers=1; no source changes or local test runs.
