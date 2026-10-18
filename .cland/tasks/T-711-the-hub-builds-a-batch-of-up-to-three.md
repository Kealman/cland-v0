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
updated: 2026-10-18T16:45:55.040Z
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
  - done: impl-711 · 2026-10-18T16:38:51.335Z
- [x] C2. A tracker-only `dev` commit during the batch run lands the batch without a second run, and a code commit rebuilds and reruns it, proved by tests.
  - done: impl-711 · 2026-10-18T16:38:52.743Z
- [x] C3. A conflicting entry is dropped with `merge-conflict` and the other two land after one run, proved by a test.
  - done: impl-711 · 2026-10-18T16:38:54.097Z
- [x] C4. A hub restart during the batch run resumes it and lands each entry once, proved by a restart test.
  - done: impl-711 · 2026-10-18T16:38:55.456Z
- [x] C5. The batch run's result names its members, tree, tiers and wall, and `cland verify queue` lists the batch while it runs, proved by a report test.
  - done: impl-711 · 2026-10-18T16:38:56.256Z

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
