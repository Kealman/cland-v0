---
id: T-888
kind: task
title: The thread oracle's extended soak plan needs a budget-correct placement
state: open
status: in progress
size: XS
criterion_seq: 1
labels:
  - v0.1.4
assignee: impl-882
parent: C-216
blocked_by: []
topic: topic-625
branch: t/T-888-the-thread-oracle-s-extended-soak-plan
created: 2026-10-19T16:36:08.592Z
updated: 2026-10-19T19:17:36.331Z
---

## Summary

Under CLAND_TEST_SOAK=1, threadSeedPlan expands nvim/test/thread.test.ts "generated live appends, ask evictions and delivery changes equal a full render" from 2x12 to 4x25 renders. That extended plan took 2.325 s on the Mac after T-882 (ordinary T2: 0.741 s), and it is still covered by a legacy allowance. Found aside by impl-882 on 2026-10-19.

## Acceptance criteria

- [ ] C1. The extended soak plan of that case either runs within its tier budget, or moves to a T4 soak case with the T4 header. The legacy allowance for the identity is retired, and the ordinary T2 plan is unchanged.
  - failed: rev-30 [reviewer] · 2026-10-19T19:17:36.331Z · note Exact-head task run faa5afea/A-6371 is red on inherited T-891; Neovim phase did not execute, so ordinary oracle Linux and final passing-gate evidence remain incomplete.

## Comments

### impl-888 · 2026-10-19T19:09:59.882Z

Reconciled inherited implementation with landed dev/T-882 in 7a6c61761ca9fb82e3242e3b40ddb94d1db775be and pushed local territory branch. Typecheck, 23-test thread file, T4 extended file and ordinary-under-soak targeted run pass. Both registrations use the shared oracle; T2 stays 2x12 under soak and T4 explicitly runs 4x25. Preparing first source review; qaPolicy.scope none.

### rev-30 · 2026-10-19T19:11:24.753Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-888-source
commit: 7a6c61761ca9fb82e3242e3b40ddb94d1db775be
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6350 Standards/Spec source clear: normalized extracted oracle body equals landed T-882 with only explicit plan/bin routing; all assertions and guards preserved. Ordinary T2 explicitly 2x12 even under soak; standalone T4 header/manifest explicitly 4x25. Parsed baseline retires only original oracle allowance. A-6345 host 23/23 ordinary, 1/1 T4 and 1/1 ordinary-under-soak captured and audited, distinct from pending exact-head mode-free gate. No criterion verified until runtime settlement; T4 host proof remains distinct from Linux task selection.

### impl-888 · 2026-10-19T19:17:23.926Z

Source clear at 7a6c6176 (rev-20261019-888-source); mode-free run faa5afea failed on the known dev verify-tool fixture defect, A-6371. Coordinator identifies shared fix T-891, currently in delta review; instructed to hold, then cherry-pick the reviewed commit when posted, request fresh delta review and rerun mode-free verification. No task source changes or extra run while waiting.

### rev-30 · 2026-10-19T19:17:36.331Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-888-runtime-blocked
commit: 7a6c61761ca9fb82e3242e3b40ddb94d1db775be
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6372 Evidence not clear. Raw ordinary totals1382/1380pass/2fail; inherited verify-tool two controls also0/5 each, no completed Neovim receipts. No new owned source finding; A-6350 extraction remains clear. T-891 revised shared fix67a01b6f source-clear/in verification; await Coordinator-posted correction, delta review then new mode-free gate. No duplicate known-red retry or unrelated edits.

Criteria: C1 failed (Exact-head task run faa5afea/A-6371 is red on inherited T-891; Neovim phase did not execute, so ordinary oracle Linux and final passing-gate evidence remain incomplete.).
