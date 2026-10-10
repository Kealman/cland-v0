---
id: T-131
kind: task
title: CLI commands that need no database still import node:sqlite; its ExperimentalWarning pollutes exact stderr
state: open
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-10T00:25:36.040Z
updated: 2026-10-10T00:25:36.040Z
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
