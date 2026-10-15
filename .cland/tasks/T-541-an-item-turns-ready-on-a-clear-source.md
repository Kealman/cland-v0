---
id: T-541
kind: task
title: An item turns ready on a clear source verdict with no verify at all on record
state: open
status: backlog
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
updated: 2026-10-15T21:25:20.005Z
---

## Summary
On 2026-10-15 at 21:24:14Z, T-513 changed review → ready eight seconds after rev-30's clear delta verdict at f554be2d. `task view T-513 --json` showed `verify: null`: no suite run had ever been submitted for T-513, at any head. Under D25 and D29, a task merges only with suite evidence at its reviewed head. A ready status that rests on no suite evidence invites a merge without one. The Coordinator caught this one by hand (rule 7). Whether `cland merge` itself would refuse it is untested.

## Acceptance criteria
- [ ] C1. A task whose required suite evidence is missing at its head stays in review after a clear source verdict, and its card says the verify is pending.
- [ ] C2. `cland merge` refuses a task with no green verify at its head, naming the missing evidence, and a test covers both C1 and C2.
