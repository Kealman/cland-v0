---
id: T-75
kind: task
title: "Shared synchronous I/O on every hub request: the permission check reads roles.toml and the journal writes with writeSync"
state: open
labels:
  - ready-for-agent
  - hub
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T15:35:43.178Z
updated: 2026-10-09T15:35:43.178Z
---

## Parent

Part of T-19. Found on 2026-10-09 at 15:31Z and 15:35Z by impl-61 (T-61) and impl-60 (T-60) during their await audits, the request-path rule from the T-73 retrospective (A-96, class A). Both items left the shared code alone by the Coordinator's decision, so that two parallel items do not convert the same module.

## What happened

Two shared paths run on every hub request and do synchronous file I/O:
- The permission gate calls `RolesFile.get()`, which stats `.cland/roles.toml` and may read it with `statSync`/`readFileSync`.
- Daemon logging writes journal records with `writeSync`.

A slow disk or a large file stalls the event loop for every connected session, the class of stall T-67 removed for git and T-70 removed for `ps`.

## What to build

- Roles: keep the parsed roles file in memory and refresh it asynchronously (a watcher or an async stat on a timer), so a permission check reads memory only. A changed file is visible to the next check within a bounded delay; say how long in hub/README.md.
- Journal: decide, and write down in hub/README.md, whether the journal stays synchronous for durability. If it stays, measure its cost under the request timer and justify it. Otherwise, use an ordered async append queue that keeps write order and flushes on hub stop.
- An architecture test that fails when `statSync`, `readFileSync` or `writeSync` is reachable from the permission gate.

## Acceptance criteria

- [ ] A permission check performs no synchronous file system call, which a test proves.
- [ ] An edit to roles.toml takes effect within the documented delay, which a test proves.
- [ ] The journal decision is documented, and its cost under the request timer is tested.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Implementer: Codex. Start after T-60 and T-61 merge: both touch the request paths next to it.
