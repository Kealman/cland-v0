---
id: T-547
kind: task
title: The typecheck script's relative path to typescript7 fails in task worktrees without their own node_modules
state: open
status: review
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
updated: 2026-10-15T23:30:28.067Z
---

## Summary
T-427 (merged 21:28Z) set the hub's and Neovim's typecheck scripts to `node ../node_modules/typescript7/bin/tsc …`, a relative file path. Task worktrees under `.cland/worktrees/T-n` usually have no `node_modules` of their own; Node's package resolution walks up to the root install, but a literal file path doesn't. So `npm run typecheck`, and every verify's host typecheck, fails with MODULE_NOT_FOUND in such worktrees. impl-469 hit it at 23:01Z after merging dev, and impl-499's verify c6147dd0 failed the same way at 22:41Z. Each implementer has worked around it with `npm ci` in their worktree.

## Acceptance criteria
- [ ] C1. The typecheck scripts in hub/package.json (and nvim's, if it has the same form) find the TypeScript 7 compiler by package resolution, for example through its bin on the npm-run PATH or `require.resolve('typescript7/package.json')`. So they work in the root, in a worktree with no `node_modules` and in a worktree with its own, and the 5.9 API imports still bind to `typescript`.
- [ ] C2. A test runs the typecheck script from a git worktree that has no `node_modules` and sees it exit 0, and T-427's parity receipt still holds.

## Comments

### impl-547 · 2026-10-15T23:28:45.159Z

Implemented and pushed 5d18c219cbfafbacd1f53b6abcf4f6720270c38f on t/T-547-the-typecheck-script-s-relative-path-to after fetching/merging origin/dev (be65d64a). Root and hub npm scripts share hub/bin/typecheck.ts, using import.meta.resolve('typescript7/package.json') and the existing compiler launcher; arguments/exit status pass through. No compiler dependencies or tsconfigs changed; Neovim is covered by the root script (no nvim/package.json).

Regression uses actual complete project sources/configs/scripts in an isolated real Git linked worktree. It checks root install, linked worktree without node_modules, local node_modules, native version 7.0.2, and unchanged typescript 5.9.3/createProgram API. A-3449 is the initial exact MODULE_NOT_FOUND reproduction. Five serial whole-file passes in A-3450: 5.142s,4.865s,3.944s,5.387s,4.616s; first two loaded beside non-Coordinator local verify, last three local:none. All admitted with load<15 and pgrep free; the measured duration exception and machine shard entry are committed. npm run typecheck and npm run test:shards pass in this dependency-free task worktree.

T-427 parity freshly rerun on exact 5d18c219: A-3451 full diagnostic receipt, A-3452 reproduction script (only ancestor-dependency resolution/output destination adapted from A-3343). Both projects clean; seven planted strict diagnostics each; disabled-.ts-import diagnostics match all file/line/code tuples (hub1300, Neovim488). No per-item QA scope/criteria. Mac slot released in Agents; requesting source review before verification.
