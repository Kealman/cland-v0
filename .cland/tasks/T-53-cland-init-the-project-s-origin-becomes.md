---
id: T-53
kind: task
title: "cland init: the project's origin becomes a local territory, GitHub becomes `github`, and `--undo` puts it back"
state: closed
labels:
  - ready-for-agent
  - slice-2
assignee: impl-53
parent: T-20
blocked_by: []
topic: topic-10
branch: t/T-53-cland-init-territory
created: 2026-10-09T08:33:53.643Z
updated: 2026-10-09T10:00:10.460Z
---

## Parent

Part of T-20 (slice 2, ticket 1 of 12). Spec sections 4.9 and 7(a); ADR 0004.

## What to build

In a git project, `cland init` gains a territory step. It creates the bare repository `.cland/territory.git`, renames an existing `origin` to `github` (git carries the branches' upstreams along) and adds the territory as `origin`, creates `dev` from `main` when absent, and seeds the territory with `main` and `dev` by a local push: nothing reaches GitHub. The territory's `HEAD` points at `dev`, so tools that branch from the remote's default branch start from `dev`. Its `update` hook refuses every update or deletion of `main` and `dev` that does not carry cland's marker, naming `cland merge` and `cland release`; task branches stay free, force-pushes included. A clean root on `main` is switched to `dev`: the root lives on `dev`, the Coordinator's tracker and docs commits land there directly, task work reaches `dev` only through `cland merge`, and `main` moves only by `cland release` and `cland sync` (decision D1). The step lives in one territory module that `cland init` runs without a hub and the hub runs later for worktrees, merges, releases and syncs under one lock (decision D2; spec 4.2's "git operations stay outside" is amended to "git state stays in git; the hub runs the territory's commands"). `AGENTS.md`'s managed block reads "only `cland release` pushes to `github`" in a project with a territory and keeps today's rule without one. `cland doctor` checks the territory. `cland init --undo` restores the remotes and the root's branch, and deletes the territory only when it holds no ref the project's repository lacks; otherwise it names them and needs `--force`. It keeps `dev`. A project with no remote gets a territory and no `github`; a folder that is not a git repository gets none, with a note.

Interim rule for cland's own repository (decision D15 with checkpoints): cland moves onto its territory right after this ticket merges. Until ticket 5 (`cland release`) lands, the Coordinator squashes merged task work onto `dev` by hand, and the human's stand-in pushes a verified checkpoint of `main` to the `github` remote by hand at each step-level milestone, so GitHub does not go dark meanwhile. Say so in the docs where the push rule is described.

## Acceptance criteria

- [ ] In a temp project whose `origin` is a bare repository on disk standing in for GitHub, `cland init` reports each territory step. Afterwards `origin` is `.cland/territory.git`, `github` is the old URL, the territory holds `main` and `dev` with `HEAD` on `dev`, and the stand-in GitHub's refs are unchanged.
- [ ] The root is on `dev` afterwards; a root with uncommitted changes, or on another branch, is left where it is and the report says so.
- [ ] A second `cland init` reports every territory step `unchanged`, also in `--json`.
- [ ] From the project, `git push origin HEAD:dev` and `git push origin :main` are refused with a message naming `cland merge` and `cland release`; pushing and force-pushing `t/T-1-x` succeed.
- [ ] `cland init --undo` restores `origin` to the old URL, removes `github` and the territory, and puts the root back on `main`. With a branch only the territory holds, it refuses and names it, and `--force` proceeds.
- [ ] `AGENTS.md`'s managed block carries the new push rule with a territory and today's rule without one; `cland update` rewrites it the same way.
- [ ] `cland doctor` reports `territory` ok, or fails with a fix when `origin` is not the territory, `dev` is missing or the territory's `HEAD` is not `dev`.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` documents the territory, the interim rule and `--undo`.

## Notes

Test seam: the CLI as a process in temp projects with real git, as the worktree CLI tests do; assertions on remotes, refs, hooks, config and files; never on this repository. Size M. Implementer: Codex gpt-6.1-sol (plain git and provisioning, testable on disk inside its sandbox). Can start immediately.

## Comments

### impl-53 · 2026-10-09T08:38:07.498Z

Claimed. Using the ticket's agreed CLI-process seam in temporary real-Git projects. Inspecting init/update/doctor and ADR 0004 before adding territory provisioning, protection, and undo.

### coord · 2026-10-09T08:39:12.987Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/48 (a sub-issue of #20; the item is the source of truth).

### impl-53 · 2026-10-09T08:44:48.231Z

CLI tests now pass for redirecting origin without touching stand-in GitHub, upstream preservation, main/dev seeding, idempotence, protected updates/deletions, free task force pushes, reversible remotes/root branch, and refusal/--force for territory-only refs. Territory module owns Git execution and a shared recoverable lock; adding doctor corruption and dirty/no-remote coverage and documenting the interface.

### impl-53 · 2026-10-09T08:53:03.262Z

Two-axis skill review completed: standards found no documented violations/smells; spec identified origin push URL overrides and doctor accepting an owner-non-executable hook. Both fixed and confirmed in focused review. Targeted suites: 37 passed; added review regressions: 2 passed. Typecheck passing before review fixes and final typecheck in progress; then full suite once.

### impl-53 · 2026-10-09T09:05:52.082Z

Implementation complete on t/T-53-cland-init-territory: e41af66 (territory provisioning, hook, undo, lock/runner interface, init/update managed rules, doctor, CLI integration tests and README); b6048e1 (origin fetch/push destination validation/repair and executable-hook doctor check).

## Standards
No documented standards breaches or baseline smells. Review raised the origin push override correctness risk; fixed with a regression test.

## Spec
Review identified push destination validation and owner-executable hook checking as partial requirements. Both fixed; focused rereview found no remaining issue or scope creep.

Validation: npm run typecheck passed. Targeted init/doctor/territory run: 37 passed; review regressions: 2 passed. Full npm test run: hub 272 passed, 7 environment skips (6 ps restrictions, 1 sandbox-exec), 0 failed; Neovim 61 passed, 1 existing timing failure at nvim/test/shell.test.ts:1142 ('the tree follows task events', T-13 removal). The exact failed Neovim test passed alone (1 passed, 0 failed, 2.14s); no timeout/retry modifications. Full output: /tmp/cland-t53-full-tests.log; isolated rerun: /tmp/cland-t53-nvim-rerun.log. Shared load exceeded 140 during the run.

No repository init, merge, push, or tracker-file commit performed. Future worktree/merge/release commands remain out of scope; their synchronous territory interface and D15 migration exception are documented in hub/README.md.

### rev-3 · 2026-10-09T09:12:02.234Z

verdict: review
result: not clear
by: rev-3 [reviewer]
run: rev-20261009-53-b6048e1

Reviewed b8368b3...b6048e1 (e41af66 + b6048e1), main thread only, against T-53, D1/D2/D15 and the Coordinator's brief.

High — hub/src/territory.ts:172: Undo validates matching local refs at lines 159–163, then `git remote remove origin` deletes the project's `refs/remotes/origin/*` copies before line 178 removes the territory; a matching territory ref can therefore disappear from both repositories without --force. Reproduction: create an otherwise unreferenced commit with commit-tree, set refs/remotes/origin/review-copy locally, push that same ref to origin, then init --undo. It exits 0 and reports every ref preserved although no remaining project ref points to that commit. Preserve these copies or refuse before mutation based on the refs that will survive the planned remote changes. QA-8 confirmed with real Git in a scratch project; I read its commands and output in /tmp/qa-8-t53-undo-tracking.log (probe /tmp/qa-8-t53-undo-tracking.py).

Standards: no additional documented-standard violation or actionable baseline smell. Spec: the undo preservation guarantee above is blocking; remaining provisioning, protection, branch handling, reporting, instruction rules, doctor and D15 documentation match the brief. No tracker files in the diff; diff --check passes.

Requested interface assessment: the path/runner/lock interface is small and documented. withTerritoryLock is synchronous, usable from an async hub handler only for a wholly synchronous callback; it releases before a returned Promise settles. The exact function with in-memory lock stubs confirmed this. README explicitly forbids Promise callbacks; future awaited operations need an async-safe lock API rather than wrapping their whole async operation in this helper. CLAND_TERRITORY_WRITE blocks ordinary unmarked main/dev pushes and deletions, but a local owner can set it or change/bypass the hook; it is an accident guard, as documented.

Evidence limits: no file/Git mutation or suite execution by this read-only Reviewer. Read the CLI tests and implementer's full/rerun logs: hub 272 pass/7 skips/0 fail, Neovim 61 pass/1 existing timing failure that passed alone. One read command guessed nonexistent hub/src/init/project.ts and failed; corrected by locating init/provision.ts. Cl and tools remained functional.

### qa-8 · 2026-10-09T09:13:25.931Z

verdict: qa
result: not clear
by: qa-8 [qa]
run: qa-20261009-t53-b6048e1-1

Checked t/T-53-cland-init-territory at b6048e1d471c097872ced073383858c3613c76ba (includes e41af66). Worktree remained clean; no implementation changes.

Ran:
- `npm run typecheck && npm test`: exit 0. Hub: 279 total, 272 passed, 7 documented environment skips (ps/sandbox-exec), 0 failed. Neovim: 62 passed, 0 failed, 0 skipped. The project harness drives headless Neovim with nvim_input and reads screenstring(); no timing rerun was needed. Log: /tmp/qa-8-t53-full.log.
- `node --test hub/test/doctor.test.ts hub/test/init.test.ts hub/test/territory-cli.test.ts`: 38 passed, 0 failed, 0 skipped. Read the tests' assertions. Log: /tmp/qa-8-t53-targeted.log.
- `node hub/bin/cland.ts task list --state open --json` and `task view T-53 --json`: both exit 0; 20 open items and T-53 returned. Also read task.view and the Coordinator brief.
- Independent CLI/Git acceptance script `/tmp/qa-8-t53-manual.py`: all prescribed cases passed in temporary projects under TMPDIR. Three commits on main; local bare GitHub stand-in; init report, remotes/upstream, seeded main/dev, HEAD dev, root dev and untouched GitHub refs; repeat text/JSON territory steps all unchanged; updates and deletion of both protected branches refused naming cland merge/release; task push and force push succeed. Doctor reports territory ok and individually detects changed origin, deleted dev and incorrect HEAD with a fix; each state restored. Managed push rule refreshed by update. Undo restores origin/main, keeps dev, removes github/territory; territory-only branch refused by name, --force succeeds. No-remote, non-Git, dirty tracked/untracked, alternate branch and detached cases passed. Log: /tmp/qa-8-t53-manual.log.
- Healthy plain `doctor` with the repository's fake external toolchain: exit 0, territory ok, 19 ok / 2 expected no-hub warnings / 0 fail. Log: /tmp/qa-8-t53-doctor.log. External auth/network services were not exercised.
- Read hub/README.md: territory, undo, marker accident-guard semantics and D15 interim checkpoint rule match the exercised behavior.

Findings, highest severity first:
- HIGH — `hub/src/territory.ts:159` and `hub/src/territory.ts:172`: undo accepts a matching local ref that its own remote removal subsequently deletes, then deletes the territory. Independently reproduced rev-3's scenario twice: after init, make a unique commit with `git commit-tree HEAD^{tree} -p HEAD -m ...`; point local `refs/remotes/origin/review-copy` at it; `git push origin refs/remotes/origin/review-copy:refs/remotes/origin/review-copy`; run `init --undo` without --force. Main/dev remain unchanged and both repositories held the matching ref before undo. Actual: exit 0, territory removed, and `git for-each-ref` shows no surviving root ref to the unique commit. Report incorrectly says every territory ref is preserved locally. Expected: preserve the local ref or refuse before mutations based on refs that will survive undo. Probe `python3 /tmp/qa-8-t53-undo-tracking.py` fails with `UNDO LOST BOTH MATCHING REFS WITHOUT --force`. Logs: /tmp/qa-8-t53-undo-tracking.log and /tmp/qa-8-t53-undo-tracking-repeat.log.

Evidence limits: documented environment skips above; external services replaced with local bare Git and fake doctor tools. Every scratch cland invocation stripped CLAND_HUB_FILE, CLAND_SESSION_ID and CLAND_SESSION_NAME. No init/undo/territory/hub start/stop was run against the real project.

### impl-53 · 2026-10-09T09:14:06.941Z

Working review/QA fixes: regression reproduces matching origin tracking refs disappearing from both repositories during undo; async-lock regression will hold one callback pending and verify an overlapping caller cannot enter until settlement. Preserving current synchronous return behavior and live-holder refusal. Diagnosing-bugs feedback loop is the real-Git CLI regression; review already pinpoints the deletion order, so broad hypothesis/instrumentation phases are unnecessary.

### impl-53 · 2026-10-09T09:16:42.287Z

Review fixes reproduced red at agreed seams, then green: CLI undo refused neither copy before fix; overlapping async lock caller entered early before fix. After fix all 3 focused regressions pass. Original QA probe /tmp/qa-8-t53-undo-tracking.py now exits successfully with UNDO_EXIT 1, TERRITORY_EXISTS True, PRESERVED_REF True; output /tmp/impl-53-undo-tracking-fixed.log. Full npm run typecheck && npm test launched once; log /tmp/cland-t53-review-fixes-tests.log. One fix commit adds async lock lifetime handling, origin-tracking exclusion during undo, tests and README clarification.

### impl-53 · 2026-10-09T09:19:39.637Z

Review fix commit 015ea6a: undo refuses matching refs/remotes/origin/* copies because remote removal deletes them; refusal leaves refs/remotes/root branch/territory untouched and --force proceeds. withTerritoryLock now keeps async operations exclusive through promise fulfillment/rejection, preserves synchronous direct returns and releases after errors. Added the real-Git CLI loss regression plus two async lock tests (overlap and rejection); README documents async lifetime/refusal and explicitly states the marker is an accident guard the local owner can bypass.

Focused red→green: both requested bugs reproduced before the fix; all 3 regression tests pass afterward. Original QA probe now reports UNDO_EXIT 1, TERRITORY_EXISTS True, PRESERVED_REF True (/tmp/impl-53-undo-tracking-fixed.log).

npm run typecheck && npm test passed once (exit 0): hub 275 passed / 7 environment skips / 0 failures; Neovim 62 passed / 0 failures. No reruns or test timing changes needed. Full log /tmp/cland-t53-review-fixes-tests.log. Clean working tree; no tracker files committed, no push/merge/project init.

### rev-3 · 2026-10-09T09:23:31.734Z

verdict: review
result: not clear
by: rev-3 [reviewer]
run: rev-20261009-53-015ea6a

Second-round review of 015ea6a and main...015ea6a, main thread only.

High — hub/src/territory.ts:169–172: Undo still checks an incomplete set of refs that survive remote removal. The hard-coded refs/remotes/origin/ exclusion misses tracking destinations selected by custom remote.origin.fetch refspecs, and iterating only territory refs misses commits held solely by the root's origin tracking refs. Both paths allow --undo to remove the last refs to work without --force.

Confirmed cases at 015ea6a, with real Git in QA-8's scratch projects (I read both probes and outputs):
1. Add origin fetch mapping +refs/remotes/cache/*:refs/remotes/cache/*; point matching refs/remotes/cache/review-copy in root and territory at a unique commit. Undo exits 0 and removes both copies, still claiming every territory ref is preserved. /tmp/qa-8-t53-015ea6a-custom-fetch.log and matching .py.
2. Keep a unique commit only at local refs/remotes/origin/review-copy, with no matching territory ref (as can happen after another client deletes the remote branch). Undo exits 0 and leaves no project ref to that commit. /tmp/qa-8-t53-015ea6a-root-only.log and matching .py. This also fails the second-round brief's explicit root-tracking preservation requirement.

Preflight must determine the refs Git actually removes from origin's configured fetch destinations and check both affected root refs and territory refs against durable surviving copies before any mutation; preserve or refuse with the lost refs named, and allow explicit --force. The original default-prefix regression alone is fixed and its QA probe now refuses before mutation.

Standards: no additional documented violation or actionable smell. Async lock change is clear: exact implementation with in-memory lock stubs passed pending overlap refusal, fulfillment and rejection cleanup/outcomes, direct synchronous return and synchronous error cleanup. New real-lock tests cover overlap and rejection; CLI regression covers the original refusal and --force. README now documents async lifetime and the marker's bypassable accident guard.

Evidence limits: read-only review, no files/Git changed and no disk test suite run here. Read final implementer log /tmp/cland-t53-review-fixes-tests.log: typecheck passed, hub 275 pass/7 skips/0 fail, Neovim 62 pass/0 fail. diff --check passes; no tracker files in diff. No failed review tool calls this round.

### impl-53 · 2026-10-09T09:27:02.349Z

Second review fix/addendum: broadening undo preflight to both root refs affected by every configured origin fetch destination and all dropped territory refs, blocked only when their tips are unreachable from surviving root refs. Added regressions for custom wildcard/exact mappings, root-only tracking work, and a safe ancestor preserved by a differently named tag. Existing territory-only fixture now creates genuinely unique work to reflect the latest reachability rule.

### impl-53 · 2026-10-09T09:30:38.983Z

Second-round regressions reproduced all three old failures (custom fetch mapping lost work; root-only tracking work lost; safe surviving ancestor incorrectly refused). New preflight reads every origin fetch destination pattern, scans dropped root refs as well as territory refs, and checks their tips against the object graph reachable from surviving concrete root refs and HEAD. Symbolic aliases do not create independent surviving copies. Six undo tests pass, including custom wildcard and exact mappings, --force, and tag-held descendant history. Both QA probes now return UNDO_EXIT 1, TERRITORY_EXISTS True, PRESERVED_REF True: /tmp/impl-53-custom-fetch-fixed.log and /tmp/impl-53-root-only-fixed.log. Full npm run typecheck && npm test started once; output /tmp/cland-t53-reachability-tests.log.

### impl-53 · 2026-10-09T09:38:38.939Z

Second-round/addendum fix complete in a2cee80. Undo derives affected root refs from every configured origin fetch destination (wildcard/exact), unions them with dropped territory refs, and blocks only tips unreachable from surviving root refs/HEAD; symbolic aliases are not independent retained copies. It covers root-only tracking work, allows history retained under another name, and refuses before mutation unless --force. README and original unique-work fixture match this reachability rule.

Validation: six focused undo tests passed after all three new regressions failed on 015ea6a. Both QA probes passed with undo refused and original refs/territory preserved: /tmp/impl-53-custom-fetch-fixed.log and /tmp/impl-53-root-only-fixed.log. npm run typecheck && npm test passed once, exit 0: hub 278 passed / 7 documented environment skips / 0 failures; Neovim 62 passed / 0 failures. No timing rerun or timeout changes. Full log /tmp/cland-t53-reachability-tests.log. Clean working tree; one fix commit, no tracker-file commit/push/merge or real project init.

### rev-3 · 2026-10-09T09:42:03.583Z

verdict: review
result: clear
by: rev-3 [reviewer]
run: rev-20261009-53-a2cee80

Third-round review at a2cee80, including main...a2cee80, main thread only. No remaining high, medium or low findings.

Standards: no documented-standard violation or actionable baseline smell. Spec: the prior high is closed. Undo reads all configured origin fetch destinations, includes affected root refs and all territory refs, and checks dropped tips against the object graph reachable from surviving concrete refs and HEAD before branch/remotes/territory mutations. Named refusals preserve state; --force remains explicit. The new CLI regressions cover wildcard and exact custom mappings, root-only tracking work, forced undo and work retained in a differently named ref's history. README reflects the reachability rule; async lock and marker accident-guard documentation remain correct.

Read QA-8's independent a2cee80 probe driver and logs: /tmp/qa-8-t53-a2cee80-{original,custom-fetch,root-only}.log. All three cases assert named refusal/--force guidance, unchanged root and territory refs, remotes and branch, then successful forced restoration/removal. Also read implementer's /tmp/impl-53-custom-fetch-fixed.log and /tmp/impl-53-root-only-fixed.log.

Additional read-only verification: exact new undo helper with virtual ref inventories and real Git object traversal passed wildcard/exact destination, root-only work, surviving descendant and symbolic-alias cases. Async lock lifetime/overlap/fulfillment/rejection/synchronous cleanup was verified in the previous round and unchanged here. diff --check passes; no tracker files in diff.

Evidence limits: no files/Git mutated or disk suite run by this Reviewer. Read final implementer log /tmp/cland-t53-reachability-tests.log: typecheck passed, hub 278 pass/7 documented skips/0 fail, Neovim 62 pass/0 fail. QA-8's independent full suite is still running; its three preservation/force probes have passed. No failed review tool calls this round.

### qa-8 · 2026-10-09T09:53:26.099Z

verdict: qa
result: clear
by: qa-8 [qa]
run: qa-20261009-t53-a2cee80-1

Refresh verified a2cee80e186ee5c4675d076b802be11dbf18b763 on t/T-53-cland-init-territory. git log -1 matched the request; working tree remained clean through verification. This supersedes my not-clear verdict at b6048e1.

Ran:
- `npm run typecheck && npm test` once. Typecheck passed. Full hub suite: 285 total, 276 passed, 7 documented environment skips, 2 failures; both failures were 15-second waits in unchanged harness tests. `claude-code-adapter.test.ts:227` timed out waiting for the clause injection retry; `claude-code-sessions.test.ts:104` timed out waiting for the clause turn. Each exact test passed when rerun alone, 1/1, with no retries/timeouts changed. Logs: /tmp/qa-8-t53-a2cee80-full.log, /tmp/qa-8-t53-a2cee80-inject-rerun.log, /tmp/qa-8-t53-a2cee80-signal-rerun.log.
- Since npm stopped after the hub failures, ran `npm run test:nvim` explicitly: 62 passed, 0 failed, 0 skipped. The project's headless harness uses nvim_input and screenstring(), with the main worktree's cached runtime. Log: /tmp/qa-8-t53-a2cee80-nvim.log.
- `node --test hub/test/doctor.test.ts hub/test/init.test.ts hub/test/territory-cli.test.ts hub/test/territory-lock.test.ts`: 44 passed, 0 failed, 0 skipped. Read the new regressions: custom wildcard/exact fetch destinations, root-only tracking work, refusal before mutation, explicit --force, safe work preserved through a surviving tag's descendant history, and async lock overlap/fulfillment/rejection. Log: /tmp/qa-8-t53-a2cee80-targeted.log.
- `python3 /tmp/qa-8-t53-a2cee80-probes.py`: all three independent real-Git repros passed in fresh TMPDIR projects. Cases: matching root/territory refs/remotes/origin/review-copy; matching refs/remotes/cache/review-copy with custom origin fetch mapping; root-only origin tracking ref. Each unforced undo exits 1, names the ref and --force, and leaves all root refs, territory refs, remotes and current branch unchanged. Each forced undo then exits 0, removes the territory, restores the original origin/main and permits the unique ref's loss. Logs: /tmp/qa-8-t53-a2cee80-original.log, /tmp/qa-8-t53-a2cee80-custom-fetch.log, /tmp/qa-8-t53-a2cee80-root-only.log. These close the previously reproduced data-loss paths.
- Tracker `task.view`, `node hub/bin/cland.ts task list --state open --json`, and `task view T-53 --json`: successful; list returned 20 open items and view returned T-53.
- Read updated hub/README.md: configured destinations, affected root refs, surviving object history/HEAD, explicit force and async lock behavior match the checked implementation.

Findings by severity:
- High/medium: none remaining in the requested scope. Prior undo preservation failures no longer reproduce.
- Low / verification observation: the two full-run harness timeouts above did not reproduce individually under the prescribed reruns. The full npm invocation itself was not green; isolated reruns and the subsequent Neovim and changed suites passed.

Evidence limits: seven documented environment skips (ps/sandbox-exec); external GitHub/auth services were not exercised. Scratch cland commands stripped CLAND_HUB_FILE, CLAND_SESSION_ID and CLAND_SESSION_NAME. No init, undo, territory, hub start/stop, push or source edit was performed against the real project. No timing adjustments or implementation changes made by QA.

### coord · 2026-10-09T10:00:10.460Z

Merged into main as 04b1e05 (`git merge --no-ff`, by the Coordinator) at 09:56Z; on main after the merge (with T-54): typecheck clean, 294 hub + 65 Neovim tests pass. Verdicts: review not clear rev-20261009-53-b6048e1 (one high: `--undo` lost a commit held only as origin's tracking ref), fix 015ea6a, review not clear rev-20261009-53-015ea6a (the same gap with custom fetch refspecs and root-only tracking refs, reproduced by qa-8), fix a2cee80 (affected root refs from origin's actual fetch destinations; a dropped tip must stay reachable from a surviving ref or HEAD; the territory lock holds through an async callback), review clear rev-20261009-53-a2cee80 (rev-3, 09:42Z), QA not clear qa-20261009-t53-b6048e1-1 then clear qa-20261009-t53-a2cee80-1 (qa-8, 09:53Z: three independent undo probes refusing before mutation and proceeding with `--force`, the manual acceptance path with a stand-in GitHub, the suite). Notes for the tickets that build on it: the territory module exports the path, a lock (sync and async) and a marked git runner; the push marker is an environment variable, an accident guard against ordinary pushes, bypassable by the local owner (documented). Timeline: launched 08:37Z, implemented 09:05Z, three review rounds to 09:42Z, QA to 09:53Z, merged 09:56Z. GitHub mirror #48. Next: cland's own repository moves onto its territory (D15) after the hub restart.
