---
id: T-503
kind: task
title: "merge-recovery test: the task worktree still exists right after a retried merge reports closed (Linux)"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-310
branch: t/T-503-merge-recovery-test-the-task-worktree
created: 2026-10-15T15:03:40.855Z
updated: 2026-10-15T16:57:56.755Z
---

## Problem

`hub/test/merge-recovery.test.ts:49`, 'a close write failure reports merged follow-up failure; retry closes and prunes without a second commit', failed on Linux in T-467's droplet verify 3fb93e0b (A-3087). `existsSync(work.path)` was still true after the retry merge reported a successful close: either the worktree prune finishes after the CLI returns, or a process still holding the worktree delays its removal. It's T-395's split file; the assertion is unchanged from the old merge.test.ts.

## Acceptance criteria

- [x] C1. Either the merge retry removes the worktree before it reports success, as a product fix with the reason recorded, or the test waits on an observed removal with the existing eventually helper. Every other assertion stays, and the root cause is recorded in the commit.
  - done: impl-503 · 2026-10-15T16:51:31.346Z
  - verified: rev-31 [reviewer] · run rev-20261015-503-source · 2026-10-15T16:52:15.111Z · commit 6f26ba6ff7dc8934614cb142bffcd10212f37735
- [ ] C2. merge-recovery.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-503 · 2026-10-15T16:49:07.312Z

Baseline whole-file Mac run passed 19/19 (72.68 s wall, load 14.70 with another non-coord verify active). Diagnosis: TaskMerges.#cleanup returns 'waiting for sessions' with no followUp and retries asynchronously when a session is inside/launching; merge close success does not guarantee path removal. C1 uses the existing eventually helper before the original removal assertion; all other assertions remain. Five post-fix serial whole-file runs pending.

### rev-31 · 2026-10-15T16:52:15.111Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-503-source
commit: 6f26ba6ff7dc8934614cb142bffcd10212f37735
scope: full

Source review clear at 6f26ba6ff7dc8934614cb142bffcd10212f37735. No high, medium or low findings.

## Standards
No documented-standard or baseline-smell findings. Exactly two lines added to the existing test; positive wait uses the existing eventually helper and its unchanged deadline. Original removal assertion and every other assertion remain intact. Diff check passes.

## Spec
C1 verified at hub/test/merge-recovery.test.ts:49-51: wait for the worktree path to disappear before the existing false assertion. TaskMerges.finish accepts cleanup='waiting for sessions' without followUp and #cleanup retries session-held pruning asynchronously every 500 ms; a successful close alone is not proof of completed path removal.
The test still requires one squash commit, the recovered original commit, closed state, cleared claim, one merge comment, closed topic, removed path, repeat cleanup='removed', no followUp and expected journal behavior. A permanent cleanup failure still reaches the existing eventually failure boundary.
Commit records that contract mismatch and explicitly says the original Linux delaying holder was not captured. A-3087:3997-4013 confirms the historical early existsSync assertion failure; the patch does not claim a deterministic causal reproduction of the missing holder.

C2 remains unverified: the five serial post-fix whole-file Mac runs and exact-head post-source droplet receipt are still pending. Source clear permits the later verify once the required five-run evidence is complete.
Standards: 0 findings. Spec: 0 findings. No Reviewer tests or edits.

Criteria: C1 verified.

### impl-503 · 2026-10-15T16:57:56.755Z

Post-fix Mac evidence A-3189: 5/5 serial whole-file runs at reviewed head 6f26ba6f, all 19 tests passed each. All labelled loaded; starting loads 13.56, 12.02, 13.93, 13.59, 12.89, each checked free and no local Coordinator. Typecheck passed. Initial verify fbcd2dbf was cancelled while queued because an untracked evidence log caused local fallback; moved log outside worktree, preserved in A-3189, source unchanged and tree clean. C2 awaits Linux verify.
