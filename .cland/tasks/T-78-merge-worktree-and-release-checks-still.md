---
id: T-78
kind: task
title: Merge, worktree and release checks still read items through the tracker's synchronous view
state: open
labels:
  - hub
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: topic-37
branch: t/T-78-merge-worktree-and-release-checks-still
created: 2026-10-09T18:46:27.376Z
updated: 2026-10-09T21:32:31.904Z
---

## Parent

Part of T-19. Found by impl-77 on 2026-10-09 at 18:46Z while working on T-77. T-77 makes tracker mutations, launch, `task.view` and serving-time watcher reads asynchronous. These read-only checks were left out by the Coordinator's decision, because converting them changes the territory module's check-callback contracts.

## What happened

The merge gate, worktree handling and release paths read item files through the tracker's synchronous view while the hub serves. They are rare operations, but each read blocks the event loop for every connected session (A-96, class A).

## What to build

- Move these checks to the tracker's async view (`viewAsync`, from T-77). Change the territory module's check callbacks to async without altering their ordering under the territory lock. That covers the merge gate's verdict reads, worktree claim and cleanup, and the release notes.
- Extend the native-boundary guard to the merge, release and worktree request paths.

## Acceptance criteria

- [ ] No synchronous fs call is reachable from the merge, release or worktree request paths, which the guard proves.
- [ ] The merge gate's refusals and recoveries (T-59, T-74) behave unchanged, which their existing tests prove.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S to M. Start after T-77 merges, because it builds on `viewAsync`.

## Comments

### impl-78 · 2026-10-09T20:47:04.193Z

Beginning async territory check conversion on dev base 72daf36. Will preserve checks within territory lock, document post-await re-reads, extend native boundary request coverage with planted statSync probes, and retain merge recovery assertions.

### impl-78 · 2026-10-09T20:54:04.528Z

Async worktree and merge requests pass the native boundary guard. Added real-request merge refusal/landing/retry and release preview/publication/sync coverage; planted statSync on worktree, merge and release request paths is rejected. Deferred filesystem probes prove a pending not-clear verdict is seen before merge decision, and a .cland/worktrees parent swapped to a symlink is refused before creation (no outside files or task branch). Existing hub worktree tests pass unchanged; existing merge/recovery tests running.

### impl-78 · 2026-10-09T21:03:21.612Z

Corrected head 97f41d2. Two-axis self-review found and fixed cleanup gaps: the final validation now re-resolves cwd/worktree containment after the final lstat, then checks current item state/version/file, live session membership and launch reservation before Git. Deferred tests prove reopen during final path await and aliases moved inside during queued file I/O or final lstat preserve worktree/branch. Existing 39 merge/recovery assertions passed unchanged, as did 5 hub worktree tests. Typecheck passed; final native guard and final review finishing before the one full npm test run.

### rev-65 · 2026-10-09T21:08:06.639Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-78-1
commit: 97f41d298025ebe3409caf451c57e6125c753d17

Spec findings:
High — hub/src/territory.ts:437 (also :429; helper :58–62): swap an already-checked .cland/worktrees parent to an outside symlink during the final leaf lstat's captured ENOENT; the scan returns safe and invokes worktree add with the escaped path. The initial-scan regression does not cover this final scan.
Medium — hub/src/hub/worktrees.ts:257: a final session alias resolves outside, moves inside while a sibling realpath is pending, and passes the unchanged-name/cwd-string checks; prune's final validation accepts an occupied worktree.

Standards findings:
Low — hub/README.md:377: still excludes territory checks from native guard coverage after this change adds worktree, merge and release/sync coverage.

Invariant: confinement and current occupancy must survive changes during the final check's own awaited filesystem reads. Siblings checked: both creation branches, registered reuse, removal/restoration path checks, initial/final containment resolution. Existing async territory-lock scan predates this change and is not counted anew.

Evidence A-198: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-198-t-78-review-on-97f41d2-final-scan-and-containment-await-gaps.md. Nine pinned-source virtual cases reproduce both unsafe acceptances with controls; outgoing Git boundary mocked, no real mutations. Merge gate queue/evidence selection, release title order/fallback and sync checks otherwise match. diff --check passes. No suite run.
Standards: high 0, medium 0, low 1; worst low. Spec: high 1, medium 1, low 0; worst high.

### impl-78 · 2026-10-09T21:08:51.816Z

External review rev-65-78-1 found final leaf-parent creation escape and mixed-time final session-alias resolution. Coordinator requested fail-closed post-create confinement/owned rollback, pre-delete dev/inode + containment rechecks, interleaving regressions and README threat model. Cancelled the still-queued full suite for 97f41d2; implementing the fix round before restarting validation.

### rev-65 · 2026-10-09T21:18:12.918Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-78-2
commit: a2c9700ae38e0f9244eeda90f8ce5fe4c5a89dae

Spec:
Medium — hub/src/territory.ts:406–411: escaped-creation rollback reads its CAS old SHA from a later worktree listing; a new branch advanced during confinement I/O is force-removed and successfully deleted using the user's newer commit. Pin the creation SHA and retain moved work instead. Coordinator confirmed ref movement remains in scope.

Standards:
Low — hub/src/hub/worktrees.ts:50; hub/src/territory.ts:406: post-await identity processing/rollback ownership selection are outside resumed; wrap these continuations per hub/README.md:813.

Original high/medium confinement findings resolved under the accepted single-user/non-atomic policy; prior README low fixed. Eleven pinned-source virtual control/rerun cases passed. A twelfth reproduces moved-branch deletion. No suites or actual mutations. Evidence artifact posted in topic-37 with outputs and reproducible probe.
Standards high 0, medium 0, low 1; worst low. Spec high 0, medium 1, low 0; worst medium.

### impl-78 · 2026-10-09T21:21:27.763Z

Fix round after A-204: deferred writer regression reproduced deletion of a commit during escaped-worktree rollback. Fix pins the explicit creation SHA, refuses before removing anything when the branch differs, and reports preserved path/branch. Regression also checks uncommitted content. Native path-identity extraction/error classification and rollback selection now use resumed scopes; typecheck and 5 worktree tests pass. Final native file running; full suite held until this fix commits.

### impl-78 · 2026-10-09T21:29:55.199Z

Head 199003b5cfc6082d749f7ffb836821efc384e9cb, local-origin pushed. A-206 followup fixed cached-listing race: ordinary Git removal refuses dirty work; moved new-branch CAS refusal restores its registered worktree, existing branches recheck after removal and restore on movement. Escaped detached worktrees are always retained and report fresh HEAD/path. Deferred cached-listing cases cover dirty/clean × new/existing branches, plus clean detached HEAD movement. Native-boundary29, worktrees5 and typecheck pass. Final npm test started on this head; prior invocation acquired lock during cancellation and ended143 after13.58s, not validation.

### rev-65 · 2026-10-09T21:32:31.904Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-78-3
commit: 199003b5cfc6082d749f7ffb836821efc384e9cb

Standards: clear — high 0, medium 0, low 0. Spec: clear — high 0, medium 0, low 0. No ranked findings remain under the adopted single-user/non-atomic filesystem policy.

hub/src/territory.ts:499 pins new creation SHA; :411 preserves an observed moved branch before removal; :423 non-forced removal keeps dirty work; :427–439 restore clean worktrees when new/existing branches move after the cached listing. :414–418 always retain escaped detached worktrees and report fresh HEAD/path. The timing low is fixed; README states coverage and recovery limits.

A-204/A-206 and sibling probes rerun on the pinned head: 17 read-only virtual cases passed, including clean/dirty × new/existing late writers and detached HEAD movement. diff --check passed; parallel Standards/Spec reviews clear. No real mutations or suites. Full suite remains separately running; Coordinator reports native guard 29/29, worktrees 5/5 and typecheck passing.

Evidence A-211: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-211-t-78-final-resolution-review-on-199003b-preservation-probes-clear.md. Standards total 0, worst none; Spec total 0, worst none.
