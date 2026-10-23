---
id: T-1184
kind: task
title: Merge queue drops a member as 'task branch changed during preparation' though its head did not move
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-23T20:54:32.079Z
updated: 2026-10-23T20:59:38.093Z
---

## Summary

On 2026-10-23 at 20:53:55Z the merge queue dropped T-1183 with `merge-changed: T-1183: task branch changed during preparation; try again`. This came right after its batch aa074d52 (T-1183 and T-1175, tree 9a505574) passed T1 in run b4fd3251, 770 of 770 tests. The task branch had not moved: local, worktree and origin all stayed at 35441486, the reviewed head, and nobody pushed. The queue then re-batched T-1175 alone, and the Coordinator re-enqueued T-1183, at the cost of one extra batch cover. Incident logged in T-204.

## What to build

Find what the landing step compares when it reports "task branch changed": the task ref against a cached head, a merge base, or the prepared candidate. Make the queue drop a member only when that member's branch head really moved, and name the old and new heads in the drop notice.

## Acceptance criteria

- [ ] C1. A batch whose members' branch heads are unchanged lands every member after a green cover. A hub test reproduces today's drop and shows it fixed (test).
- [ ] C2. A real branch move during preparation still drops that member, and the notice names the prepared head and the current head (test).

## Comments

### coord · 2026-10-23T20:59:38.093Z

Evidence: the re-enqueued T-1183 batch 452589f6 (20:59Z) produced tree 9a505574, identical to the dropped batch aa074d52's tree, and landed. So the drop at 20:53:55Z did not reflect any real change in content. Possible trigger: the Coordinator was committing tracker files to the root around 20:54Z, during the landing step.
