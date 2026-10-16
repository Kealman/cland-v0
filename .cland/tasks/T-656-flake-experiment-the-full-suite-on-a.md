---
id: T-656
kind: task
title: "Flake experiment: the full suite on a quiet droplet at workers = 4, three runs, and the comparison"
state: open
status: in progress
size: S
rank: 4438
criterion_seq: 2
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
updated: 2026-10-16T20:00:17.880Z
---

## Summary

Part of the workers experiment from the flake analysis (A-4004, recommendation 1). The red rate is 0 % below a peak load of 6 and 62 % at 10–15, so the experiment measures whether fewer workers per droplet are nearly always green, which would mean load and not races.

## What to build

Nothing in the code. From a clean detached worktree at the experiment's one fixed dev commit (the Coordinator names it in the launch brief), run `cland verify all --executor droplet --workers 4 --fresh` three times in sequence, waiting for each result. Record each run's result, red tests, peak load, hub and Neovim phase wall and cost in one table artifact on this item.

## Acceptance criteria

- [x] C1. Three droplet runs at workers = 4 at the named dev commit are recorded in a table artifact with result, red tests, peak load, phase walls and cost per run.
  - done: impl-656 · 2026-10-16T20:00:17.234Z
- [x] C2. One comparison artifact covers workers 1, 2 and 4 (from all three experiment tickets) with red rate, wall and cost per green run, and recommends the droplet worker default and machine size for the Coordinator to set.
  - done: impl-656 · 2026-10-16T20:00:17.518Z

## Comments

### impl-656 · 2026-10-16T16:32:03.162Z

Prepared clean detached .cland/worktrees/T-656-workers4-4555eafe at 4555eafe0f84c91649c962dbf432bd9f911eb320. Trial 1 submission using launch command and --report topic-398 refused by send:human permission, without a run ID. Escalated to lead T-656 and stopped retries per rule 5. No local tests or source changes.

### impl-656 · 2026-10-16T16:34:10.501Z

Coordinator corrected routing with --to impl-656 --to coord. Trial 1 queued as 4177fc1e-a435-410c-9b77-aac474ed2d4b at fixed 4555eafe, full/fresh/droplet/workers=4. CLI response timed out; verify queue confirmed the durable request, so no retry.

### impl-656 · 2026-10-16T17:47:19.019Z

Per Coordinator instruction at 17:46Z, cancelled the unstarted trial-1 request 4177fc1e once and immediately resubmitted identical candidate/options to pick up the item's new priority. New trial-1 run 6173880a-683e-4ae2-8f42-18954b69e232, acknowledged position 3. A-4086 is only the original request's cancellation receipt and excluded from the three executed trials.

### impl-656 · 2026-10-16T18:39:59.948Z

Trial 1 green: 6173880a / A-4115, suite 1941.37s, peak 1m load 16.25, hub free 2.43s + machine 1767.51s, Neovim 171.40s, lifetime 2022s, $0.1404, 0 failed tests. Trial 2 fd8170dd-f21c-4363-9dbb-c8e41d393ec4 admitted at identical fixed head/options, queue position 1. Trial 3 held until its result.

### impl-656 · 2026-10-16T19:14:27.497Z

Trial 2 fd8170dd / A-4140 red: `needs-you chip and both inbox views agree: events raised to Now` failed, 1/2347 tests; peak load 14.96; hub free 2.47s + machine 1737.41s; Neovim 163.23s; suite 1903.14s. Lifetime and cost unavailable in receipt; reported accounting limitation to lead. Trial 3 5157a7a1-8ab4-4174-a95f-d345e0730118 queued at same fixed commit/options (position 2).

### impl-656 · 2026-10-16T20:00:17.880Z

Complete: C1 table A-4163 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4163-t-656-workers-4-three-run-results-table.md) records workers=4 2/3 green, red rate 33.3%, mean attempt wall 1757.00s. C2 comparison A-4165 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4165-t-656-c2-workers-comparison-and-recommended-droplet-default.md) recommends droplet workers=2 on c-8 lon1: 0/3 red, 2411.96s and $0.1724 per green versus workers=4 2635.51s and estimated $0.1909 per green. Workers=1 infeasible within original 50m timeout per Coordinator D51. Trial-2 cost estimated per Coordinator instruction, cells labelled. No source changes, local tests, review or merge.
