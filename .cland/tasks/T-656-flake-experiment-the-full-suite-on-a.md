---
id: T-656
kind: task
title: "Flake experiment: the full suite on a quiet droplet at workers = 4, three runs, and the comparison"
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
topic: topic-398
branch: t/T-656-flake-experiment-the-full-suite-on-a
created: 2026-10-16T16:29:55.961Z
updated: 2026-10-16T17:24:42.986Z
---

## Summary

Part of the workers experiment from the flake analysis (A-4004, recommendation 1). The red rate is 0 % below a peak load of 6 and 62 % at 10–15, so the experiment measures whether fewer workers per droplet are nearly always green, which would mean load and not races.

## What to build

Nothing in the code. From a clean detached worktree at the experiment's one fixed dev commit (the Coordinator names it in the launch brief), run `cland verify all --executor droplet --workers 4 --fresh` three times in sequence, waiting for each result. Record each run's result, red tests, peak load, hub and Neovim phase wall and cost in one table artifact on this item.

## Acceptance criteria

- [ ] C1. Three droplet runs at workers = 4 at the named dev commit are recorded in a table artifact with result, red tests, peak load, phase walls and cost per run.
- [ ] C2. One comparison artifact covers workers 1, 2 and 4 (from all three experiment tickets) with red rate, wall and cost per green run, and recommends the droplet worker default and machine size for the Coordinator to set.

## Comments

### impl-656 · 2026-10-16T16:32:03.162Z

Prepared clean detached .cland/worktrees/T-656-workers4-4555eafe at 4555eafe0f84c91649c962dbf432bd9f911eb320. Trial 1 submission using launch command and --report topic-398 refused by send:human permission, without a run ID. Escalated to lead T-656 and stopped retries per rule 5. No local tests or source changes.

### impl-656 · 2026-10-16T16:34:10.501Z

Coordinator corrected routing with --to impl-656 --to coord. Trial 1 queued as 4177fc1e-a435-410c-9b77-aac474ed2d4b at fixed 4555eafe, full/fresh/droplet/workers=4. CLI response timed out; verify queue confirmed the durable request, so no retry.
