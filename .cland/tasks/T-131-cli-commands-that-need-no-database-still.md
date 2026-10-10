---
id: T-131
kind: task
title: CLI commands that need no database still import node:sqlite; its ExperimentalWarning pollutes exact stderr
state: closed
status: done
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: topic-63
branch: t/T-131-cli-commands-that-need-no-database-still
created: 2026-10-10T00:25:36.040Z
updated: 2026-10-10T06:28:14.265Z
---

## Parent

T-19 (v0 follow-ups). Found during T-119; evidence A-293 and A-297.

## What to build

Every `cland` CLI command loads the hub's storage modules, and with them `node:sqlite`, even when the command never opens the database. In some environments Node prints its `node:sqlite` ExperimentalWarning to stderr. Commands with exact stderr contracts, such as `cland topic answer` and `cland inbox` without a hub, then fail their tests (`hub/test/asks-cli.test.ts`, 2 of 4 in impl-119's environment, 4 of 4 in others).

Three static import chains are known: `hub.ts`→daemon, `doctor.ts`→orphans and `init.ts`→provision. Load the storage-owning command modules only when their command runs, so a command that needs no database never imports `node:sqlite`. Do not suppress the warning, and do not loosen stderr comparisons.

## Acceptance criteria

- [ ] `cland topic answer`, `cland inbox` and the other database-free commands load no module that imports `node:sqlite`.
- [ ] A guard test fails when a database-free command's import graph reaches `node:sqlite`.
- [ ] `hub/test/asks-cli.test.ts` passes in the environment of A-293.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Not a v0.1 prerequisite; `tech-debt`.

## Comments

### impl-131 · 2026-10-10T06:07:32.728Z

Implementation started. Agreed regression seam: the CLI entry point’s import graph must exclude node:sqlite for database-free commands; retain asks-cli’s exact stderr contracts. Scope limited to CLI dispatch/imports, avoiding sessions.ts (T-141).

### impl-131 · 2026-10-10T06:09:46.671Z

Red/green evidence: node --test hub/test/cli-imports.test.ts initially reported SQLite reached through orphans.ts, hub/store.ts, tracker/index-db.ts and adapters/processes.ts. After deferring daemon/orphans/provision, the guard still caught doctor/project.ts → adapters/claude-code.ts → adapters/processes.ts. Deferring checkProject too makes all 28 database-free invocations pass. The runtime resolver guard includes a SQLite positive control and sees static/dynamic imports without relying on warnings.

### impl-131 · 2026-10-10T06:25:02.434Z

Implementation complete at bfa25220b0a2214b0ca66c68a71de9d8a857bcf5, committed and pushed to local origin; clean worktree. Node v24.21.0, NODE_OPTIONS/NODE_NO_WARNINGS unset (matches A-293/A-297). Typecheck passed; targeted guard 1/1, asks CLI 4/4, general CLI 2/2, init 12/12 and doctor 18/18 passed. Full npm test exited 0: hub 871/871, Neovim 200/200, no failures/skips/cancellations. Log A-474: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-474-t-131-full-test-suite-1071-passed.log. Implementation/self-review A-469 (Standards clear, Spec clear). Four lazy storage edges fixed, including additional doctor→project→adapter process table; original stderr checks unchanged, no warning suppression, sessions.ts untouched.

### rev-8 · 2026-10-10T06:28:07.369Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-131-1
commit: bfa25220b0a2214b0ca66c68a71de9d8a857bcf5

No high, medium or low findings. Four awaited storage-owning imports are confined to command execution, with validation, undo short-circuit and existing command catches preserved. Guard observes actual node:sqlite resolution, verifies its positive control and requires an empty import log plus expected exit codes for28 database-free invocations; not a tautology. No warning suppression or changed exact-stderr comparisons. Independent in-memory Node resolver probe: CLI --version0 edges; real SQLite import1 edge causes empty-edge assertion failure and still emits ExperimentalWarning. Standards and Spec clear; git diff --check passed. No suite or edits; Node24 guard/asks/full-suite evidence is A-475/A-474. Review A-477: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-477-t-131-review-rev-8-131-1-deferred-sqlite-imports-clear.md.

### coord · 2026-10-10T06:28:14.265Z

Merged 453341fba41e482ad4e55f24ef2df655cb4113d0 onto dev.
