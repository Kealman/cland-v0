---
id: T-1184
kind: task
title: Merge queue drops a member as 'task branch changed during preparation' though its head did not move
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: topic-931
branch: t/T-1184-merge-queue-drops-a-member-as-task
created: 2026-10-23T20:54:32.079Z
updated: 2026-10-24T07:36:31.954Z
---

## Summary

On 2026-10-23 at 20:53:55Z the merge queue dropped T-1183 with `merge-changed: T-1183: task branch changed during preparation; try again`. This came right after its batch aa074d52 (T-1183 and T-1175, tree 9a505574) passed T1 in run b4fd3251, 770 of 770 tests. The task branch had not moved: local, worktree and origin all stayed at 35441486, the reviewed head, and nobody pushed. The queue then re-batched T-1175 alone, and the Coordinator re-enqueued T-1183, at the cost of one extra batch cover. Incident logged in T-204.

## What to build

Find what the landing step compares when it reports "task branch changed": the task ref against a cached head, a merge base, or the prepared candidate. Make the queue drop a member only when that member's branch head really moved, and name the old and new heads in the drop notice.

## Acceptance criteria

- [x] C1. A batch whose members' branch heads are unchanged lands every member after a green cover. A hub test reproduces today's drop and shows it fixed (test).
  - done: impl-1184 · 2026-10-24T07:31:33.463Z
- [x] C2. A real branch move during preparation still drops that member, and the notice names the prepared head and the current head (test).
  - done: impl-1184 · 2026-10-24T07:31:33.632Z

## Comments

### coord · 2026-10-23T20:59:38.093Z

Evidence: the re-enqueued T-1183 batch 452589f6 (20:59Z) produced tree 9a505574, identical to the dropped batch aa074d52's tree, and landed. So the drop at 20:53:55Z did not reflect any real change in content. Possible trigger: the Coordinator was committing tracker files to the root around 20:54Z, during the landing step.

### impl-1184 · 2026-10-24T07:24:08.137Z

Red reproduction at working tree based on 785c98 (see git head in final evidence): node --import ./hub/test/cover-quiet.ts --test --test-name-pattern='three unchanged queued heads' hub/test/merge-batches.test.ts. macOS local targeted T1: stable control passes; dev-movement case fails with actual drop `T-1: merge-changed: T-1: task branch changed during preparation; try again`. Fixture keeps every task head unchanged and advances only dev after squash captures its parent. Ranked predictions: (1) cached integration-base mismatch shares task-change refusal, so distinguishing it should retain membership; (2) task-tip cache staleness would also break stable control/direct resolved task read; (3) verdict-base selection change would require a changed base name, which this fixture holds at dev. Existing dispatcher already treats `batch base moved` as BatchRebuild.

### impl-1184 · 2026-10-24T07:32:28.948Z

Implementation committed/pushed at 8c70afcbd5804f17d3d3df5c495881aaf01cbc25 (tree dfe5dfb8d13d6b485aa5332bf25434629b6dbfe9). Root cause: combined cached task/base guard misclassified dev movement as task movement; the native final-ref guard had the same ambiguity. Base-only movement now retains membership via BatchRebuild and revalidates candidate evidence. Real task-head changes retain their refusal with prepared/current SHAs (deleted refs: missing). A-10380 contains diagnosis and evidence. macOS arm64 local targeted results: merge-batches T1 39/39 (5.770s), merge-queue-unit T1 6/6 (0.446s), merge-queue T2 12/12 (2.182s), test-docs T1 2/2 (0.320s), merge-checkout T3 at committed head 9/9 including nested tests (26.707s). npm run check passed, test lint report-only/0 refusals; these targeted runs are not full task verification. C1/C2 done; origin/dev fetched and merged (already up to date); no per-item QA required. Correction: red-reproduction base was d9ffa830, not the mistaken hash in my first comment.

### rev-31 · 2026-10-24T07:36:31.954Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1184-source
commit: 8c70afcbd5804f17d3d3df5c495881aaf01cbc25
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 8c70afcbd5804f17d3d3df5c495881aaf01cbc25 (tree dfe5dfb8d13d6b485aa5332bf25434629b6dbfe9), reviewed against d9ffa830. A-10390 records Standards/Spec audit and evidence limits. Integration-base-only races retain membership through BatchRebuild and current-candidate revalidation; real task-head changes retain member-specific refusal and prepared/current diagnostics. Native final-ref safety, code-change rerun policy, sealed fixture lifetimes and matching docs remain covered. No findings. C1/C2 final runtime evidence remains pending configured mode-free exact-head verification; targeted local receipts are supporting evidence only. Reviewer executed no tests; no stage QA/T3 full-suite/Linux pass claimed.
