---
id: T-679
kind: task
title: "hub/test/tiers.json replaces shards.json: every hub and Neovim test file declares T1, T2, T3 or T4, sorted by path"
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-408
branch: t/T-679-hub-test-tiers-json-replaces-shards-json
created: 2026-10-16T19:59:27.652Z
updated: 2026-10-16T20:02:11.584Z
---

## Summary

`hub/test/shards.json` classifies the 208 hub test files by resource (201 `machine`, 7 `free`) and leaves the 37 Neovim files out. The memo makes the tier, not the resource, the unit the hub enforces (memo §5.1, §5.2.1; report-strategy §4.2.1). This ticket lands the manifest in week 0 with no change to what any run executes: the seven free files become T1, every other file T3. It folds in T-662's declared-tier lint and T-672's sorted map.

## What to build

- **The manifest.** `hub/test/tiers.json`, `version: 1`, a `tests` map keyed by path and sorted by path. A value is a tier string (`"T1"`, `"T2"`, `"T3"`, `"T4"`) or an object `{ "tier": "T3", "contract": "<harness>" }` / `{ "tier": "T3", "scenario": "<name>" }` (E-677 fills the object forms; the lint accepts them now). It covers `hub/src/**/*.test.ts`, `hub/test/**/*.test.ts` and `nvim/test/**/*.test.ts`. The initial content is mechanical: today's `free` files are T1, every other file is T3. `shards.json` is deleted in the same change.
- **Same runs as today.** T1 maps to today's hermetic phase (one worker), T2, T3 and T4 to today's machine phase, and the Neovim phase stays as it is. T4 files run wherever T3 files run until E-678 gives T4 its own occasions. Close-run sharding (`balanceCloseShards`) treats every tier the same way it treats files today.
- **The lint** (`npm run test:tiers`, with `test:shards` kept as an alias for one release) refuses an unclassified file, an entry naming a missing file, an invalid tier or object, and a map not sorted by path, naming the first out-of-order path. A T1 file must still pass today's hermetic check (the `MACHINE` pattern in `hub/src/suite-shards.ts`). Admission refuses with `verify-tiers`; the merge gate refuses with `merge-tiers` before it changes refs. The old codes stay accepted on the wire as aliases.
- **Transition.** A candidate tree that carries `shards.json` and no `tiers.json` (a branch cut before this change) is admitted and run with `free` read as T1 and `machine` as T3, so in-flight branches keep verifying until they merge `dev`.
- **Writers keep it sorted.** Every tool or fixture that writes the manifest writes it sorted; fixtures that write `shards.json` move to `tiers.json`.

## Acceptance criteria

- [ ] C1. `hub/test/tiers.json` lists every hub and Neovim test file sorted by path, the seven current free files as T1 and all others as T3, and `shards.json` no longer exists, proved by the lint run over the repository.
- [ ] C2. The lint refuses an unclassified file, a missing file, an invalid tier, an unsorted map (naming the first out-of-order path) and a T1 file that uses a process, port, timer or harness API, proved by lint tests.
- [ ] C3. `cland verify` refuses those faults with `verify-tiers` and `cland merge` with `merge-tiers`, before queueing or changing refs, proved by admission and merge-gate tests.
- [ ] C4. A candidate tree with only `shards.json` is admitted and planned with free as T1 and machine as T3, proved by an admission test.
- [ ] C5. The planned phases, file sets and worker counts for a full run of this repository equal those planned from `shards.json` at the merge base, proved by a planning test.
- [ ] C6. Every tool that writes the manifest writes it sorted, proved by a test that adds an entry, and `docs/agents/tests.md` and `hub/README.md` (Tests) describe `tiers.json`, the four tiers and where a new line goes.
