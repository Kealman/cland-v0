---
id: T-1213
kind: task
title: A merge batch blocked by a dirty root never retries after the root is clean
state: open
status: backlog
size: S
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: null
branch: null
created: 2026-10-24T09:00:22.102Z
updated: 2026-10-24T09:00:22.102Z
---

## Summary

On 2026-10-24 at 08:57Z, batch 5ffe19ca (T-1144, T-539) passed its suite, then stopped at landing with `merge-dirty: uncommitted changes in docs/agents/tests.md, docs/agents/tests/index.md`. The Coordinator committed the root (09a98984, 30b7b71f), but the batch stayed blocked: `MergeBatches.#tick` returns early while `batch.failed` is set, so it never retries a recoverable landing error (`merge-dirty`, `merge-checkout`, `merge-git`, `merge-unpublished`, `merge-recovery`), although dispatch.ts keeps those members "for retry". The only way out was to cancel a member (`cland merge T-539 --cancel`), which rebuilds the batch, then re-enqueue it.

## Acceptance criteria

- [ ] C1. A batch blocked by a recoverable landing error retries on a later tick once the cause is gone (for merge-dirty, a clean root), without cancelling a member, shown by a hub test that dirties then cleans the root (test).
- [ ] C2. The blocked notice names the cause and says the queue retries by itself; a non-recoverable failure still waits for a human or Coordinator action and says so (test).
