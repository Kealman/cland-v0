---
id: T-666
kind: task
title: cland verify runs the project's own check and test, and this repository names its own in the same merge
state: open
status: planned
size: M
criterion_seq: 7
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-663
  - T-665
topic: null
branch: null
created: 2026-10-16T16:35:24.419Z
updated: 2026-10-19T06:15:41.254Z
---

## Summary

The resolver from ticket T-663 reads `[verification] check`, `test` and `prepare` from the project's `config.toml` instead of returning npm lines, so a local `cland verify` runs the project's own commands (E-614 C1). This repository's `config.toml` gains `check = "npm run check"` (typecheck plus test:lint) and `test = "npm test"` in the same merge. Every one of cland's modes runs that one `test` line, with the mode carried by the selection as today (E-614 C4).

## What to build

- **Where the commands come from.** Each key comes from the candidate worktree's `.cland/config.toml` when that file sets it (as the suite limits are read today, in `hub/src/suite-limits.ts`). Otherwise the key comes from the hub root's config. So a branch cut before its project named the commands, this repository's open task branches included, verifies with `dev`'s values.
- **Recorded at submission.** The resolved `prepare`, `check` and `test` go into the job record and its `RunRef` and are printed in the log header (`Commands: check <line> · test <line>`). A hub restart, the host gate, the droplet's `run.sh` and every shard use the recorded lines and never re-read the file.
- **Without `test`.** `cland verify` refuses at submission, with no job queued and no worker started: `no [verification] test for this project; set it: cland config set verification.test '<command>'`. An unset `check` logs `check: not set` and the run goes straight to `test`. `prepare` is recorded for the droplet (ticket T-670), and a local run never runs it.
- **cland's modes on one line.** The resolver drops its per-mode npm lines: `hub`, `nvim`, `auto` and `all` all run `test`. cland's runner already takes its phases from `CLAND_SUITE_SELECTION` when it is set, and its argument only forces `all` (`runPackageSuite` in `hub/test/run-suite.ts`). The hub's selection, `hub-only`, `hub-selected`, `nvim-only`, `full` or a shard, still reaches it unchanged. Prove that the old per-mode scripts and `npm test` with the same selection plan the same phases, targets, workers and locks.
- **This repository's values.** `.cland/config.toml` gets `check = "npm run check"` (typecheck plus test:lint) and `test = "npm test"`, with the template's comment lines, in this ticket's merge. `prepare` stays empty until ticket T-670.

**Keeping cland's own suite intact.** A verify always runs the running hub's code, so this branch's own verify still runs today's lines. After the merge and the hub restart, the new code reads `dev`'s values, which name the same commands. Branches without the keys take those values too. The `hub` and `nvim` modes change from `npm test --workspace hub` and `npm run test:nvim` to `npm test` with the same selection, which C5 proves equivalent. The stage-close checklist adds one local `cland verify hub` and one `cland verify nvim` on a task branch after the hub restart.

## Acceptance criteria

- [ ] C1. In a fixture project whose package scripts differ from its `[verification]` lines, a local `cland verify` runs the config's `check` then `test`, and its log shows `$ <check>` then `$ <test>` (suite CLI test against a temporary project's hub).
- [ ] C2. A candidate whose `config.toml` sets no commands runs the root's values, and its log header names them (suite CLI test with a task worktree).
- [ ] C3. A project with no `test` in either file is refused at submission with the `cland config set verification.test` line, and no run is queued (suite CLI test).
- [ ] C4. With `check` unset the log shows `check: not set` and `test` runs. A failing `check` stops the run before `test`, red with its exit code.
- [ ] C5. For each selection (`full`, `hub-only`, `hub-selected`, `nvim-only` and a shard), `npm test` with the selection in `CLAND_SUITE_SELECTION` plans the same phases, targets, workers and lock directories as the old per-mode script (`suite-runner.test.ts`).
- [ ] C6. This repository's `.cland/config.toml` sets `check = "npm run check"` (typecheck plus test:lint, as the host gate runs today since T-684) and `test = "npm test"`, and the resolver resolves them for every mode (test reading the repository's own file).
- [ ] C7. The recorded commands survive a hub restart mid-run: the restored run reports with the same lines (`suite-recovery.test.ts`), and a fake-droplet run's `run.sh` carries the recorded lines (`executor-run.test.ts`).
