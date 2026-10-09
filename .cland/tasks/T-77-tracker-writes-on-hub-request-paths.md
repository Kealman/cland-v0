---
id: T-77
kind: task
title: "Tracker writes on hub request paths still use synchronous fs: item commits in Tracker's atomic write"
state: closed
labels:
  - hub
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: topic-35
branch: t/T-77-tracker-writes-on-hub-request-paths
created: 2026-10-09T16:57:34.637Z
updated: 2026-10-09T19:54:57.795Z
---

## Parent

Part of T-19. Found by impl-75 on 2026-10-09 at 16:57Z while working on T-75. T-75 made the permission gate, request dispatch and logging free of synchronous I/O. The tracker's item writes were left out of scope by the Coordinator's decision.

## What happened

Tracker mutations reached from hub requests (`task.create`, `task.edit`, `task.comment`, `task.close`, claims and verdicts) commit item files through the tracker's private atomic write and its write helpers, which use synchronous fs. Every comment or verdict therefore blocks the event loop for the length of a write and rename. On a slow disk, or under the load seen on 2026-10-09, that is the class of stall T-67 removed for git (A-96, class A).

## What to build

- Make the tracker's item commits asynchronous, keeping their atomicity (write to a temporary file, then rename) and their ordering per item. Two concurrent writes to one item must not lose either change.
- Keep the guarantees the merge gate relies on: a verdict is durable when the call returns (T-54, T-59).
- Extend the architecture guard from T-70 and T-75 to the tracker's write path.

## Acceptance criteria

- [ ] No synchronous fs call is reachable from a tracker mutation handled by the hub, which the guard test proves.
- [ ] Two concurrent comments on one item both land, in order, which a deferred test proves.
- [ ] A crash between the temporary write and the rename leaves the old item file intact.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M; triage before scheduling, because the tracker is the source of truth and the change touches every write. Start after T-75 merges.

## Comments

### coord · 2026-10-09T17:57:48.578Z

Added scope, from rev-6's T-75 review at 17:56Z. Launch also reaches a pre-existing `statSync(cwd)` at hub/src/adapters/sessions.ts:269, a synchronous fs call on the session.launch request path. It predates T-75 and was left out of it by the Coordinator's decision. T-77 now covers the remaining synchronous fs on hub request paths: the tracker's item writes and this launch stat. The guard test should cover both.

### coord · 2026-10-09T18:01:28.030Z

Correction to the comment above: the launch `statSync(cwd)` is in hub/src/hub/sessions.ts at line 269, not in hub/src/adapters/sessions.ts. The path is from rev-6's verdict rev-6-75-4 on T-75.

### coord · 2026-10-09T18:22:23.056Z

Second correction, checked against dev: the launch `statSync(cwd)` is at hub/src/adapters/sessions.ts:274. hub/src/hub/sessions.ts does not exist. My first comment had the right file but an older line, and my first correction was wrong. rev-6 corrected the same path on T-75.

### impl-77 · 2026-10-09T18:39:46.320Z

Starting T-77 from the claimed worktree. Test seams already specified in the brief: Tracker public mutations with deferred native file I/O, hub request native-boundary guard, and session launch. I am tracing synchronous readers as well as writes so the guard covers the complete mutation path.

### impl-77 · 2026-10-09T18:54:13.938Z

Implemented async per-item commits, async task.view/import/topic callers, shared launch stat and queued serving-time watcher reads/polling. Deferred tests cover same-item ordering, independent-item progress, comment/close/claim/verdict races, native failures, durable verdict evidence on restart, watcher/commit ordering and SIGKILL before rename. Native guard passes and fails when statSync is planted in each of tracker commit and shared launch. Typecheck passes; the full npm test suite is running. T-78/T-79 exclusions are documented.

### rev-6 · 2026-10-09T19:14:41.474Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-77-1
commit: 1f3fa0878b9496e30e36f0df699f5d7714c3c5cd

Medium — hub/src/tracker/tracker.ts:609: filename-based queue admission can split ownership after a hand rename/reindex; two queued comments then mutate the same new path concurrently, one fails with its temporary source missing, and only one comment remains.
Medium — hub/src/tracker/tracker.ts:487: watcher metadata lookup and indexing use separate resumed scopes without an intervening await; a continuous 150 ms + 150 ms stretch records slow=0. Scan dispatch at :470-474 also falls outside its construction scope.
Low — hub/src/adapters/sessions.ts:256: info.isDirectory() executes outside resumed after stat resolves; this bounded check is a timing consistency issue.

The original four regressions now pass. Atomic-failure probes, both typechecks and diff check pass. No full suite run. Standards and Spec reports, reproducible memory probes and evidence: A-167, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-167-t-77-review-rev-6-77-1-at-1f3fa08.md. Combined review covers dev (0bc116e) through 1f3fa08.

### impl-77 · 2026-10-09T19:20:24.528Z

Coordinator's global-queue revision committed separately at 9a9ae16706ea363db148dcb42bb0125670580a11 and pushed to local origin. Removed all per-item/topic queue keys; async mutations, whole import batches, serving-time watcher reads/scans/polling and views share one admission tail. Pre-rename authorization remains. Deferred rename/reindex and moved-frontmatter-ID cases pass; watcher metadata/indexing, candidate dispatch and partial-read continuations each aggregate 150+150 ms into a 300 ms slow request. Three timing regressions fail on the previous head (A-169, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-169-t-77-three-continuation-timing-regressions-fail-on-previous-head.log). Typecheck, 29 async tracker tests, 2 native guard tests, 4 import tests and 5 freshness tests pass (A-170, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-170-t-77-global-queue-targeted-checks-and-timing-regressions.log). Both internal delta reviews clear. Old full suite cancelled (exit130); npm test restarted on this head; totals pending.

### impl-77 · 2026-10-09T19:21:21.260Z

Final head f1463bb940708b737618324190de4a723b8cdb4c adds the review's low launch timing finding as its own two-line commit: isDirectory() now runs inside the existing resumed scope after stat. Typecheck, 2 native-boundary and 14 request-guard tests pass. Final targeted evidence A-172 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-172-t-77-final-targeted-checks-including-launch-timing-fix.log includes 29 async tracker, 4 import, 5 freshness and 7 verdict-commit passes. Cancelled the still-waiting suite on the earlier head and restarted npm test on this final head; machine lock pending. No merge.

### rev-6 · 2026-10-09T19:24:46.488Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-77-2
commit: f1463bb940708b737618324190de4a723b8cdb4c

No high, medium or low findings remain in the resolution delta 1f3fa08..f1463bb. The tracker-wide queue closes the filename ownership race; watcher/scan/read-loop continuation scopes and launch directory-check timing close the earlier timing findings. Read-your-writes, grant revocation, first-import reservation, moved IDs and atomic-failure probes pass; both comments survive the rename/reindex probe. Both typechecks and diff check pass. No full suite run.

Accepted known limitation — hub/src/tracker/tracker.ts:619: storage promises have no deadline, so a stalled native operation holds queued tracker work and stop (:341) indefinitely. Git's timeout, client reply deadlines and slow-answer logging do not bound it. The Coordinator accepted this outside T-77 because the previous synchronous stall blocked the entire hub event loop, while asynchronous storage leaves other hub work serving; T-103 owns stall detection/status and safe recovery that fences late writes.

Standards and Spec reports, checks and reproducible probes: A-173, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-173-t-77-resolution-review-rev-6-77-2-at-f1463bb.md.

### impl-77 · 2026-10-09T19:32:00.253Z

First full suite on f1463bb finished hub 586/588 pass, 2 fail, no cancelled/skipped, 562.43s (A-176, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-176-t-77-first-full-suite-final-head-two-obsolete-timing-assertions.log). Only failures were the obsolete merge-close and item-launch tests that treated the now-asynchronous injected write pause as synchronous blocking. Coordinator approved replacing both. Test-only commit 591650783eb0a2ba49f2a45af899d05a75d43c9e uses real close/branch-link task-event subscribers with fake guard clocks and asserts exactly one resumed 400ms slow-request. Typecheck and both targeted tests pass; both internal delta reviews clear (A-177, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-177-t-77-replacement-timing-assertions-pass-real-close-and-link-subscribers.log). Full npm test restarted on this head; implementation remains frozen.

### rev-6 · 2026-10-09T19:33:27.519Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-77-3
commit: 591650783eb0a2ba49f2a45af899d05a75d43c9e

No high, medium or low findings in the tests-only delta f1463bb..5916507. Both replacements preserve the purpose: synchronous tracker publication after real awaited Git must produce exactly one resumed slow-request. They require the real close/branch-link subscriber to run and an exact 400 ms measurement; launch retains the client assertion. No other assertion is weakened, and the worktree.list helper keeps its real-clock behavior.

Independent hub typecheck and diff check pass; A-177's two targeted passes were inspected. No suite run by this reviewer. Production remains covered by rev-6-77-2 / A-173; its accepted storage-bound limitation remains T-103.

Separate Standards and Spec reports: A-178, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-178-t-77-test-only-review-rev-6-77-3-at-5916507.md.

### impl-77 · 2026-10-09T19:54:32.297Z

Completed on 591650783eb0a2ba49f2a45af899d05a75d43c9e, pushed to local origin; worktree clean, no merge. Tracker commits/views/imports/serving-time watcher reads now use asynchronous filesystem operations and one admission queue; temporary write + rename remains atomic, verdict evidence is indexed before success, every mutation rechecks its grant before rename, and whole resumed continuations are timed. Shared Sessions launch stat and directory validation are asynchronous/measured. README documents synchronous startup/CLI/init and T-78/T-79 exclusions. Deferred ordering, rename/moved-ID races, revocation, failure, crash/durability and timing regressions pass; native guard planted-stat failures are recorded in A-165. npm run typecheck passed; final npm test exited 0: hub 588/588, Neovim 104/104, no failures/cancelled/skipped. Suite 649.86s, lock wait596.24s, peak load13.27. Full evidence A-181 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-181-t-77-full-suite-passes-588-hub-and-104-neovim-tests.log; targeted evidence A-172 and A-177. Latest review rev-6-77-3 is clear/current on this head.

### coord · 2026-10-09T19:54:47.775Z

Merged a9be9a0ac090914d0f883de332b43a4ae0a82233 onto dev.

### coord · 2026-10-09T19:54:57.795Z

Merged by the Coordinator through `cland merge T-77`: squash a9be9a0 on dev. Gate: review rev-6-77-3 clear on 5916507, after rev-6-77-1 (filename-keyed queue race, split timing) and rev-6-77-2 (clear on f1463bb, with the accepted storage-deadline limitation, now T-103). Design: one tracker-wide admission-ordered queue for mutations, imports and serving-time watcher reads. Views give read-your-writes. Every commit is an atomic temp-file write then rename, with a grant recheck before the rename. The shared launch stat is async. Full suite on 5916507: 588 hub + 104 Neovim passed (A-181). Two timing tests were replaced, because their synchronous write pause is now async I/O (5916507, reviewed). Out of scope: T-78 (merge, worktree and release reads), T-79 (adapter spawn fs), T-103 (storage deadline). Dev was pushed to match the territory before this merge, so no other session's commit was published by it. impl-77 stopped.
