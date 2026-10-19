---
id: T-875
kind: task
title: roles-editor sandbox round-trip case (T-872) runs 0.6 s against the 0.5 s T1 budget
state: open
status: backlog
size: XS
labels:
  - v0.1.4
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-19T13:46:45.481Z
updated: 2026-10-19T14:49:53.568Z
---

## Summary

`hub/test/roles-editor.test.ts` "role harness round trips preserve every explicit sandbox choice", added by T-872, measured 0.599 s against the 0.5 s T1 budget in T-870's task verify (A-6068). That is report-only today, but it would fail once T1 budgets enforce.

## Acceptance criteria

- [ ] C1. The case runs within the T1 budget (split it, share setup, or move it to T2 with the tier-move rule), and every assertion stays.
