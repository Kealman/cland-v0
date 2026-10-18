---
id: T-711
kind: task
title: The hub builds a batch of up to three queued heads, runs T1 and T3 once on the batch tree, and lands them in order on green
state: open
status: review
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by:
  - T-710
  - T-697
  - T-679
topic: topic-521
branch: t/T-711-the-hub-builds-a-batch-of-up-to-three
created: 2026-10-16T19:59:43.592Z
updated: 2026-10-18T22:09:33.223Z
---

## Summary

With entries queued (T-710), the hub needs to turn them into landings: one integration run per batch on the merged tree, so that every commit lands in a green tree (memo §4 option c, §5.2.5; bors, Tide, Chromium CQ). The pieces exist: `merge-tree --write-tree`, the candidate tree hash, `Suites`, the territory lock and `TaskMerges`' landing and recovery path.

## What to build

- **The batch.** When entries wait, the hub takes the oldest up to `[merge] batch` (default 3). It starts when the batch is full or `[merge] batch_wait` (default `"10m"`) after the oldest entry. It squashes each head onto `dev` in queue order without touching a checkout; an entry that conflicts is dropped with `merge-conflict` and the batch is rebuilt without it.
- **One run.** The hub submits one `Suites` run on the batch tree with the new occasion `batch`, on the configured executor at the Coordinator's priority. It runs T1 whole and T3, with the load gate for T3 identities new in the batch. The result goes to every member's requester and lead and to the Agents topic.
- **Land on green.** Each entry lands in queue order through `TaskMerges`' landing path (merge receipt, territory push, root checkout reconciliation, worktree cleanup), so recovery after a crash is today's.
- **When dev moved.** If `dev` moved during the run only by commits that leave the candidate tree unchanged (tracker files, `.cland/tasks`), the batch lands without a rerun. Any other movement rebuilds the batch and reruns it.
- **Refused at landing.** An entry refused at landing (a lane hold, a stale verdict) is dropped with its reason, and the rest are rebuilt as a new batch.
- **Visible.** `cland verify queue` and `cland merge queue` show the running batch and its members.

## Acceptance criteria

- [x] C1. Three queued heads produce one batch run on one tree and land on `dev` in queue order with their merge receipts, proved by a test on the in-process provider (T-697) and the fake clock.
  - done: impl-711 · 2026-10-18T16:53:15.146Z
  - verified: rev-30 [reviewer] · run rev-20261018-711-final · 2026-10-18T17:20:26.778Z · commit fd16c8fa21ffe7fd9de8e5e62999b951d4b8c80a
- [x] C2. A tracker-only `dev` commit during the batch run lands the batch without a second run, and a code commit rebuilds and reruns it, proved by tests.
  - done: impl-711 · 2026-10-18T16:38:52.743Z
  - verified: rev-30 [reviewer] · run rev-20261018-711-final · 2026-10-18T17:20:26.778Z · commit fd16c8fa21ffe7fd9de8e5e62999b951d4b8c80a
- [x] C3. A conflicting entry is dropped with `merge-conflict` and the other two land after one run, proved by a test.
  - done: impl-711 · 2026-10-18T16:38:54.097Z
  - verified: rev-30 [reviewer] · run rev-20261018-711-final · 2026-10-18T17:20:26.778Z · commit fd16c8fa21ffe7fd9de8e5e62999b951d4b8c80a
- [x] C4. A hub restart during the batch run resumes it and lands each entry once, proved by a restart test.
  - done: impl-711 · 2026-10-18T16:38:55.456Z
  - verified: rev-30 [reviewer] · run rev-20261018-711-final · 2026-10-18T17:20:26.778Z · commit fd16c8fa21ffe7fd9de8e5e62999b951d4b8c80a
- [x] C5. The batch run's result names its members, tree, tiers and wall, and `cland verify queue` lists the batch while it runs, proved by a report test.
  - done: impl-711 · 2026-10-18T16:38:56.256Z
  - verified: rev-30 [reviewer] · run rev-20261018-711-final · 2026-10-18T17:20:26.778Z · commit fd16c8fa21ffe7fd9de8e5e62999b951d4b8c80a

## Blocked by

T-697 (`Suites` on the clock and the in-process provider), T-679 (tiers).

## Comments

### coord · 2026-10-18T09:38:05.650Z

Integration requirement from T-710 and T-716 (coord, 2026-10-18 09:38Z). Queued admission (T-710) intentionally has no merged tree, so preparing and landing a queued candidate here must keep T-716's immutable merge-budget gate:
- Call `durationBudgetContext(root, {head: mergedTree, base: baseHead, env})` and `checkMergeBudgets(context, workers)` on the merged tree before any checkout or ref change.
- Propagate `budgetLines`, including the conditional T3-wall deferral and the "estimated (no receipt)" diagnostics for new T3 identities.
Reusing `territory.squashTask` keeps the gate. A new landing path must invoke the same checks, and a T2 test must show a budget refusal on a queued candidate.

### impl-711 · 2026-10-18T16:38:03.788Z

Implemented the durable merge-batch controller, immutable squash preparation, hub-owned T1/T3 occasion and queue/report visibility. Red-green evidence began with C1's missing batch submission; later failing tests exposed config duration rendering and T3-only load repetition. C1 now exercises real TaskMerges + tracker merge receipts on in-process Git/ref and worktree edges, with the scripted in-process droplet provider and FakeClock. T2 projectHub proofs cover merged-tree budget refusal before checkout/refs and report fan-out/queue visibility. Source review preparation is in progress; no verify submission under the Coordinator's T-813 hold.

### rev-30 · 2026-10-18T16:45:55.040Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-711-source
commit: ceea9c6b1e57c036b01e00712d890eb4689939bd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at ceea9c6b; Standards and Spec have no findings. A-5454 records FIFO preparation/landing, immutable merged-tree budgets before checkout/ref mutation, durable recovery, T1/T3 selection and T3 load gate, and queue/report fan-out. C1–C5 have matching source/tests but remain unverified pending exact-head runtime evidence. Coordinator's T-813 verification hold and E-678 stage/merge sequencing remain in force; do not submit until explicit all-clear.

### rev-30 · 2026-10-18T16:52:44.754Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-711-runtime
commit: ceea9c6b1e57c036b01e00712d890eb4689939bd
scope: evidence
findings: [{"severity":"medium","text":"Complete merge-config assertions still expect only queue:false/true; new batch and batchWaitMs defaults fail the ordinary test and all five repetitions. Update the four complete shape expectations while preserving validation and round-trip controls.","file":"hub/test/init-config.test.ts","line":22}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear: A-5459 / 03049323 exits 1 at unchanged ceea9c6b. A-5461 distinguishes 293/294 ordinary passes from 643/649 completed bodies including load repetitions. All ten batch unit tests plus 50 repetitions pass, but T2 queue/report proofs and Neovim were not reached. M1 is task-owned; claimant is correcting the four stale config shapes. Fresh source review required at replacement head before verification.

Criteria: C1 failed (Exact-head runtime gate failed in T1 on stale complete merge-config assertions; machine and Neovim phases did not execute.).

### impl-711 · 2026-10-18T16:53:27.428Z

Corrected runtime finding M1 at fd16c8fa21ffe7fd9de8e5e62999b951d4b8c80a. Four complete config expectations in init-config.test.ts now include batch=3/batchWaitMs=600000. Original test red in 0.124s; whole file green 2/2 in 0.114s. Host lint/typecheck pass. Runtime code unchanged; no dev merge. Source re-review requested from reviewer role, with A-5462 evidence; no replacement verification submitted yet.

### rev-30 · 2026-10-18T16:53:52.097Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-711-config-correction
commit: fd16c8fa21ffe7fd9de8e5e62999b951d4b8c80a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at fd16c8fa; M1 corrected by exactly four complete config expectations, retaining boolean validation and round-trip controls. A-5464 records both axes and the bounded diff. No runtime change/dev merge. C1–C5 remain pending replacement exact-head runtime evidence; one normal mode-free droplet gate is permitted under Coordinator's all-clear.

### rev-30 · 2026-10-18T17:20:26.778Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-711-final
commit: fd16c8fa21ffe7fd9de8e5e62999b951d4b8c80a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged fd16c8fa. A-5493/894e3c11 full gate passes 2635/2643 ordinary tests, zero fail/cancel, eight unrelated skips; full Neovim completes. All ten batch and seven queue ordinary cases pass with 85/85 repetitions (60/60 task-new), including immutable budget refusal and frame/report routing; corrected config control passes 5/5. A-5494 maps C1–C5, preserves prior failed gate and discloses C-326/T-803 report-only diagnostics. No per-item QA; Coordinator retains stage/merge sequencing.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-711 · 2026-10-18T22:08:19.574Z

Under Coordinator authorization 0bda6e7f, merged origin/dev 04f1cf6e once and resolved seven overlapping files, retaining batch, soak, T-813 persistence/liveness and T-815 selection-fallback behavior. New head a589cc1e070d36c0b73ac697af32e82afff1c40d is pushed and clean. All 56 targeted files passed serially (426 tests, zero failures/skips, 372.962s), including all suite*.test.ts, suite-persistence, executor-liveness/lock/deadline and T-813 droplet recovery scenario. Host lint/typecheck pass. A-5596 contains logs/timings/merge-resolution diff. Fresh source review requested from reviewer role; no verification at this new head until clearance.

### rev-30 · 2026-10-18T22:09:33.223Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-711-integration-delta
commit: a589cc1e070d36c0b73ac697af32e82afff1c40d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta clear at a589cc1e after explicitly authorized one dev merge. Seven conflict compositions preserve batch/soak admission, baseline separation, one-slot policy, member reports/queue state, T-813 archive/sequence/terminal-report/shutdown behavior and T-815 fallback headers. A-5597 records both axes, both-parent trace, unchanged critical incoming modules and independently parsed56 raw files/426 passes/zero fail-cancel-skip. Prior final gate is stale. C1–C5 await the Coordinator-required fresh exact-head mode-free droplet run; no waiver, findings or per-item QA.
