---
id: T-875
kind: task
title: roles-editor sandbox round-trip case (T-872) runs 0.6 s against the 0.5 s T1 budget
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - v0.1.4
assignee: null
parent: C-326
blocked_by: []
topic: topic-607
branch: t/T-875-roles-editor-sandbox-round-trip-case-t
created: 2026-10-19T13:46:45.481Z
updated: 2026-10-19T17:32:39.003Z
closed: 2026-10-19T17:32:39.003Z
---

## Summary

`hub/test/roles-editor.test.ts` "role harness round trips preserve every explicit sandbox choice", added by T-872, measured 0.599 s against the 0.5 s T1 budget in T-870's task verify (A-6068). That is report-only today, but it would fail once T1 budgets enforce.

## Acceptance criteria

- [x] C1. The case runs within the T1 budget (split it, share setup, or move it to T2 with the tier-move rule), and every assertion stays.
  - done: impl-875 · 2026-10-19T15:37:05.905Z
  - verified: rev-30 [reviewer] · run rev-20261019-875-final · 2026-10-19T15:37:36.148Z · commit 2f62d61a3595479a4b3bb96d68df92c16fca78cf

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

### impl-875 · 2026-10-19T15:37:06.529Z

C1 done at reviewed head 2f62d61a3595479a4b3bb96d68df92c16fca78cf. Mode-free same-head verify f6b999b3-7398-459f-84b6-6ea2fd52a4ea passed 429/429, no failures/skips (A-6164). Linux base case 0.118052010 s; five load repetitions all pass at 0.125649971, 0.132269906, 0.112253679, 0.155051019 and 0.172722181 s, all below T1's 0.5 s. All 156 assertions retained. Linux x64 droplet c-8 lon1, lifetime 351 s, cost $0.0244. T3 deferred to merge batch by queue protocol. Awaiting final reviewer evidence verdict.

### rev-30 · 2026-10-19T15:37:36.148Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-875-final
commit: 2f62d61a3595479a4b3bb96d68df92c16fca78cf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6166 audits full A-6164 / f6b999b3 at unchanged reviewed head. Ordinary 429/429 zero fail/cancel/skip/TODO, all 201 groups 5/5, zero tier-mismatch rows. Corrected case .118052010 s ordinary; all five repetitions .112253679–.172722181 s, each below .5 s. Source A-6149 proves all 156 assertions retained with real editor/writer path. C1 verified; T1/tier/production/allowances unchanged. T3 remains normal landing evidence; no Reviewer execution or further item run.

Criteria: C1 verified.

### coord · 2026-10-19T17:32:39.003Z

Merged 864cb2b676778b7e5069bf32b7675fd6e43b2e85 onto dev.
