---
id: T-581
kind: task
title: 'task-worktrees timing test: "both the initial snapshot and the post-I/O snapshot must run" fails under droplet load'
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - bug
  - hub
  - flaky
assignee: null
parent: E-482
blocked_by: []
topic: topic-386
branch: t/T-581-task-worktrees-timing-test-both-the
created: 2026-10-16T07:01:00.231Z
updated: 2026-10-16T16:11:58.077Z
---

## Summary
In T-470's droplet run 0b939cc1 at 311933f1 (A-3815, lines 4490–4495), hub/test/task-worktrees.test.ts:379, in the case "worktree.list: its work after the Git reads is timed as phase resumed (a slow one is logged once)", failed: "both the initial snapshot and the post-I/O snapshot must run". T-470 doesn't touch worktrees. The file passed 9/9 alone on dev ac20175b on the Mac.

## Acceptance criteria
- [x] C1. Find why one of the two snapshots doesn't run under load (a timer or ordering assumption), fix the test or the timing seam, and record the cause on this item.
  - done: impl-581 · 2026-10-16T16:02:57.201Z
  - verified: rev-30 [reviewer] · run rev-20261016-581-source · 2026-10-16T16:07:14.504Z · commit a14eced08b961307d2721ee4714e60c8b6ee3af7
  - verified: rev-30 [reviewer] · run rev-20261016-581-final · 2026-10-16T16:11:57.064Z · commit a14eced08b961307d2721ee4714e60c8b6ee3af7
- [x] C2. task-worktrees.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet.
  - done: impl-581 · 2026-10-16T16:11:37.492Z
  - verified: rev-30 [reviewer] · run rev-20261016-581-final · 2026-10-16T16:11:57.064Z · commit a14eced08b961307d2721ee4714e60c8b6ee3af7

## Comments

### coord · 2026-10-16T13:57:35.472Z

Recurred in the v0.1.3 macOS release run 1ed3dbd6 at 098e6f5a (A-3922, darwin arm64, peak load 15.5): task-worktrees.test.ts:356 "worktree.list: its work after the Git reads is timed as phase resumed (a slow one is logged once)", with "both the initial snapshot and the post-I/O snapshot must run" 3 !== 2. Flaky-rule resubmit c7e3ba4e.

### impl-581 · 2026-10-16T16:01:22.873Z

Reproduced the reported 3 !== 2 deterministically by delaying Tracker.viewAsync 350 ms during worktree.list and scheduling InboxBoard.refresh(). Stack traces show the third call is InboxBoard's 250 ms publication timer → list() → Dispatcher.useSessions callback → the test's shared sessionsList stub, not a third TaskWorktrees snapshot. Dispatcher also has a setImmediate process/hold projection using the same stub. The global counter/one-shot 400 ms injection therefore measures unrelated consumers and can charge the wrong caller under load. Fix will scope both to synchronous worktree.list resumed measurements using the existing RequestGuard injection seam; keep exact two snapshots and the single resumed slow-request assertions.

### impl-581 · 2026-10-16T16:06:10.089Z

Head a14eced08b961307d2721ee4714e60c8b6ee3af7 pushed to origin. npm run typecheck at that committed head: exit 0. Mac whole-file node --test hub/test/task-worktrees.test.ts passed 10/10 serial invocations, each 9/9 tests (90 passing tests, zero failed/skipped). Run 1: 21763.722125 ms; runs 2–10 retained as artifact. No new or renamed tests, no duration allowance needed. C1 cause/red-green proof: A-3959. C2 awaits once-on-droplet verification after source review. qaPolicy is none/after-stage; no per-item QA requested.

### rev-30 · 2026-10-16T16:07:14.504Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-581-source
commit: a14eced08b961307d2721ee4714e60c8b6ee3af7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-581 source review

Commit a14eced08b961307d2721ee4714e60c8b6ee3af7; fixed point e335c91349288ea6a0762003d6fce99a77241050. Local and origin task tips agree. Single test-only change in hub/test/task-worktrees.test.ts (22 insertions, 3 deletions). Both review axes performed in-session because this role disables delegation.

## Standards
No findings. The test uses the existing RequestGuard injection seam and delegates to the bound real measure method. The synchronous scope flag is restored in finally and preserves an enclosing scope. No new timer, production seam, allowance, test identity or process lifecycle behavior is introduced. Existing cleanup remains intact; diff whitespace check passes.

## Spec
C1 established. The original shared sessions.list stub counted unrelated consumers while worktree.list awaited item/path I/O. Dispatcher.useSessions wires that same method into InboxBoard; InboxBoard's coalesced publication calls list after 250 ms. The item's recorded 3-versus-2 failure and A-3959's controlled delay/stack reproduction are consistent with these call paths. The issue is an extra unrelated read, rather than a missing worktree snapshot.

The revised counter and one-shot synthetic 400 ms charge apply only inside this client's synchronous resumed worktree.list measurements. RequestGuard.measure executes the callback synchronously; its scope ends before awaiting downstream I/O. TaskWorktrees.#observe still obtains sessions in both its initial and final resumed callbacks. The test wraps tracker.viewAsync and calls real inbox.list after its await, deterministically inserting the unrelated read between those callbacks. A-3959 reports that removing the scope filter makes this regression red, while restoring it passes.

All original assertions remain: successful response and T-1 listing; exactly two snapshots; exactly one slow-request with resumed/list-ui identity; elapsed measurement at least 400 ms. The original session.launch timing test shares the explicitly injected guard without losing its clock/log configuration.

## Evidence and criteria
A-3959 records diagnosis, controlled red→green, and committed-head typecheck exit 0. Independently parsed A-3964: runs 2–10 each contain 9 tests, 9 pass, zero failure/cancellation/skip (81 total passes). Run 1's 9/9 and 21763.722125 ms are reported in the item comment, rather than a raw receipt in those artifacts. Claimant reports ten serial whole-file Mac invocations; C2 remains unverified until that complete sequence and the pending same-head droplet whole-file result are established in final evidence review.

Source clear, C1 verified; C2 pending. Standards 0 findings; Spec 0 findings. No Reviewer tests, edits or compiler execution.
Artifact: A-3965 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3965-t-581-source-clear-isolate-worktree-snapshots-from-inbox-reads.md

Criteria: C1 verified.

### impl-581 · 2026-10-16T16:11:37.867Z

C2 complete at reviewed a14eced08b961307d2721ee4714e60c8b6ee3af7: Mac whole-file 10/10 serial runs (90/90 tests, A-3964+A-3966); local selected verification 7d03c721 exit 0, 43/43 (A-3969); explicit droplet selected verification 6c022d9e exit 0, 43/43 including task-worktrees whole file (A-3978). Droplet linux x64, c-8 lon1, lifetime 131 s, cost $0.0091. No source changes after review.

### rev-30 · 2026-10-16T16:11:57.064Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-581-final
commit: a14eced08b961307d2721ee4714e60c8b6ee3af7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-581 final evidence review

Commit a14eced08b961307d2721ee4714e60c8b6ee3af7, unchanged from source clear rev-20261016-581-source / A-3965. Origin task tip agrees.

## Standards
No findings. No source delta. Synchronous request attribution, exact snapshot count, once-only resumed slow log and ≥400 ms assertion remain covered by source review.

## Spec
C2 complete. Independently parsed A-3966 raw run 1 and A-3964 raw runs 2–10: each Mac whole-file invocation passes all nine cases with zero failures, cancellations or skips; total 90/90. A-3966 explicitly labels run 1 as beginning before commit with the same source tree, rather than claiming its execution began after commit. Its 21763.722125 ms summary agrees with the prior item report.

Required post-source-review Linux droplet 6c022d9e-b97c-411b-abe0-39660c1198e0 / A-3978 names the exact reviewed commit. Selected hub phase passes 31/31, including all nine task-worktrees cases; the changed timing case passes in 366.367465 ms of real wall time while retaining its synthetic-clock ≥400 ms assertion. Neovim smoke passes 12/12. Overall exit 0, 43/43, no skips or failures. Host and remote typechecks complete. Actual remote execution bypasses the earlier local green cache. Receipt records Linux x64, c-8 lon1, four workers, peak load 4.41, suite wall 57.70 seconds, lifetime 131 seconds, cost $0.0091.

Earlier local same-head 7d03c721/A-3969 is supplemental; it does not substitute for the droplet requirement. Known-entry duration notices do not fail either receipt. No forced repetitions are needed for this unchanged existing test identity.

C1 remains source verified; C2 now execution verified. Claimant's delivered report d6c24d35 states C2 done was recorded after the final item read. Final clear, no further task run required. Standards 0 findings; Spec 0 findings.
Artifact: A-3980 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3980-t-581-final-clear-90-mac-passes-and-exact-head-linux-green.md

Criteria: C1 verified, C2 verified.
