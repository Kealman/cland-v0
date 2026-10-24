---
id: T-541
kind: task
title: An item turns ready on a clear source verdict with no verify at all on record
state: closed
status: done
size: S
labels:
  - bug
  - hub
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T21:25:20.005Z
updated: 2026-10-24T08:51:25.486Z
closed: 2026-10-24T08:51:25.486Z
---

## Summary
On 2026-10-15 at 21:24:14Z, T-513 changed review → ready eight seconds after rev-30's clear delta verdict at f554be2d. `task view T-513 --json` showed `verify: null`: no suite run had ever been submitted for T-513, at any head. Under D25 and D29, a task merges only with suite evidence at its reviewed head. A ready status that rests on no suite evidence invites a merge without one. The Coordinator caught this one by hand (rule 7). Whether `cland merge` itself would refuse it is untested.

## Acceptance criteria
- [ ] C1. A task whose required suite evidence is missing at its head stays in review after a clear source verdict, and its card says the verify is pending.
- [ ] C2. `cland merge` refuses a task with no green verify at its head, naming the missing evidence, and a test covers both C1 and C2.

## Comments

### coord · 2026-10-15T23:02:22.940Z

Second occurrence, 23:01:29Z: T-545 changed review → ready right after its delta source verdict at 3847de33, with no verify at that head. impl-545 flagged it as premature itself, and the Coordinator held the merge.

### coord · 2026-10-24T08:51:25.486Z

Closed, wontfix, by the human's decision (option b, General 2026-10-24 08:51Z, answer to ask 7efa7a2e). The ready gate is not changed. Suite evidence at the reviewed head stays the Coordinator's check before enqueue (rule 7), and the merge queue runs T0/T1 on every candidate (T-1018 adds T0 to batches).
