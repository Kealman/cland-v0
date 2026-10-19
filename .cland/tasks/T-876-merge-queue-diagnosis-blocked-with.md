---
id: T-876
kind: task
title: Merge-queue diagnosis blocked with 'cannot identify batch candidate tree' building leave-one-out candidates
state: open
status: in progress
size: S
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
updated: 2026-10-19T14:50:56.688Z
---

## Summary

After the red batch 467daa3f (T-842, T-666; run a36a8a02, A-6072) failed only demo files, the hub tried to build the leave-one-out candidates. It blocked the batch with "cannot identify batch candidate tree" (hub/src/hub/merge-batch-territory.ts:60). `committedTree(root, head)` returned nothing for a freshly made candidate commit, and the batch was held without any diagnostic job. The Coordinator recovered by cancelling the culpable member, T-666, after reading the failure text.

## Acceptance criteria

- [ ] C1. The cause is established and recorded in the commit: why `committedTree` returned empty for a commit-tree just written. Candidate building for diagnosis then succeeds in that case, with a regression test that reproduces the empty identity.
- [ ] C2. An identity failure during diagnosis holds the batch with a notice that names the member omission being built and the git output, not a bare error.

## Comments

### impl-876 · 2026-10-19T14:50:56.688Z

Diagnosis in progress at historical candidate hashing and durable batch-controller seams; regression will exercise a freshly written unreferenced commit while live tracker files differ. No QA brief or QA-scoped criteria; review-only policy.
