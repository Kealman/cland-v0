---
id: T-1956
kind: task
title: A batch whose members already landed is reported "blocked" when a post-landing ps check times out, and the notice tells the Coordinator to cancel and re-enqueue the merged members
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
created: 2026-11-18T02:51:26.880Z
updated: 2026-11-18T02:51:26.880Z
---

## Summary

Batch 917ab106 (2026-11-18) landed T-1937 at 02:48:20Z (0c2540bc5) and T-1951 at 02:48:52Z (54e153e08). At 02:49:00Z the hub posted "batch 917ab106 blocked: cannot inspect the OS process table: ps failed or timed out … Coordinator: diagnose and resolve the cause, then cancel and re-enqueue each retained head: cland merge T-1937 --cancel; cland merge T-1937; …" to both item topics. Both items were already merged and the queue had moved on to the next batch. Following the notice would cancel and re-enqueue landed work. The same window also had a follow-up failure for T-1937 ("could not stop impl-1937: its process identity cannot be verified"), repaired with cland merge T-1937. The trigger was a ps timeout while the machine and hub were under load (see T-1950).

## What to build

A process-table failure after a member has landed never marks the batch blocked and never suggests cancel or re-enqueue for merged members. It is reported as a follow-up diagnostic on the landed items, with the repair command that applies (rule 39: a later ancillary failure adds a secondary diagnostic and never overwrites the outcome). A ps failure before landing keeps today's blocked behaviour, retry advice included.

## Acceptance criteria

- [ ] C1. With a fake ps that times out after every member has landed, the batch records landed outcomes, no blocked notice is posted, and the follow-up diagnostic names the repair (test).
- [ ] C2. With the same ps timeout before landing, the batch is still held as blocked with its retained heads (test).
