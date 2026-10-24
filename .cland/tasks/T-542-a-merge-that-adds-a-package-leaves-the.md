---
id: T-542
kind: task
title: A merge that adds a package leaves the root checkout without it, and the next root-run typecheck fails
state: open
status: planned
size: S
labels:
  - bug
  - hub
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: null
branch: null
created: 2026-10-15T21:42:23.476Z
updated: 2026-10-24T06:46:49.283Z
---

## Summary
T-427 merged at 21:28Z (bd2fdba4). It switched the typecheck script to `typescript7@npm:typescript@7.0.2`. `cland merge` doesn't install dependencies, so the root checkout's `node_modules` had no `typescript7`. The next root run, E-387's stage close 02c7cfc7 at 21:40Z, failed in 9 s with "host typecheck failed (exit 1); no droplet created", and a `MODULE_NOT_FOUND` showed in the log. Task worktrees resolve `node_modules` from the root, so every implementer's typecheck after rebasing on dev would fail the same way. The Coordinator recovered with `npm install` in the root, which left the lockfile unchanged.

## Acceptance criteria
- [ ] C1. When a merge changes `package.json` or `package-lock.json`, the root's dependencies are brought up to date (an incremental install that doesn't remove packages a running hub may load), or the merge report names the install as required.
- [ ] C2. A host typecheck that fails with MODULE_NOT_FOUND for a dependency named in the lockfile reports "dependencies out of date: run npm install", not just exit 1.
- [ ] C3. `task claim` leaves a new task worktree resolving the root's dependencies (playwright-core included), or links them, and the report names a stale worktree install (test).

## Comments

### coord · 2026-10-15T22:43:24.442Z

Second form, 22:41Z: task worktrees an implementer filled with its own `npm ci` hold their own node_modules, so a later dependency change on dev doesn't reach them either. impl-499's verify c6147dd0 at 289b3c17 failed with "host typecheck: MODULE_NOT_FOUND …/T-499/node_modules/typescript7". Worktrees without node_modules resolve the root's, which is updated. C1 should cover the worktree case too: the worktree preparation installs from the lockfile at its base, or verify checks the lockfile hash before the host typecheck.
