---
id: T-542
kind: task
title: A merge that adds a package leaves the root checkout without it, and the next root-run typecheck fails
state: open
status: backlog
size: S
labels:
  - bug
  - hub
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T21:42:23.476Z
updated: 2026-10-15T21:42:23.476Z
---

## Summary
T-427 merged at 21:28Z (bd2fdba4). It switched the typecheck script to `typescript7@npm:typescript@7.0.2`. `cland merge` doesn't install dependencies, so the root checkout's `node_modules` had no `typescript7`. The next root run, E-387's stage close 02c7cfc7 at 21:40Z, failed in 9 s with "host typecheck failed (exit 1); no droplet created", and a `MODULE_NOT_FOUND` showed in the log. Task worktrees resolve `node_modules` from the root, so every implementer's typecheck after rebasing on dev would fail the same way. The Coordinator recovered with `npm install` in the root, which left the lockfile unchanged.

## Acceptance criteria
- [ ] C1. When a merge changes `package.json` or `package-lock.json`, the root's dependencies are brought up to date (an incremental install that doesn't remove packages a running hub may load), or the merge report names the install as required.
- [ ] C2. A host typecheck that fails with MODULE_NOT_FOUND for a dependency named in the lockfile reports "dependencies out of date: run npm install", not just exit 1.
