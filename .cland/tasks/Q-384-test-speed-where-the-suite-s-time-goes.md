---
id: Q-384
kind: question
title: "Test speed: where the suite's time goes and how to cut verification wait several times over"
state: closed
labels:
  - research
assignee: null
parent: R-294
blocked_by: []
topic: null
branch: null
created: 2026-10-14T11:55:39.093Z
updated: 2026-10-16T10:53:48.773Z
closed: 2026-10-16T10:53:48.773Z
---

## Summary

Waiting for tests is now most of the development time. This research profiles the suite and proposes an epic that cuts suite time and verification wait several times over, without losing what the frame-protocol-first tests prove (D29, 2026-10-14).

## Question

Where does the suite's time go, which tests could be cheaper without losing coverage, and which changes to selection, fixtures, parallelism and remote sharding would cut both the full-suite time and the per-task verification time, in what order and at what cost?

## Known so far (Coordinator, from A-2299, the integrated run at f44f0e9)

- 1917 tests, 3248 s of test time, about 15 min on 4 workers. Hub machine shard about 800–900 s, Neovim about 70 s.
- 559 tests over 2 s take 75% of the time; 131 tests over 5 s take 33%; 1027 tests under 1 s take 10%.
- The slowest single tests take 20–33 s: real hub, spokes, fake harnesses, sometimes several hubs or a scratch project.
- Diff selection exists (hub-only, nvim-only, full; `hub/src/suite-selection.ts`), but any hub change runs the whole hub shard.
- Load above about 15 has turned readiness gaps into failures (T-369, T-371, T-375, T-376, T-382, T-383).

## Deliverables

- `docs/research/test-speed.md` on branch `research/test-speed`, covering:
  - a per-file and per-category profile (spawns a hub, spawns harness fakes, pure unit, Neovim headless), taken from existing suite logs, with no new full runs;
  - the duplication between frame-protocol tests and unit tests;
  - options with estimates: shared hub fixtures per file, dependency-based selection from the import graph, worker count against the machine's cores, sharding the hub phase across droplets (E-271), a slow-test budget, and pyramid changes that keep each criterion's proof;
  - a recommended epic, sliced into tickets.
- A Coordinator ask to the human with the epic's scope and the release it lands in.

## Comments

### coord · 2026-10-14T12:12:37.913Z

Research done: docs/research/test-speed.md on research/test-speed (55d4c5a8), artifact A-2346. Per-task wait averages about 39 min (24 min queue + 15 min run). 81% of test time goes to real-hub tests, driven by about 63k process spawns per run (R²=0.94). Diff selection gave full in 37 of the last 40 task merges, and the import graph reaches 139/144 modules. Recommended epic: 9 tickets, quick wins first. Decisions are asked of the human in General.

### coord · 2026-10-14T12:20:17.949Z

Human decisions (2026-10-14):
- Scope (12:15Z): quick wins #1–#5 go now as an epic in v0.1.2; #6–#9 as an epic in v0.1.3.
- Design (12:20Z): (a) an in-process hub by default, with a real hub process only for lifecycle tests; the shared hub per file is rejected. (b) Droplet sharding of full runs only for stage, epic and release runs, within $3/day.

### coord · 2026-10-16T10:53:48.773Z

Answered: the research is docs/research/test-speed.md (A-2346), and the human decided the programme on 2026-10-14. E-386 delivered the quick wins in v0.1.2 and E-387 the structural infrastructure in v0.1.3. The remaining targets (the -15% test time, verify under 5 min with the replay, worker defaults, daemon starts under 600, sharded wall time) moved to v0.1.4 under E-578 (ask 6a7185b6 / 3ab87e56; ask 396ec11a / 4c507896). Closed before v0.1.3's dry run, as E-426 C1 requires.
