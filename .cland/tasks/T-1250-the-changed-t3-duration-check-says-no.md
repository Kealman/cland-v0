---
id: T-1250
kind: task
title: The changed-T3 duration check says 'no stanza' and then prints allowance stanzas
state: open
status: backlog
size: XS
labels:
  - bug
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
topic: null
branch: null
created: 2026-10-24T14:13:21.952Z
updated: 2026-10-25T09:53:25.637Z
---

## Summary

In T-1204's verify a3d82680 (A-11169, lines 14992–14993), the changed-T3 duration check line ends with "no stanza", and the next line prints a duration allowance stanza for `item-summary-lua.test.ts`. That suite printed three stanzas in all. The summary contradicts the output right after it. impl-1204 found this aside. The run's exit is not affected.

## Acceptance criteria

- [ ] C1. The duration-check summary states the number of allowance stanzas it prints (or none only when it prints none), consistently with the stanza lines that follow (test).
