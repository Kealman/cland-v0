---
id: T-547
kind: task
title: The typecheck script's relative path to typescript7 fails in task worktrees without their own node_modules
state: open
status: review
size: XS
criterion_seq: 2
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
updated: 2026-10-15T23:31:46.544Z
---

## Summary
T-427 (merged 21:28Z) set the hub's and Neovim's typecheck scripts to `node ../node_modules/typescript7/bin/tsc …`, a relative file path. Task worktrees under `.cland/worktrees/T-n` usually have no `node_modules` of their own; Node's package resolution walks up to the root install, but a literal file path doesn't. So `npm run typecheck`, and every verify's host typecheck, fails with MODULE_NOT_FOUND in such worktrees. impl-469 hit it at 23:01Z after merging dev, and impl-499's verify c6147dd0 failed the same way at 22:41Z. Each implementer has worked around it with `npm ci` in their worktree.

## Acceptance criteria
- [ ] C1. The typecheck scripts in hub/package.json (and nvim's, if it has the same form) find the TypeScript 7 compiler by package resolution, for example through its bin on the npm-run PATH or `require.resolve('typescript7/package.json')`. So they work in the root, in a worktree with no `node_modules` and in a worktree with its own, and the 5.9 API imports still bind to `typescript`.
  - verified: rev-30 [reviewer] · run rev-20261015-547-source · 2026-10-15T23:31:46.544Z · commit 5d18c219cbfafbacd1f53b6abcf4f6720270c38f
- [ ] C2. A test runs the typecheck script from a git worktree that has no `node_modules` and sees it exit 0, and T-427's parity receipt still holds.

## Comments

### impl-547 · 2026-10-15T23:28:45.159Z

Implemented and pushed 5d18c219cbfafbacd1f53b6abcf4f6720270c38f on t/T-547-the-typecheck-script-s-relative-path-to after fetching/merging origin/dev (be65d64a). Root and hub npm scripts share hub/bin/typecheck.ts, using import.meta.resolve('typescript7/package.json') and the existing compiler launcher; arguments/exit status pass through. No compiler dependencies or tsconfigs changed; Neovim is covered by the root script (no nvim/package.json).

Regression uses actual complete project sources/configs/scripts in an isolated real Git linked worktree. It checks root install, linked worktree without node_modules, local node_modules, native version 7.0.2, and unchanged typescript 5.9.3/createProgram API. A-3449 is the initial exact MODULE_NOT_FOUND reproduction. Five serial whole-file passes in A-3450: 5.142s,4.865s,3.944s,5.387s,4.616s; first two loaded beside non-Coordinator local verify, last three local:none. All admitted with load<15 and pgrep free; the measured duration exception and machine shard entry are committed. npm run typecheck and npm run test:shards pass in this dependency-free task worktree.

T-427 parity freshly rerun on exact 5d18c219: A-3451 full diagnostic receipt, A-3452 reproduction script (only ancestor-dependency resolution/output destination adapted from A-3343). Both projects clean; seven planted strict diagnostics each; disabled-.ts-import diagnostics match all file/line/code tuples (hub1300, Neovim488). No per-item QA scope/criteria. Mac slot released in Agents; requesting source review before verification.

### rev-30 · 2026-10-15T23:31:46.544Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-547-source
commit: 5d18c219cbfafbacd1f53b6abcf4f6720270c38f
scope: full

Source review T-547 clear at 5d18c219cbfafbacd1f53b6abcf4f6720270c38f, parent dev be65d64ae7ff51ee9375d1742d2b37488c08599d. Standards and Spec reviewed directly under the no-delegation role. No high, medium or low findings.

## Standards
No findings. Both scripts now share the three-line hub/bin/typecheck.ts launcher. import.meta.resolve locates the explicitly pinned typescript7 package from the script's local/ancestor dependency search; a URL relative to its package.json imports that package's existing bin/tsc. This avoids npm's ambiguous shared tsc alias and absolute/literal node_modules assumptions. Installed pinned launcher source was read, not executed: bin/tsc imports lib/tsc.js, which passes process.argv.slice(2) to the native executable and propagates failure status. Dynamic import leaves the compiler CLI arguments intact. No compiler dependencies, lockfile or tsconfig changes; no nvim/package.json exists, and root script still checks both hub and Neovim. Docs name the launcher and retain the TypeScript5.9 API explanation.

The regression uses actual complete hub/Neovim projects/configs/scripts copied into an isolated temporary Git repository, commits them, and creates a real linked worktree under .cland/worktrees. It checks no worktree node_modules exists, runs npm's actual root typecheck, checks native7.0.2 via hub npm script, asserts typescript5.9.3/createProgram API, then adds a worktree-local node_modules link and repeats the root command. It also checks the root install. Processes are synchronous and bounded; temporary repository/worktree cleanup runs after commands complete. Machine shard classification and the new test's measured5.141609-second allowance have a concrete full-project/Git/compiler rationale; no baseline rewrite or unrelated allowance change. Diff check clear.

## Spec
C1 verified by source and supporting targeted evidence: package resolution covers root, dependency-free linked worktree and local dependency layouts; scripts preserve explicit alias selection, original configs and TypeScript5.9 API imports. Root/hub package scripts remain the public entry points. A-3449 shows the same actual regression failing before the fix at the dependency-free worktree with exact MODULE_NOT_FOUND on the literal typescript7/bin/tsc path.

C2 final mark remains pending the same-head post-source task verification. Its targeted evidence is already strong: A-3450 has five complete serial whole-file Mac passes, one test each, zero failures/cancellations/skips (test durations5.142/4.865/3.944/5.387/4.616s). Loaded/quiet labels and per-admission load/no-Coordinator/free-target checks are disclosed.

Independently checked A-3451 JSON: receipt head equals reviewed head; versions5.9.3/7.0.2; both clean full projects exit0 with zero diagnostics. Planted strict diagnostics match all seven file/line/code tuples in each project; disabling .ts imports matches all1300 hub and488 Neovim tuples. Error exits2 versus1 are both nonzero, as in T-427; no clean/error mismatch. A-3452 archives this exact HEAD, links resolved ancestor dependencies, uses actual full configs, parses every diagnostic, and records all six variants; it is a reproducible receipt rather than a compiler mock. These checks preserve T-427's parity proof and do not make a new compiler-speed claim.

One exact-head no-mode/no-executor cland verify may follow source clear under current Coordinator admission rules. Preserve actual platform and report; source clearance is not the final suite gate. No per-item QA criteria.

Evidence: A-3449 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3449-t-547-regression-reproduces-dependency-free-worktree-compiler-failure.log; A-3450 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3450-t-547-five-serial-mac-whole-file-passes.log; A-3451 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3451-t-547-exact-head-t-427-compiler-parity-rerun.json; A-3452 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3452-t-547-compiler-parity-reproduction-script-adapted-for-ancestor-dependencies.mjs. No Reviewer tests, compiler/binary execution, edits, dependency installs, worktree creation, merges or provider actions.

Standards: 0 findings; Spec: 0 findings, final run evidence pending.

Review artifact A-3458 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3458-t-547-source-clear-at-5d18c219-package-resolved-compiler-and-real-worktree-regre.md.

Criteria: C1 verified.
