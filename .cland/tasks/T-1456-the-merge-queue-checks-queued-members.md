---
id: T-1456
kind: task
title: The merge queue checks queued members against each other at enqueue
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1227
branch: t/T-1456-the-merge-queue-checks-queued-members
created: 2026-10-30T05:44:57.388Z
updated: 2026-10-30T10:22:52.534Z
---

## Summary

At enqueue, the queue runs merge-tree against already queued heads, and a drop notice names the conflicting member instead of saying "rebase on dev". Source: coord 2026-10-24 (T-1018 vs T-542). Rule batch 4 C4 (A-14151).

## Acceptance criteria

- [x] C1. Enqueueing a branch that conflicts with a queued member is refused at once, naming that member and the files.
  - done: impl-1456 · 2026-10-30T10:21:22.440Z

## Comments

### impl-1456 · 2026-10-30T10:18:47.582Z

Consumer audit (rule 20): merge admission TaskMerges.merge -> MergeQueue candidate/enqueue; territory squashTask and prepareMergeBatch conflict handling; MergeError merge-conflict serialized by dispatcher to CLI merge, MCP merge, web/nvim generic tool errors. MergeQueueEntry/store/wire snapshots stay unchanged, including legacy clients. Tests: merge-policy (T3 native admission), merge-queue (T2 frames), merge-queue-unit and merge-batches (T1), merge-checkout (T3), merge.test/merge-recovery and CLI usage tests; T4 guards do not parse conflict text. Docs/skills: CLI MERGE_USAGE, hub README queue section, docs/agents/tests queue section and per-file guide, merge skill. QA E-678 audits queue/budget and E-617 docs; neither depends on exact rebase text. New refusal retains merge-conflict + optional files shape. Proposed native frame regression extends existing merge-policy seam.
