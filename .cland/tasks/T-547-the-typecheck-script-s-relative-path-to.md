---
id: T-547
kind: task
title: The typecheck script's relative path to typescript7 fails in task worktrees without their own node_modules
state: open
status: in progress
size: XS
labels:
  - bug
  - hub
assignee: null
parent: E-482
blocked_by: []
regression_of: T-427
topic: topic-341
branch: t/T-547-the-typecheck-script-s-relative-path-to
created: 2026-10-15T23:01:44.244Z
updated: 2026-10-15T23:02:21.748Z
---

## Summary
T-427 (merged 21:28Z) set the hub's and Neovim's typecheck scripts to `node ../node_modules/typescript7/bin/tsc …`, a relative file path. Task worktrees under `.cland/worktrees/T-n` usually have no `node_modules` of their own; Node's package resolution walks up to the root install, but a literal file path doesn't. So `npm run typecheck`, and every verify's host typecheck, fails with MODULE_NOT_FOUND in such worktrees. impl-469 hit it at 23:01Z after merging dev, and impl-499's verify c6147dd0 failed the same way at 22:41Z. Each implementer has worked around it with `npm ci` in their worktree.

## Acceptance criteria
- [ ] C1. The typecheck scripts in hub/package.json (and nvim's, if it has the same form) find the TypeScript 7 compiler by package resolution, for example through its bin on the npm-run PATH or `require.resolve('typescript7/package.json')`. So they work in the root, in a worktree with no `node_modules` and in a worktree with its own, and the 5.9 API imports still bind to `typescript`.
- [ ] C2. A test runs the typecheck script from a git worktree that has no `node_modules` and sees it exit 0, and T-427's parity receipt still holds.
