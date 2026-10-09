---
id: T-59
kind: task
title: "cland merge: the gate takes a task with clear verdicts onto dev as one squash commit"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: impl-59
parent: T-20
blocked_by:
  - T-53
  - T-54
topic: topic-21
branch: t/T-59-cland-merge
created: 2026-10-09T08:34:54.729Z
updated: 2026-10-09T13:31:04.939Z
---

## Parent

Part of T-20 (slice 2, ticket 4 of 12). Spec sections 4.7 and 7(a); ADR 0004.

## What to build

The Coordinator's `merge` spoke tool and `cland merge T-12`, with one `merge` frame behind both; the human may run it from their own shell. The hub runs merges one at a time under the territory lock (decision D2) and checks in order, refusing with a typed reason and moving no ref: the item is an open task with a `branch`; its latest review verdict is clear, written through the hub by a session that held Reviewer at the time and does not claim the item, and current for the branch (T-54; decisions D4, D5); with the label `qa-required` (decision D6), the same holds for QA from a session that held QA; the branch merges onto `dev` without conflicts (`git merge-tree --write-tree`), otherwise the conflicting files are named and the Implementer rebases in its worktree, since the merge never rewrites a task branch (decision D9). It then lands one commit on `dev` with `git commit-tree`: the subject is the item's title and id, and the trailers `Item:`, `Reviewed-by:` and `QA-by:` name the sessions and runs. It fast-forwards the root's `dev` checkout, refusing before anything lands when the root has uncommitted changes in the files the commit touches, and pushes `dev` to the territory. Then it comments the commit on the item and closes it (which closes its topic), releases the claim, and removes the worktree and branch, waiting while a running session stands inside (decision D10). Agents and the journal record each merge and refusal. The human's `cland merge T-12 --override "<reason>"` skips the verdict checks, never the conflict check, and records the reason on the item. No check command runs in the gate in v0; the verdicts are the gate (decision D16). The `merge` skill ships for the Coordinator, and the Coordinator's and Implementer's clauses say task work reaches `dev` only through `merge`; the skill forbids delegating a merge to a sub-agent, since a sub-agent in the Coordinator's shell is taken for the Coordinator.

## Acceptance criteria

- [ ] With a clear, current, hub-written review verdict, `cland merge T-12` adds exactly one commit on `dev`, whose tree is `dev` merged with the branch and whose message carries the title and `Item: T-12`; the root's working tree and the territory's `dev` are at that commit.
- [ ] Each of these refuses with its own reason and moves no ref: no branch; no review verdict; review not clear; a review verdict found only in the file, recorded by the Coordinator for a rescue run, written by a QA session or by the claiming session; a stale review verdict; `qa-required` without a clear, current QA verdict; conflicts with `dev`, files named; a root with uncommitted changes in the touched files.
- [ ] An Implementer, Reviewer or QA calling `merge`, through its spoke or from its shell, is refused by the permission table, and the refusal shows in Agents.
- [ ] Two merges asked for at once run one after the other, and the second lands on top of the first.
- [ ] After a merge, T-12 is closed with a comment naming the commit, its claim released, its topic closed, and its worktree and branch gone. With a running session's cwd in the worktree, the removal waits for that session to stop.
- [ ] `--override "<reason>"` from the human's shell lands a merge without verdicts and records the reason; from a session's shell it is refused.
- [ ] The `merge` skill is in `.agents/skills/merge/` and in the Coordinator's skill list in the default `roles.toml`.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` documents the gate, the commit shape and the override; spec 4.2's amendment (the hub runs the territory's commands) is recorded in the ADRs.

## Notes

Test seam: real git on disk, a temp project with a territory, task branches and worktrees; the CLI and spokes against a real hub; assertions on refs, commits, the item file, Agents and the journal, never on mocks of git. Size L. Implementer: Codex gpt-6.1-sol (deterministic git and hub logic, testable on disk). Serial with ticket 3 (the task-branches ticket): both extend the territory module.

## Comments

### coord · 2026-10-09T08:39:13.313Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/54 (a sub-issue of #20; the item is the source of truth).

### impl-59 · 2026-10-09T12:01:10.447Z

Read the spec and T-20 decisions, including the interim taskBase setting. Implementing at the agreed CLI/spoke → real hub → real Git seam, starting with a successful squash merge and then gate refusals and lifecycle cleanup.

### impl-59 · 2026-10-09T12:08:31.219Z

Milestone: the first real-hub test passes through the CLI: two task commits become one commit on dev, the root and bare territory agree, the item and topic close, and the claim/worktree/branch are removed. Real Git conflict filenames and touched-file refusals also pass; unrelated staged root edits survive. Expanding provenance, QA, permissions, serialization and deferred-removal coverage.

### impl-59 · 2026-10-09T12:17:38.894Z

Milestone: implementation committed as 46f9ff9 on t/T-59-cland-merge (no push/merge). Ten real-hub/real-Git scenarios cover successful squash, gate refusals/provenance, QA trailers, spoke/CLI permissions, override/conflicts, serialization, session-delayed cleanup, patch-preserving rebases and taskBase; a further request-budget test proves the close after awaited Git is measured as resumed. Standards and Spec review are running separately under the implement skill. Final locked full suite remains.

### impl-59 · 2026-10-09T12:25:50.811Z

Review milestone: Standards found unmeasured post-await Git-output/path processing and missing rollback after failed update-ref; Spec found a root-checkout race and configured-main freshness after a rebase. All reproduced through real Git (CLI/hub lock-file, configured-base rebase, and a real merge driver paused while the root switches). Three regressions now pass; processing is guarded, ref failures restore index/worktree, checkout/refs are rechecked before landing, and freshness follows taskBase. Both independent reviewers confirmed their findings resolved.

### rev-6 · 2026-10-09T12:35:18.929Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-59-1
commit: 7f784343a75c5069b5a0180edf35fdac1a3db0df

medium (Spec) — hub/src/hub/merge.ts:40: deleting the latest hub-written not-clear comment revives an older clear verdict even though the newer durable write remains; select the durable latest verdict per kind and refuse missing/altered matching evidence (D5).

medium (Spec) — hub/src/hub/merge.ts:75: tracker.close can fail after local and territory refs advance, but the catch reports merge-refused with the item still open and no lifecycle reconciliation; retry can land a second squash. Persist/reconcile the landed commit idempotently and distinguish post-landing incompletion from refusal.

medium (Standards) — hub/src/hub/merge.ts:63: foreground refreshFreshness performs its post-Git cache processing and tipsMoved item/event fanout outside resumed timing; a slow stretch is absent from slow-request and status counters. Time foreground refresh processing or defer its fanout off the request path.

medium (Spec, inherited dependency) — hub/src/hub/merge.ts:43: writer.role can be the role captured before Tracker.comment awaited Git, rather than the role at its durable write; revocation/handover during that await can leave reviewer provenance the gate accepts. Revalidate authoritative writer role/permissions in the synchronous verdict-writing stretch (T-54/D5).

Read-only probes using actual TrackerIndex in :memory:, Freshness, RequestGuard and TaskMerges reproduced revived clear evidence, an unmeasured 400 ms freshness callback, and two landing attempts after close failures while the item stayed open. Territory operations were in-memory collaborators; no real refs or files changed. Role timing verified from the call chain and T-54 spec. TypeScript noEmit and diff checks pass; no suite run. New merge paths use async Git/locking; existing session identity ps probes remain the accepted T-70 follow-up.

Standards and Spec evidence: A-31, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-31-t-59-review-rev-6-59-1-at-7f78434.md.

### impl-59 · 2026-10-09T12:38:50.502Z

External review fix round started; queued full suite cancelled before acquiring the lock. Reproducing A-31 findings at real Git/hub/spoke seams: deleted durable evidence, close write obstruction after landing, a timed foreground freshness fan-out, and a role change while verdict Git resolution awaits. Applying TDD and diagnosing-bugs to the reported regressions; reviewer evidence identifies the causes directly.

### impl-59 · 2026-10-09T12:50:00.057Z

Fix milestone: all four primary regressions are now green individually. Durable write order blocks deleted/altered evidence with verdict-missing; prepared landing receipts survive hub restart and retries finish the lifecycle without another commit; foreground freshness stretches are measured; verdict writes re-read identity/role and recheck permissions. Added follow-up fault coverage for release, topic closure, dirty cleanup and interrupted branch deletion. Broader targeted verification is running; final suite remains cancelled until fixes are committed.

### impl-59 · 2026-10-09T12:58:52.161Z

A-31 fix round committed as eb85884. All four requested findings are covered and fixed. Internal delta review additionally reproduced CAS-before-push restart duplication, failed error-recording propagation and deferred branch-switch cleanup hazards; those are fixed and their real Git/storage regressions pass. Tests use public event/clock/storage boundaries. Both review axes confirmed their findings resolved. Targeted runs: 46/46 broader, 10/10 recovery/fan-out, 4/4 latest close/role; typecheck/skill validation/diff check pass. Evidence A-43; final full suite requeued under the machine-wide lock.

### impl-59 · 2026-10-09T13:03:45.197Z

Final verification on eb85884: the one machine-locked full run passed npm run typecheck and npm test, with 369 hub tests + 91 Neovim tests = 460 passed, zero failures or skips. No freshness rerun was needed. Full log: A-45, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-45-t-59-locked-full-suite-log-at-eb85884.log. Commits are 46f9ff9, 7f78434 and eb85884; worktree clean, local scratch logs removed after artifact capture, no T-59 scratch hub/harness remains. Implementation/fix review evidence is A-43; external rev-6 and qa-12 are in progress. Nothing in the implementation scope is left undone; no project push or merge performed.

### qa-12 · 2026-10-09T13:04:46.248Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-59-1
commit: eb858848d6ce720b4b946c166eb5cbe76fadfa93

Verified isolated git archive eb858848d6ce720b4b946c166eb5cbe76fadfa93 with dependencies linked from T-59 and explicit Node v24.21.0. Read item, A-28/A-31 and fix summary A-43. No source fixes by QA.

Ran independently:
- npm run typecheck passed.
- node --test hub/test/merge.test.ts: 28/28 passed, zero failures/skips. Includes CAS-before-push restart without a second squash; role-at-write validation; durable evidence deletion; post-landing release/topic/cleanup recovery; foreground timing; deferred cleanup preserving a switched branch.
- Manual CLI/spoke driver against its own scratch hub under TMPDIR. Local bare stand-in GitHub only; cland init made root dev and territory HEAD=dev. Every cland command used env -u CLAND_HUB_FILE -u CLAND_SESSION_ID -u CLAND_SESSION_NAME node <export>/hub/bin/cland.ts … . A scratch Reviewer spoke wrote the clear review evidence.
- Created and claimed two tasks, each with two task-branch commits. T-1 merged as exactly one dev commit with exact item title/id, Item: T-1 and Reviewed-by session/run. Root HEAD/dev and territory dev matched. Item closed with commit comment, claim released, bound topic closed, worktree and branch absent.
- Compared every local and territory ref before/after refusals: no review, file-only review, not-clear, stale after a new commit, qa-required without QA, conflicting README.md, and touched dirty root file dirty.txt. Every refusal moved no ref and named the expected reason/files. Conflict still refused with override.
- Deleted the newer not-clear scratch comment: verdict-missing named its run, rather than reviving the older clear. Refs unchanged. Explicitly requested scratch-file tampering only; no project item files were edited.
- Reviewer merge through its spoke was forbidden; Agents showed its refusal. A shell carrying that session identity could not override. Human-shell override landed an item with no verdicts and recorded the reason.
- Two simultaneous CLI merges produced a two-commit linear stack with both files; parent order and root/territory agreement verified.
- Task list/view worked. Scratch Reviewer PID 85536 and hub PID 84815 stopped; hub socket removed and scratch Git repos removed. Final process scan found no QA-export processes. Artifact hash verified, QA export/staging removed, working tree clean.

Full-suite criterion: as directed, read impl-59's final item result and A-45 raw log instead of running another suite. Locked typecheck and npm test passed at this head: 369/369 hub + 91/91 Neovim, zero failures/skips. Merge regressions appear passing, including restart recovery and deferred branch-switch cleanup.

Findings by severity:
- High: none.
- Medium: none.
- Low: none in requested scope.

QA evidence A-47: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-47-t-59-qa-eb85884-manual-merge-gates-and-targeted-results.zip (independent driver, command/ref transcripts, Agents/journal observations, targeted/typecheck logs and cleanup). Full-suite evidence by impl-59: A-45, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-45-t-59-locked-full-suite-log-at-eb85884.log.

### rev-6 · 2026-10-09T13:09:52.838Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-59-2
commit: eb858848d6ce720b4b946c166eb5cbe76fadfa93

medium (Spec) — hub/src/hub/worktrees.ts:268 / hub/src/territory.ts:428: deferred merged-task cleanup checks the receipt's branch name but not its recorded tip; a session can commit additional work on that same branch while cleanup waits, then stop, causing automatic worktree removal and branch -D to discard its unmerged branch reference. Pass/check the expected tip before removal and delete with compare-and-swap.

medium (Spec) — hub/src/hub/merge.ts:106 / hub/src/territory.ts:508: a rejected push followed by a failed rollback update-ref leaves dev advanced, yet state.landed is still null and the caller reports merge-refused; if rollback read-tree already restored the old tree, retry publishes the recorded commit and reports success without bringing the root checkout back to that commit. Reconcile actual ref/checkout state and return the landed commit with a follow-up failure.

Standards clear. Durable missing-evidence selection, resumed freshness timing and role-at-write revalidation are fixed. The close-failure probe now returns followUp close and retries the same SHA with one landing. Actual production cleanup/Git orchestration, with in-memory mocked process/filesystem/lock boundaries, reproduced both remaining findings; no real refs/files changed. TypeScript noEmit and diff check pass; no suite run.

Separate Standards/Spec findings and executable probes: A-49, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-49-t-59-delta-review-rev-6-59-2-at-eb85884.md.

### impl-59 · 2026-10-09T13:15:44.390Z

Second fix round: both A-49 findings reproduced at the real Git/hub seam. A commit made on the task branch during deferred cleanup loses its worktree; a pre-push hook that rejects and locks dev's rollback leaves local dev advanced but returns refusal. Adding receipt-tip checks/CAS deletion and ref-based partial-landing detection with checkout reconciliation before retry completion.

### impl-59 · 2026-10-09T13:27:50.153Z

A-49 fix round: the moved-tip and failed-push/failed-rollback probes are now regression tests. Internal review also reproduced staged deletion/reversion loss on completed retries and the cleanup CAS window's invalid restoration command; both fixed with real Git regressions. Recovery records exact index snapshots durably before rollback, refuses later staged changes, and repairs checkout before publishing. Full targeted set and internal re-review are running; final locked suite follows the commit.

### impl-59 · 2026-10-09T13:31:04.939Z

Committed second review round as 3a86399 (3a8639913012845f45146cc74ec591817d48fbf0). Both A-49 findings fixed, plus internal review's completed-retry staged-edit and CAS restoration hazards. Typecheck, skill validation, 47 targeted checks and final 5 worktree checks pass. Durable evidence A-54 and A-55. Final full suite starts now under the manual machine-wide lock; external review/QA remain.
