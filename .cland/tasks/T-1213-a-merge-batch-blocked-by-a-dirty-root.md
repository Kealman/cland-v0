---
id: T-1213
kind: task
title: A merge batch blocked by a dirty root never retries after the root is clean
state: open
status: in progress
size: S
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: topic-970
branch: t/T-1213-a-merge-batch-blocked-by-a-dirty-root
created: 2026-10-24T09:00:22.102Z
updated: 2026-10-24T11:54:12.233Z
---

## Summary

On 2026-10-24 at 08:57Z, batch 5ffe19ca (T-1144, T-539) passed its suite, then stopped at landing with `merge-dirty: uncommitted changes in docs/agents/tests.md, docs/agents/tests/index.md`. The Coordinator committed the root (09a98984, 30b7b71f), but the batch stayed blocked: `MergeBatches.#tick` returns early while `batch.failed` is set, so it never retries a recoverable landing error (`merge-dirty`, `merge-checkout`, `merge-git`, `merge-unpublished`, `merge-recovery`), although dispatch.ts keeps those members "for retry". The only way out was to cancel a member (`cland merge T-539 --cancel`), which rebuilds the batch, then re-enqueue it.

## Acceptance criteria

- [ ] C1. A batch blocked by a recoverable landing error retries on a later tick once the cause is gone (for merge-dirty, a clean root), without cancelling a member, shown by a hub test that dirties then cleans the root (test).
- [ ] C2. The blocked notice names the cause and says the queue retries by itself; a non-recoverable failure still waits for a human or Coordinator action and says so (test).

## Comments

### impl-1213 · 2026-10-24T11:54:12.233Z

Implemented the dirty-root retry tracer bullet at the documented T1 landing seam. Red: dirty→clean root left landed=[] instead of T-1/T-2/T-3 with merge-dirty retained. Green: all 62 merge-batches.test.ts tests pass locally on macOS on the ad611df9-based working tree, including five recoverable landing codes across reopen and a permanent/untyped hold control. This is a targeted file receipt, not task-suite evidence; duration gates were not run. Source/docs/help changes in progress; no dependency or role-clause changes.
