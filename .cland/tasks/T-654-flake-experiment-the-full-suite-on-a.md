---
id: T-654
kind: task
title: "Flake experiment: the full suite on a quiet droplet at workers = 1, three runs"
state: closed
status: done
size: S
rank: 4429
criterion_seq: 1
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
updated: 2026-10-16T18:15:42.926Z
closed: 2026-10-16T18:15:42.926Z
---

## Summary

Part of the workers experiment from the flake analysis (A-4004, recommendation 1). The red rate is 0 % below a peak load of 6 and 62 % at 10–15, so the experiment measures whether fewer workers per droplet are nearly always green, which would mean load and not races.

## What to build

Nothing in the code. From a clean detached worktree at the experiment's one fixed dev commit (the Coordinator names it in the launch brief), run `cland verify all --executor droplet --workers 1 --fresh` three times in sequence, waiting for each result. Record each run's result, red tests, peak load, hub and Neovim phase wall and cost in one table artifact on this item.

## Acceptance criteria

- [x] C1. Three droplet runs at workers = 1 at the named dev commit are recorded in a table artifact with result, red tests, peak load, phase walls and cost per run.
  - done: impl-654 · 2026-10-16T18:15:31.813Z

## Comments

### impl-654 · 2026-10-16T16:31:30.153Z

Created clean detached worktree .cland/worktrees/T-654-workers-1 at fixed commit 4555eafe0f84c91649c962dbf432bd9f911eb320. Beginning three sequential fresh droplet full-suite trials with workers=1; no source changes or local test runs.

### coord · 2026-10-16T18:14:54.158Z

Coordinator, 18:15Z (D51), decision on C1: T-654 stops after trial 1. Run 022da50c (A-4104) at 4555eafe hit the 50-minute run timeout with exit 124. The hub machine phase alone took 2995 s at workers = 1, and the Neovim phase never started. All 38 tests that finished passed, and peak load was 4.56. Trials 2 and 3 would time out the same way and spend about $0.43 without telling us anything about the red rate. That result is itself the finding: workers = 1 can't fit a full run within the 50-minute run timeout on a c-8, so it isn't a candidate default. C1 is met by the table artifact with this one run, its timeout and this decision. T-656's comparison lists workers = 1 as infeasible within the timeout, with its partial hub-phase wall and cost.

### coord · 2026-10-16T18:15:42.926Z

Closed by the Coordinator (D51). This was an experiment ticket with no code change. A-4106 records its single workers = 1 trial: a 50-minute timeout, so workers = 1 can't be used. The comparison is T-656's C2.
