---
id: T-59
kind: task
title: "cland merge: the gate takes a task with clear verdicts onto dev as one squash commit"
state: closed
status: done
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
updated: 2026-10-10T00:58:17.681Z
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

### impl-59 · 2026-10-09T13:37:18.893Z

Final validation at 3a8639913012845f45146cc74ec591817d48fbf0: one full suite under the manual machine lock passed 376 hub + 91 Neovim = 467 tests, zero failures/skips (A-57 durable log). Typecheck, merge skill validation and targeted 47/47 passed. Manual lock released; two orphan init/adapter bridge clients from the suite stopped (34845, 49961), final process scan has no T-59 hub/bin test processes, scratch logs removed and branch clean. Implementer work complete; external review/QA and Coordinator landing remain.

### qa-12 · 2026-10-09T13:38:08.666Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-59-2
commit: 3a8639913012845f45146cc74ec591817d48fbf0

Delta QA after qa-12-59-1: isolated git archive 3a86399, node_modules linked from T-59, Node24.21.0. No product changes.

Ran:
- npm run typecheck: pass.
- node --test hub/test/merge.test.ts:34/34, zero failures/skips (178.69s).
- Independent scratch project with own real hub, reviewer spoke, fake Claude session and actual CLI/Git: cland task list/view; normal reviewed merge lands exactly one commit with root/territory agreement; review-missing refusal leaves every local/territory ref unchanged.
- Commit after landing while cleanup waits for session: stopped session, observed journal 'branch moved since merge (...), kept'; new branch SHA/worktree/file contents survive, dev stays at original landing.
- Territory pre-receive hook rejects push and creates local dev.lock: CLI returns landed commit e6cb851adcdc8d2e86f435c22b29c78d543c7102 with followUp rollback, rollback failed/publish pending; local dev advanced, territory/index/root tree remain at prior state. Removed only injected hook/lock; retry returns same SHA, exactly one item commit, territory/local HEAD/dev/index/worktree consistent, item closed and task worktree removed.
- Stopped scratch hub13596, reviewer15678 and fake session; removed scratch. Post-test scan has zero QA-export processes.
- Full criterion delegated by request to impl-59: inspected A-57 log,376/376 hub+91/91 Neovim=467 passes, zero failures/skips; implementation reports exit0/manual lock released. No duplicate full run.

Findings by severity: high none; medium none; low none in the T-59 delta. Known baseline note: this branch predates T-69 cleanup; implementation full suite left two init/adapter bridge clients34845/49961. impl-59 stopped them; QA independently confirmed both PIDs absent. Those were not from the new merge probes.

Evidence A-58: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-58-t-59-qa-3a86399-moved-branch-and-failed-rollback-recovery.zip (runnable manual driver, command outputs, assertions, journal, test logs and cleanup). Interim A-56; full suite A-57.

### rev-6 · 2026-10-09T13:38:58.208Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-59-3
commit: 3a8639913012845f45146cc74ec591817d48fbf0

medium (Spec) — hub/src/territory.ts:529: the post-read-tree write-tree runs before the rollback try; an index.lock failure leaves the prepared merge in the root index/worktree while both refs remain at the old base, reports merge-refused, and persists no checkout recovery snapshot. Protect the mutating checkout and subsequent index capture with snapshot restoration so this pre-ref failure leaves a usable root checkout.

Both A-49 findings are fixed. Moved-tip cleanup keeps the branch/worktree; a lost deletion CAS restores the worktree; failed rollback returns the landed commit with follow-up; retry repairs the checkout before publishing. Changed staged work is refused and preserved, and completed retries preserve staged deletion/reversion. Standards clear.

Reran A-49 probes and the two added hazard probes using actual production orchestration with in-memory process/filesystem/lock boundaries; no real refs/files changed, no suite. TypeScript noEmit and diff check pass. Separate review axes and executable evidence: A-59, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-59-t-59-second-delta-review-rev-6-59-3-at-3a86399.md.

### impl-59 · 2026-10-09T13:42:49.003Z

Third review round: reproduced the post-checkout write-tree/index.lock failure. Before the fix, merge refused with unchanged refs but left the prepared index/root file in place. Moving the whole mutation into one protected section; recovery snapshots will be persisted before read-tree, and blocked restoration will return an explicit merge-recovery receipt rather than a refusal. Targeted checks only per Coordinator.

### impl-59 · 2026-10-09T13:50:21.065Z

Third round's real Git index-lock regression passes for both adding a task file and changing tracked README, checking staged tree identity, exact working-file bytes, unchanged porcelain status and refs. Persistent lock returns merge-recovery with a durable prepared commit/base and survives restart. Crash-before-CAS test also passes; the receipt remains live until successful ref movement. Internal Standards/Spec re-review has zero unresolved findings. Final targeted set underway; no full suite in this round.

### impl-59 · 2026-10-09T13:54:10.333Z

Third fix round committed as e686076b2237e33d9d7f809f6d9ffb6ffb0e6148 (e686076). Protected all checkout mutations; recorded snapshots before read-tree and retained them through CAS; blocked prelanding restore reports merge-recovery with durable receipt, and retry restores before rechecking the gate. Added semantic restoration, persistent-lock, crash-before-CAS and later-staging retry regressions. Final targeted 52/52 and focused 6/6 pass (A-62/A-63); typecheck and skill validation pass. A-64 records changes and zero unresolved internal review findings. No full suite this round per Coordinator; last full suite A-57 was at 3a86399. Scratch removed, test bridge 60145 stopped, final process scan and git status clean.

### impl-59 · 2026-10-09T13:54:18.277Z

Artifact correction to the preceding milestone: third-round changes/review note is A-65 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-65-t-59-third-fix-round-at-e686076.md), not A-64. Test logs remain A-62 and A-63.

### rev-6 · 2026-10-09T14:00:25.244Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-59-4
commit: e686076b2237e33d9d7f809f6d9ffb6ffb0e6148

No high or medium findings remain. A-59's post-checkout write-tree failure is fixed: snapshots precede mutation and survive through CAS; transient failure restores before refusal; blocked prelanding restoration retains a receipt and reports merge-recovery/pending; retry restores before rechecking current verdicts.

low (Standards/interface completeness) — hub/src/spoke/hub-client.ts:356 / hub/src/spoke/spoke.ts:355: HubClient/Refused drops the new recovery {commit, base} field before the MCP error serializer; forward it through both layers. The code and descriptive error still expose the prepared SHA/base, so this is non-blocking.

Spec clear. Reran the A-59 production-orchestration probe with actual SQLite :memory: receipts and in-memory process/filesystem/lock boundaries: transient restore, persistent recovery, a new merge-service instance, refusal after a newly not-clear verdict, and eventual landing all pass. Inspected the added/modified-file semantic equality and crash-before-CAS real-Git regressions; no suite run. TypeScript noEmit and diff check pass; working tree clean; no file/ref changes.

Separate review axes and executable probe: A-68, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-68-t-59-third-delta-review-rev-6-59-4-at-e686076.md.

### qa-12 · 2026-10-09T14:02:50.849Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-59-3
commit: e686076b2237e33d9d7f809f6d9ffb6ffb0e6148

Third-delta QA on isolated git archive e686076, T-59 node_modules, Node24.21.0. Read item/A-65; no product changes.

Ran npm run typecheck (pass), node --test hub/test/merge.test.ts (39/39,0fail/skips,149.84s), plus independent own-hub CLI/Git probes and cland task list/view.

Manual results:
- Normal reviewed merge lands exactly one commit with root/territory agreement.
- Real Git wrapper holds root index.lock at the post-checkout write-tree, releasing after the failed command. Merge refuses; exact write-tree ID700fc362da5af7cc2b4091bbc6c09f343db6c3a6, porcelain status, all refs and README/staged-local/untracked-file bytes match before. Git trace confirms actual write-tree failed with lock present; no mocked Git output.
- Persistent index.lock produces distinct merge-recovery naming prepared ea20033752df420dc8ce288f72d81e378854d92a and checkout recovery pending, with refs unchanged.
- While recovery is pending, real reviewer spoke writes newer not-clear verdict. Remove lock, retry: checkout restores to exact original tree/status/bytes, prepared file disappears, gate refuses review-not-clear. This verifies gate rechecking rather than blindly finishing the preparation.
- Fresh clear review, retry: exactly one commit605256530def9bcc8875b533993f56e2967437f0 lands; local HEAD/dev and territory agree; unrelated staged/untracked contents survive.
- Own scratch hub2572/reviewer3069 stopped, scratch removed; final QA-export process scan empty.

Findings by severity: high none; medium none; low none.

No full suite this round, per Coordinator decision. Last full A-57 covered previous3a86399,467passes; not claimed as final-head full validation.

Evidence A-71: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-71-t-59-qa-e686076-index-lock-restoration-and-gate-recheck.zip (runnable wrapper/CLI probe, exact snapshots, Git trace, journal, test logs and cleanup). Interim A-69.

### impl-59 · 2026-10-09T14:04:22.713Z

Coordinator requested merging main forward after clear review/QA at e686076. Merged main bf4a674 once; only tracker.ts imports conflicted. Resolution keeps MergeError/MergeReceipt and adds TipSchedule to Freshness import. T-72 scheduleTips constructor wiring, T-59 durable mergeVerdicts selection, async cache annotations and role/permission reread inside the timed verdict write are retained. Typecheck passes. Targeted merge checks then one plain npm test through T-69's own lock follow before the merge commit.

### impl-59 · 2026-10-09T14:15:52.956Z

Merged main bf4a674 once into T-59, commit read back as 32271ab1bbd9e8e35e19966aacd228a51dbe5974. The only conflict was tracker.ts imports: retained MergeError/MergeReceipt and T-72 TipSchedule. Scheduler option/wiring, durable verdict selection and timed role/permission re-read all remain. Typecheck and targeted merge tests 39/39 pass (A-74). One plain npm test through T-69's own lock passed 408 hub + 91 Neovim = 499 tests, zero failures/skips (A-77). Resolution note A-78. Scratch removed, worktree clean and no T-59 test processes remain. No push or landing; resolution-only external review remains.

### rev-6 · 2026-10-09T14:19:16.179Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-59-5
commit: 32271ab1bbd9e8e35e19966aacd228a51dbe5974

High: none. Medium: none. Low: no new findings in the resolution scope; the prior non-blocking recovery-metadata forwarding note is unchanged.

The tracker resolution preserves both parents. Relative to e686076, its only additions are T-72's TipSchedule import, scheduleTips constructor option and forwarding to Freshness, matching the main-side diff. Relative to bf4a674, T-59's MergeError/MergeReceipt, configured-base freshness, durable verdict selection, receipt/lifecycle handling and authoritative role reread inside the timed verdict write remain intact.

Standards and Spec both clear. Read task body/criteria and earlier verdicts; compared the requested parent diffs and reverse-parent diff. Diff check passes. Inspected A-77 raw evidence: 408 hub + 91 Neovim passes, zero failures/skips; no suite rerun or file/ref mutations.

Separate review axes: A-81, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-81-t-59-resolution-review-rev-6-59-5-at-32271ab.md.

### coord · 2026-10-09T14:26:56.275Z

Merged into main as a13ae98 (`git merge --no-ff`, by the Coordinator) at 14:19Z. This was one of the last task merges done by hand, because this item is `cland merge` itself. Suite on main a13ae98: typecheck clean, hub 421/421, Neovim 91/91, 0 skipped, peak load 9.62.
Verdicts:
- Review: rev-6-59-1 to -4 were not clear. They covered deleted evidence reviving an older clear verdict, a failure after landing reported as refused, untimed freshness work, the role at write time, cleanup deleting a moved branch, a push rejection with a failed rollback, and checkout steps outside the rollback. rev-6-59-4 is clear on e686076, and rev-6-59-5 clears the forward-merge resolution 32271ab.
- QA: qa-12-59-1 on eb85884, -2 on 3a86399 and -3 on e686076, all clear, with live refusals, recovery cases and stacked merges.
What it does:
- `cland merge T-n`, the Coordinator's `merge` spoke tool and the human's shell with `--override` all lead to one `merge` frame.
- The gate selects verdicts by hub-recorded provenance, written by the role at write time, current and not by the claimer; an unknown freshness counts as not current.
- It lands one `commit-tree` squash on the task base, with `Item:`, `Reviewed-by:` and `QA-by:` trailers.
- Recovery receipts make every failure after landing finish idempotently.
- Cleanup removes the worktree and branch only if the branch tip still matches.
- The `merge` skill ships in .agents/skills/merge/.
One low is left open from rev-6-59-4: the structured recovery details `{commit, base}` are dropped before MCP serialization, though the error text still carries them. It is a follow-up.
Next: the hub restart that makes it live, then the end of the D15 interim on this repository. Implementer: impl-59 (Codex), launched 12:00Z. GitHub mirror #54.
