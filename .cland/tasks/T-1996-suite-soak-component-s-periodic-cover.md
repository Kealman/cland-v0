---
id: T-1996
kind: task
title: suite-soak-component's periodic cover ancestry case still runs native Git in T2
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-19T03:24:57.656Z
updated: 2026-11-19T03:24:57.656Z
---

## Summary

`hub/test/suite-soak-component.test.ts` still contains the T2 case "periodic cover ancestry requires a positive native Git descendant receipt", which runs native Git. Native Git belongs in T3, as T-1652's review found for the bundle cases it moved (2026-11-19, impl-1652).

## What to build

Move this case to a T3 file with whole-caller ownership and native close joins, as T-1652 did for the bundle cases, or replace its native Git with a fake at the boundary and keep it in T2. Either way, the T2 file reaches no native Git.

## Acceptance criteria

- [ ] C1. No case in suite-soak-component.test.ts runs native Git; the ancestry case runs in T3, or fake-only in T2 with a positively controlled launch guard (test).
- [ ] C2. The case's assertions are unchanged, and its tier history is recorded so no T2 proof is reused for T3 (rule 41).
