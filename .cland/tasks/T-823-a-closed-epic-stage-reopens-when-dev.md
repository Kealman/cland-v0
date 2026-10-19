---
id: T-823
kind: task
title: "A closed epic stage reopens when dev moves: plan show re-evaluates stage covers against the current tree"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-678
blocked_by: []
regression_of: T-714
topic: topic-568
branch: t/T-823-a-closed-epic-stage-reopens-when-dev
created: 2026-10-19T01:32:56.569Z
updated: 2026-10-19T09:33:58.093Z
closed: 2026-10-19T09:33:58.093Z
---

## Summary

`cland task plan show E-678` reported stage 1 ("queue entries, occasions and budgets") closed on 2026-10-18 at 20:04Z, after the green Linux 8695f749 and macOS ca6342e6 stage runs at one tree. By 01:35Z 2026-10-19, after later merges, it reported stage 1 open again with "stage cover missing Linux droplet, macOS" at the current tree. A closed stage reopens whenever dev moves, so every stage has to be re-covered at the same tree before any later stage can count as closed.

## Acceptance criteria

- [x] C1. Once a stage's cover is complete, the hub records the stage closed, naming the tree and both run ids, and `plan show` keeps reporting it closed after later dev commits; a component test closes stage 1, moves dev, and shows stage 1 closed and stage 2 open with its own cover state.
  - done: impl-823 · 2026-10-19T08:05:24.375Z
  - verified: rev-30 [reviewer] · run rev-20261019-823-final · 2026-10-19T08:24:29.383Z · commit 09cceab28e4acf59f8a99e04a7e4ee9ce71654dd
- [x] C2. Advancing to the next stage uses the recorded closure, never a re-evaluation against the current tree.
  - done: impl-823 · 2026-10-19T08:05:24.761Z
  - verified: rev-30 [reviewer] · run rev-20261019-823-source · 2026-10-19T08:07:31.515Z · commit 09cceab28e4acf59f8a99e04a7e4ee9ce71654dd
  - verified: rev-30 [reviewer] · run rev-20261019-823-final · 2026-10-19T08:24:29.383Z · commit 09cceab28e4acf59f8a99e04a7e4ee9ce71654dd

## Comments

### impl-823 · 2026-10-19T07:55:46.762Z

Implementing C1/C2 test-first at the component plan/task interface (qa none, after-stage), including durable closure and next-stage advancement.

### impl-823 · 2026-10-19T08:03:45.966Z

Regression is red-before-green at the plan/task component seam. Durable tracker_meta stage closure binds snapshot hash, tested head, normalized tree, Linux run and macOS run. A moved dev tip no longer reopens an already recorded stage while async ancestry is pending; confirmed rollback still opens it. C1/C2 component checks pass, including store reopen without live cover history and newly joined next-stage item advancing. Origin/dev fetched/merged (already current); adjacent stage tests in progress.

### rev-30 · 2026-10-19T08:07:31.515Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-823-source
commit: 09cceab28e4acf59f8a99e04a7e4ee9ce71654dd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-5875 records four-file Standards/Spec review. Durable stage snapshot/head/tree/platform-run evidence is reused for stage state and next-stage advancement, independent of suite cache history. Pending ancestry preserves completed closure; confirmed rollback/Git failure and changed snapshot/invalid or later not-clear QA still invalidate state. New T2 component proves frame behavior, store reopen and new next-stage item advancement without native processes. C2 verified by source; C1's exact-head component/task-gate runtime evidence remains pending. Host adjacent results/provenance are retained in A-5874, not represented as an exact-head task receipt.

Criteria: C2 verified.

### impl-823 · 2026-10-19T08:23:52.797Z

Same-head mode-free verification 7cd65196-f12f-47e8-aa68-bd7ef4600f44 passed at reviewed 09cceab28e4acf59f8a99e04a7e4ee9ce71654dd: 1477/1477 tests green, no failures. A-5887 retains the log. Linux droplet c-8 lon1, lifetime 927s, cost $0.0644; worktree remains clean and unchanged. Awaiting final Reviewer evidence verdict; T3 deferred to the merge batch by the queue policy.

### rev-30 · 2026-10-19T08:24:29.383Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-823-final
commit: 09cceab28e4acf59f8a99e04a7e4ee9ce71654dd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; no findings. A-5887 is exact-head mode-free green: 1477/1477 ordinary tests, zero fail/cancel/skip. Both new stage-closure components pass ordinarily and 5/5 repetitions; whole component file 1.413645497 s. Complete receipt has zero tier-mismatch rows and 397 groups all 5/5. C1/C2 verified at unchanged 09cceab2, covering durable provenance/store reopen and next-stage advancement with invalidation controls. Source baseline A-5875 and host evidence A-5874 retained; T3 is deferred landing evidence. No Reviewer tests/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T09:33:58.093Z

Merged 393ad678854b052d96be62dfa7c640a1c16cfebb onto dev.
