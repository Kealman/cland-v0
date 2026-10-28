---
id: T-1423
kind: task
title: web Items tree copied-tracker subtest times out on task.comment at 5 s once in a loaded task run
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1151
branch: t/T-1423-web-items-tree-copied-tracker-subtest
created: 2026-10-28T11:38:54.591Z
updated: 2026-10-28T12:39:50.764Z
---

## Summary

In web/test/items.test.ts, the subtest "CLI status deltas reorder a focused task and change its hub roll-up" (line 83, under "the Items tree reads the copied live tracker snapshot") failed once in a loaded droplet task run with "Error: no result for task.comment within 5000ms" (hub/test/harness.ts:679). That is the harness's request bound on the scratch hub serving the copied live tracker (about 1,420 items). T-1419's fix bounded rendered-row receipts, not this hub request. First seen in T-1406's mode-free run 12c8e330 at bad1e90a (A-13254), whose diff does not touch web/ or the tracker paths.

## Acceptance criteria

- [x] C1. The cause of the 5 s task.comment timeout against the copied tracker is attributed with receipts: hub request time against model time under load, as T-1419 did for rows.
  - done: impl-1423 · 2026-10-28T11:55:13.477Z
  - verified: rev-26 [reviewer] · run rev-20261028-1423-source-1 · 2026-10-28T12:39:50.764Z · commit 774198e024c48245bee96f6ed014f814ddb80bbf
- [x] C2. The subtest no longer fails on a loaded Linux task run: a bound sized from measured receipts, or a smaller fixture through T-1421, with 10/10 load evidence.
  - done: impl-1423 · 2026-10-28T11:55:16.977Z

## Notes

Shared-defect candidate, 2026-10-28. Related: T-1419 (same fixture, row receipts), T-1421 (fixture growth).

## Comments

### coord · 2026-10-28T11:44:14.110Z

Moved into 0.3 (R-1278) on the human's answer to ask 843ac812 (2026-10-28 11:44Z), under the standing yes of 05:04Z.

### impl-1423 · 2026-10-28T11:47:57.079Z

Scope: existing frameClient task.comment request and rendered verdict-row receipts in copied tracker fixture. No production/shared wire contract change planned, no consumer migration needed. Original red: A-13254 / run12c8e330 / bad1e90a: Error: no result for task.comment within 5000ms (harness.ts:679). Attribution will compare request elapsed time with cland.items.rebuild model measurements. Coordinator decision5a663726 accepts Darwin two-worker+CPU10/10 plus ordinary same-head Linux Web from mode-free verify for C2. Initial attempts without built web/dist are invalid setup-only runs, excluded.

### rev-26 · 2026-10-28T12:39:50.764Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1423-source-1
commit: 774198e024c48245bee96f6ed014f814ddb80bbf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13282 full source review clear, Standards0/Spec0. Only fixture-local task.comment request bound becomes15s plus diagnostics/guide; shared5s default, rendered verdict observer/final assertion and independent300-item/15ms model guard unchanged. Original A-13254 exact5000ms failure and A-13270 original baseline/final10 distinct native passes, child/parent4/4, CPU progress and browser/hub close receipts inspected; final source blob matches. C1 verified within Coordinator0cbd62db bounded attribution, with exact historical Linux queue/storage delay explicitly unobserved. C2 local10/10 half present but remains unverified pending ordinary same-head Linux Web per5a663726. One mode-free configured verify at unchanged head, then final original-record review; no additional all requested.

Criteria: C1 verified.
