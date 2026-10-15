---
id: T-394
kind: task
title: "Coverage selection: task runs select hub tests by a function-level V8 coverage map from integrated dev runs, with full fallback on shared or unknown paths"
state: open
status: planned
size: L
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-387
blocked_by:
  - T-388
  - T-390
  - T-393
topic: null
branch: null
created: 2026-10-14T12:28:19.272Z
updated: 2026-10-15T15:32:05.304Z
---

## Summary

Even with wider package rules, a hub change runs the whole hub phase, because the CLI, the daemon and the harness each reach most of `hub/src`. An import graph therefore selects everything. Each integrated `dev` full run already happens under D29. This ticket makes those runs record function-level V8 coverage and publish a map from function ranges to test files. A task run then selects its changed tests, the tests covering the functions its diff touches, and the smoke baselines. The research estimates that a task's hub phase drops from about 13 minutes to 2–5.

## Parent

"Test speed: structural" (R-294), tracer bullet 2; research #7 (`docs/research/test-speed.md` §3.3(c), §3.3(b); §4 "Per-task verify under 5 min"). Waits for the in-process hub (01), which puts most hub code in the test file's own process and makes attribution per file straightforward.

**Open question for the human (research question 2), to be answered on this item before work starts:** is it acceptable for a task's selected run to pass and the next integrated batch run to catch the regression? And what replay bar must this ticket meet? **Proposal:** yes, since D29 already makes the batch run the backstop. The bar: no misses on the last 40 merges' own test changes, and every miss in a wider replay is listed with its cause.

## What to build

**Recording, on integrated `dev` full runs only.**

- The runner sets `NODE_V8_COVERAGE` to a per-test-file directory for each test file's process and for everything it spawns: daemons, the CLI, fakes, and spokes, whose environment `spawnSpoke` builds itself, so the variable is added there.
- With the in-process hub, most hub code runs in the file's own process. Lifecycle tests' daemons write under the same file's directory.
- At the end, a reducer turns the raw coverage into `{ file: { functionRange: [testFiles…] } }` for `hub/src/**`, at function granularity. File granularity selects everything, because top-level code runs on import.
- The map is posted as an artifact of the run and recorded with the run's head and tree.

**Selection, in `hub/src/suite-selection.ts`.** For a task diff that the package rules call `hub-only`, or `full` only because it touches hub files, `selectPackageSuite` reads the newest map whose head is an ancestor of the task's merge base. The selection is:

- the changed test files;
- the test files whose covered functions intersect the diff's hunks, mapped across the diff since the map's head;
- `HUB_SMOKE` and `NVIM_SMOKE`.

It falls back to today's rules, naming the reason, for protocol, contract, package, harness, fixture and runner changes, for a `hub/src` file absent from the map, for a map older than `[verification] coverage_max_age` (default 2 days), and for a missing map. The selection mode is `hub-selected`, with its deciding functions in the report. The Neovim side keeps the package rules.

**The replay.** `hub/test/selection-replay.ts` (from quick-01) gains a coverage mode. Over the last 40 merges, it computes each merge's selection against the map of its time, or the nearest one, and checks whether the merge's own changed or added test files, and the tests that failed in its history, are inside the selection. It prints the selected share of hub test-time per merge.

## Acceptance criteria

- [ ] C1. The human's answer to the miss-tolerance and replay-bar question is recorded on this item before the first commit.
- [ ] C2. An integrated `dev` full run posts a function-level coverage map artifact naming its head and tree, and spokes, daemons, the CLI and fakes all contribute to it, proven on a fixture project.
- [ ] C3. A task diff touching one function in `hub/src/hub/` selects its changed tests, the covering test files and the smoke baselines, and the report names the deciding functions.
- [ ] C4. Protocol, contract, package, harness, fixture and runner changes, unknown files, stale maps and a missing map fall back to the package rules with their reason, each proven by a test.
- [ ] C5. The replay over the last 40 merges meets the bar recorded in C1 and reports the selected share of hub test-time per merge; the table is posted on the item.
- [ ] C6. Measured: `cland verify` on a branch changing one function in `hub/src/hub/` finishes in under 5 minutes on the default executor (about 15 today), with the duration line posted.
- [ ] C7. Recording coverage adds at most 15% to an integrated run's wall time, measured against the run before at a nearby head.
- [ ] C8. `hub/README.md` (Tests), `docs/agents/tests.md` and the Implementer clause describe `hub-selected`, the map, its age limit and the fallbacks.
