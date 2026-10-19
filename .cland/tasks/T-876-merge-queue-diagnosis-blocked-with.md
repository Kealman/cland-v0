---
id: T-876
kind: task
title: Merge-queue diagnosis blocked with 'cannot identify batch candidate tree' building leave-one-out candidates
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - needs-triage
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-598
branch: t/T-876-merge-queue-diagnosis-blocked-with
created: 2026-10-19T13:50:17.787Z
updated: 2026-10-19T15:16:22.818Z
---

## Summary

After the red batch 467daa3f (T-842, T-666; run a36a8a02, A-6072) failed only demo files, the hub tried to build the leave-one-out candidates. It blocked the batch with "cannot identify batch candidate tree" (hub/src/hub/merge-batch-territory.ts:60). `committedTree(root, head)` returned nothing for a freshly made candidate commit, and the batch was held without any diagnostic job. The Coordinator recovered by cancelling the culpable member, T-666, after reading the failure text.

## Acceptance criteria

- [x] C1. The cause is established and recorded in the commit: why `committedTree` returned empty for a commit-tree just written. Candidate building for diagnosis then succeeds in that case, with a regression test that reproduces the empty identity.
  - done: impl-876 · 2026-10-19T14:54:04.589Z
  - verified: rev-30 [reviewer] · run rev-20261019-876-final · 2026-10-19T15:16:21.688Z · commit cf43d5e2738a659e4def7d5613665ddc8d5ae749
- [x] C2. An identity failure during diagnosis holds the batch with a notice that names the member omission being built and the git output, not a bare error.
  - done: impl-876 · 2026-10-19T14:54:05.357Z
  - verified: rev-30 [reviewer] · run rev-20261019-876-final · 2026-10-19T15:16:21.688Z · commit cf43d5e2738a659e4def7d5613665ddc8d5ae749

## Comments

### impl-876 · 2026-10-19T14:50:56.688Z

Diagnosis in progress at historical candidate hashing and durable batch-controller seams; regression will exercise a freshly written unreferenced commit while live tracker files differ. No QA brief or QA-scoped criteria; review-only policy.

### rev-30 · 2026-10-19T14:56:29.846Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-876-source
commit: cf43d5e2738a659e4def7d5613665ddc8d5ae749
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6110, findings []. Commit records git rm --cached refusing historical metadata different from HEAD/live files. --force is limited to disposable private index; real index/HEAD/worktree regression retained. Strict identity carries Git command/code/stdout/stderr and candidate SHA while cache callers retain null behavior. Omission-build failures persist an existing transactional hold with original evidence, one Coordinator notice, no blame/diagnostic admission; reopen control covers no repeat. A-6102 reports real-Git 9/9 and T1 controller 30/30, both red→green. C1/C2 done present; final verification awaits same-head mode-free gate plus qualified host native proof. No Reviewer tests or post-review dev merge.

### impl-876 · 2026-10-19T14:56:49.486Z

Source review rev-20261019-876-source clear at cf43d5e2738a659e4def7d5613665ddc8d5ae749, no findings (A-6110). Mode-free verification 36d932f1-8760-4a65-af1c-d0bdb3b9806f admitted at unchanged clean head; awaiting hub result and Reviewer final verdict.

### impl-876 · 2026-10-19T15:15:59.551Z

Same-head mode-free verification 36d932f1 passed at cf43d5e2738a659e4def7d5613665ddc8d5ae749: 1559/1559 tests, zero failures/skips (A-6135). Droplet Linux x64, lifetime 1111s, cost $0.0771. T3 deferred to merge batch under queue protocol; host real-Git targeted regression passed in A-6102. Worktree remains clean and head unchanged. Awaiting responsible Reviewer final evidence verdict.

### rev-30 · 2026-10-19T15:16:21.688Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-876-final
commit: cf43d5e2738a659e4def7d5613665ddc8d5ae749
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6136, C1/C2 verified, findings []. Exact-head mode-free 36d932f1/A-6135 full audit: ordinary 1559/1559, zero fail/cancel/skip/TODO, all 479 load groups 5/5. C2 durable omission/Git-evidence/no-blame/no-job/one-notice/reopen control passes ordinary .048846 s and 5/5. C1 native hashing cause/fix/index-preservation proof remains source A-6110 plus qualified reported host A-6102 (9/9); verification-tree T3 did not execute in this task gate, Linux proof remains landing evidence. Four inherited T-856 push trips retain c322ebda/T-877 disposition; no new T-876 trip. Done marks present; no further item run or Reviewer execution.

Criteria: C1 verified, C2 verified.
