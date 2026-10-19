---
id: T-875
kind: task
title: roles-editor sandbox round-trip case (T-872) runs 0.6 s against the 0.5 s T1 budget
state: open
status: review
size: XS
labels:
  - v0.1.4
assignee: null
parent: C-326
blocked_by: []
topic: topic-607
branch: t/T-875-roles-editor-sandbox-round-trip-case-t
created: 2026-10-19T13:46:45.481Z
updated: 2026-10-19T15:30:09.348Z
---

## Summary

`hub/test/roles-editor.test.ts` "role harness round trips preserve every explicit sandbox choice", added by T-872, measured 0.599 s against the 0.5 s T1 budget in T-870's task verify (A-6068). That is report-only today, but it would fail once T1 budgets enforce.

## Acceptance criteria

- [ ] C1. The case runs within the T1 budget (split it, share setup, or move it to T2 with the tier-move rule), and every assertion stays.

## Comments

### impl-875 · 2026-10-19T15:28:43.835Z

Implementation plan: keep this editor contract at T1, retain all sandbox/role/harness permutations and exact saved-key/comment assertions, reduce fixture overhead, then report targeted timings and obtain source review before mode-free verification.

### rev-30 · 2026-10-19T15:30:09.348Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-875-source
commit: 2f62d61a3595479a4b3bb96d68df92c16fca78cf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6149. Only fixture construction changes to six launch tables derived from shipped-template role names. All loops and 156 returned/reopened/key-comment assertions remain unchanged, real public editor/atomic writer path retained, adjacent full-template default proof untouched. No production/tier/allowance/process/timer change. A-6148 reports local 13/13, case .084 s/file .272 s and typecheck green. C1 assertion preservation established by source; complete C1 remains unverified pending exact-head mode-free gate and corrected Linux case timing under .5 s. No Reviewer execution.
