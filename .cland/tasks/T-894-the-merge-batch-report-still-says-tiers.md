---
id: T-894
kind: task
title: The merge-batch report still says 'tiers T1, T3' when the batch runs T1 only
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: topic-632
branch: t/T-894-the-merge-batch-report-still-says-tiers
created: 2026-10-19T19:12:39.490Z
updated: 2026-10-19T19:53:32.382Z
closed: 2026-10-19T19:53:32.382Z
---

## Summary

Since T-886 and restart #20, merge batches run T1 only (batch 1311a8f8 ran 475 T1 tests in 106 s). But the hub's batch report line still says "tiers T1, T3" ("batch 1311a8f8 …; tiers T1, T3; wall 137596 ms"). The label is derived from the old fixed tier list, not the batch's configured `batch_tiers`.

## Acceptance criteria

- [x] C1. (T1) The batch report line names the tiers the batch actually planned from `[merge] batch_tiers`: "tiers T1" with ["T1"], and "tiers T1, T3" with the default.
  - verified: rev-30 [reviewer] · run rev-20261019-894-source · 2026-10-19T19:26:01.649Z · commit 1ff6d584912f0d9cbdd17ca039959d207863a8fb
  - done: impl-894 · 2026-10-19T19:42:06.375Z
  - verified: rev-30 [reviewer] · run rev-20261019-894-final · 2026-10-19T19:43:46.386Z · commit 1ff6d584912f0d9cbdd17ca039959d207863a8fb

## Comments

### impl-894 · 2026-10-19T19:23:56.792Z

Implementing C1 at the existing T1 controller/Suites seam: assert exact report tier labels for default and T1-only settings. Regression will run red before fixing, then targeted file and typecheck, source review, mode-free verification.

### rev-30 · 2026-10-19T19:26:01.649Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-894-source
commit: 1ff6d584912f0d9cbdd17ca039959d207863a8fb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6406 Source clear,C1directly established: report uses completed retained selection tiers; exact literal default/T1-only assertions at existing T1 production controller boundary, original planning/landing checks retained. Missing historical metadata unavailable; no config reread/process/tier change. A6402reported34/34/typecheck supporting, not independently audited raw run. Same-head mode-free gate still required before final settlement.

Criteria: C1 verified.

### impl-894 · 2026-10-19T19:42:08.081Z

Same-head mode-free verification c35a241b-0c83-4cc8-bfdc-aafde13dfa6b passed at 1ff6d584912f0d9cbdd17ca039959d207863a8fb: 1149/1149, zero failures/skips. Log A-6465, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6465-suite-c35a241b-0c83-4cc8-bfdc-aafde13dfa6b-auto-at-1ff6d58.log. Linux x64 droplet c-8 lon1, lifetime 270 s, cost $0.0187. C1 claimant done mark added; awaiting final Reviewer settlement.

### rev-30 · 2026-10-19T19:43:46.386Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-894-final
commit: 1ff6d584912f0d9cbdd17ca039959d207863a8fb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged 1ff6d584. Raw A-6465 exact-head mode-free c35a241b independently audited: 1149/1149, zero failure/cancel/skip/TODO, all 37 load groups 5/5, no resource mismatch or owned budget row. Actual default/T1 report cases ordinary .041812657/.063300765 s and five repetitions each, maxima .359054023/.333774500 under .5 s. C1 verified; full source A-6406 and final audit A-6472. Linux c-8 lon1 lifetime270s/$0.0187, suite181.29s. T3 periodic/integrated only under current T1-only batch config; no task native claim, QA none.

Criteria: C1 verified.

### coord · 2026-10-19T19:53:32.382Z

Merged 89d683f15f84594c4eb1a9e7679df2fd9e13c1a7 onto dev.
