---
id: T-1213
kind: task
title: A merge batch blocked by a dirty root never retries after the root is clean
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: topic-970
branch: t/T-1213-a-merge-batch-blocked-by-a-dirty-root
created: 2026-10-24T09:00:22.102Z
updated: 2026-10-24T12:26:03.271Z
closed: 2026-10-24T12:26:03.271Z
---

## Summary

On 2026-10-24 at 08:57Z, batch 5ffe19ca (T-1144, T-539) passed its suite, then stopped at landing with `merge-dirty: uncommitted changes in docs/agents/tests.md, docs/agents/tests/index.md`. The Coordinator committed the root (09a98984, 30b7b71f), but the batch stayed blocked: `MergeBatches.#tick` returns early while `batch.failed` is set, so it never retries a recoverable landing error (`merge-dirty`, `merge-checkout`, `merge-git`, `merge-unpublished`, `merge-recovery`), although dispatch.ts keeps those members "for retry". The only way out was to cancel a member (`cland merge T-539 --cancel`), which rebuilds the batch, then re-enqueue it.

## Acceptance criteria

- [x] C1. A batch blocked by a recoverable landing error retries on a later tick once the cause is gone (for merge-dirty, a clean root), without cancelling a member, shown by a hub test that dirties then cleans the root (test).
  - done: impl-1213 · 2026-10-24T11:56:02.976Z
  - verified: rev-23 [reviewer] · run rev-20261024-1213-final · 2026-10-24T12:14:57.477Z · commit b47a77ea46957706a4b87df4caf5b6275b7ccc27
- [x] C2. The blocked notice names the cause and says the queue retries by itself; a non-recoverable failure still waits for a human or Coordinator action and says so (test).
  - done: impl-1213 · 2026-10-24T11:56:11.941Z
  - verified: rev-23 [reviewer] · run rev-20261024-1213-final · 2026-10-24T12:14:57.477Z · commit b47a77ea46957706a4b87df4caf5b6275b7ccc27

## Comments

### impl-1213 · 2026-10-24T11:54:12.233Z

Implemented the dirty-root retry tracer bullet at the documented T1 landing seam. Red: dirty→clean root left landed=[] instead of T-1/T-2/T-3 with merge-dirty retained. Green: all 62 merge-batches.test.ts tests pass locally on macOS on the ad611df9-based working tree, including five recoverable landing codes across reopen and a permanent/untyped hold control. This is a targeted file receipt, not task-suite evidence; duration gates were not run. Source/docs/help changes in progress; no dependency or role-clause changes.

### rev-23 · 2026-10-24T12:00:21.331Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1213-source
commit: b47a77ea46957706a4b87df4caf5b6275b7ccc27
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1213 full source review — clear

Head b47a77ea46957706a4b87df4caf5b6275b7ccc27/treeecb0362cc395e5481570f6aae1b4f9e8e14b1138. First review head merges dev512c4960bb573e8df6e215de8bceb509af8e7d6a before review; direct parents5a65b873... and512c4960..., origin task ref matches. Comparison git diff512c4960...b47a77ea; seven task files. Scope full, run rev-20261024-1213-source; both axes in-session under Reviewer subagents=false, findings [].

Standards: clear. RetryLanding is internal to MergeBatches and represents only a typed MergeError thrown from the landing boundary with one of the five documented recoverable codes. Durable retryLanding is additive; failed text remains visible. Shared gate codes/authority are unchanged. Existing queue changed/member checks, active-worker protection, admitted tree/head/evidence validation and candidate rebuild checks remain before any retry landing. Successful landing clears failed/retry flags, checkpoints the completed item, and skips earlier completed/isLanded members on later ticks/reopen. Nonrecoverable typed gate refusals retain existing member-drop/rebuild handling; other held errors do not retry based on message text. No independent smell finding.

Seven new T1 identities use existing FakeClock/Suites/controller/semantic executor fixtures. Dirty/clean tracer composes real TaskMerges, Tracker and MergeQueue with immutable Git and OS receipts, writes one disposable marker file and injects typed merge-dirty at the existing Git boundary; no native Git/process/socket is added. It asserts real closed tracker items/merge receipts/FIFO landing, same suite id, no member cancellation and no landing while still dirty. Five-code controls reopen after T-1 completed, preserve the same green run/no drops, and land T-2/T-3 after obstruction clears. Untyped code-looking error stays held across reopen and carries action-required notice. Existing ownership/teardown and final assertions remain; per-test guide correctly documents new controls.

Spec: C1 source-sound. Prior early return on batch.failed now exempts only durable retryLanding set from the typed landing boundary; later ticks re-evaluate live membership and candidate/evidence before retrying. Completed members and green suite survive the new blocked-state checkpoint and restart. C2 source-sound. Blocked notice names original cause and automatic retry for these codes, otherwise human/Coordinator action. Tests check both forms and lack of false automatic-retry wording for untyped failures. README, CLI help, shared/per-test testing guidance and project-owned merge skill agree. Merge skill has no upstream origin/CHANGES contract; no new role clause/dependency/authority. Report-throw behavior identified in T-1232 remains unchanged and outside this request.

Both C1/C2 explicitly require passing tests; no verified marks from source inspection alone. A-10877 is an implementation summary: local macOS basead611df9 regression red ([] versus expectedFIFO after clean), green62/62 and seven new cases<0.5s, no duration gate. Request reports exact-head62/62 and fresh check in progress; original raw calls/output/exits/timings/source attribution requested for durable preservation without transcription reruns. These lead reports are not independently audited native configured evidence or a complete suite pass; no check wall time inferred.

Source clearance permits mode-free configured verification at exact unchangedb47a77ea, reporting result to Reviewer/lead, followed by same-head evidence review. Retain actual selection/platform/counts/gates; no full-tier claim. qaPolicy none/after-stage, no item QA brief/criteria. Reviewer performed static Git/source/docs/tracker/artifact reads only; no tests, probes, edits, install, Git mutation, browser or delegation. Standards0 findings; Spec0 findings.
Durable audit A-10895.

### impl-1213 · 2026-10-24T12:13:39.369Z

Configured same-head run d4812c41 at b47a77ea passed 2958/2958 on Linux droplet c-8 lon1 ($0.0460, 662 s lifetime): T0, all T1, fallback all hub/Neovim T2, Web; T3 deferred, no T4. Duration/lint gates report-only. All seven new T1 cases passed ordinary plus 5/5 load samples, maximum 0.397367418 s, below budget. A-10926 is native log; original local receipts A-10900. Evidence review requested. Fresh no-maintenance fetch dev=512c4960 and merge-tree conflict check exit 0, identical tree ecb0362c; reviewed head unchanged and clean.

### rev-23 · 2026-10-24T12:14:57.477Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1213-final
commit: b47a77ea46957706a4b87df4caf5b6275b7ccc27
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1213 final same-head evidence review — clear

Headb47a77ea46957706a4b87df4caf5b6275b7ccc27/treeecb0362cc395e5481570f6aae1b4f9e8e14b1138. Full source A-10895 / rev-20261024-1213-source stands unchanged. Scope evidence, run rev-20261024-1213-final; findings []; C1/C2 verified.

Configured mode-free d4812c41-f02c-4973-9815-f86ba30d2ad9 / original log A-10926 finishes exit0, agreeing with task.view exact head. Native finishes2958ordinary test passes/423file passes plus35actual load-gate test/file passes: seven new identities each five additional passing repetitions. No failures/cancellations/skips. Actual phases hostT0, allT1(137files/855top-level tests), fallback allT2hub+Neovim(242files/1768top-level tests), fullWeb44files/225top-level tests. No T3/T4 execution claimed; modefull is coverage fallback, not a whole-tier/stage cover.

C1 dirty→still-dirty→clean tracer passes0.20334625s, five repeats0.259921831–0.397367418s. It retains the real Tracker/TaskMerges/queue final FIFO merge/closed-item receipts and original green suite rather than merely counting admission. Each typed code (merge-dirty/check-out/git/unpublished/recovery) passes after reopen without replaying completed members or the green suite, with five repetitions each. Maximum among those code controls0.123533251s.

C2 named original cause and automatic retry assertions pass in all five code controls; untyped code-looking error's manual human/Coordinator-action hold across reopen passes0.027397944s plus5/5, maximum0.087251505s, with no false retry notice. Accepted source preserves boundary classification, current membership/candidate/evidence guards, checkpoints and ordinary gate-refusal behavior. No new identity exceeds0.5s; largest repeat0.397367418s. No allowance change required.

HostT0check27.142s exits0. Marker3543bae4283d54a1fc272009ecb77fc5e2359b98 is independently a Git tree, retained host gate not repeated remotely. T1/T2/Web envelopes63/339/150s differ from suite walls59.63/334.54/145.59s and shard durations59.62/245.29hub+89.21Nvim/145.49Web. FinalWeb projected150.266s at2workers is not measured Web wall at4workers.

Linuxx64 6.8.0-142-generic dropletc-8lon1 cland-v0-2630e28b, Node24.21/Nvim0.12.5, configuredworkers2/Web4, lifetime662s/$0.0460; diskfsync7.44ms/SQLite11.35ms. Lint133/60, unchanged T3ratchet2195.304s and unrelated scale/render/Web overages are report-only, including Web wall145.59s over40s/items45.835s. No clean enforcing-budget/stage-closure claim.

Original local A-10900 independently audited:14orchestration calls/16native chunks, regressionrede5e059exit1 (missingFIFO despite clean), greene2a0dfexit0; implementation working-tree62/62c7bfb6exit0; exact-head62/62d387feexit0/Node17745.46825ms and exact dirty374.225708ms with code/hold controls<0.2s. Fresh exact-headcheck6720f6exit0/zero lintrefusals. Earlier check crossed pre-review merge and remains separately attributed. No inferred end-to-end check wall time or transcription rerun.

QA none/after-stage/no item brief. T-1232 report-throw defect remains unchanged/outside scope, not certified fixed. This evidence makes the reviewed item ready for normal Coordinator merge/conflict checks; no enqueue/landing claim. Reviewer static source/Git/tracker/artifact/log reads only, no tests/probes/edits/install/Git mutation/browser/delegation. Standards0 findings; Spec0 findings.
Durable audit A-10933.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T12:26:03.271Z

Merged 827268b3400afac66e57016aaf89329766b4a053 onto dev.
