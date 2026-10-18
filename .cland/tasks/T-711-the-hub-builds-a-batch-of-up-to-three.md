---
id: T-711
kind: task
title: The hub builds a batch of up to three queued heads, runs T1 and T3 once on the batch tree, and lands them in order on green
state: open
status: backlog
size: M
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
topic: null
branch: null
created: 2026-10-16T19:59:43.592Z
updated: 2026-10-18T09:38:05.650Z
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

- [ ] C1. Three queued heads produce one batch run on one tree and land on `dev` in queue order with their merge receipts, proved by a test on the in-process provider (T-697) and the fake clock.
- [ ] C2. A tracker-only `dev` commit during the batch run lands the batch without a second run, and a code commit rebuilds and reruns it, proved by tests.
- [ ] C3. A conflicting entry is dropped with `merge-conflict` and the other two land after one run, proved by a test.
- [ ] C4. A hub restart during the batch run resumes it and lands each entry once, proved by a restart test.
- [ ] C5. The batch run's result names its members, tree, tiers and wall, and `cland verify queue` lists the batch while it runs, proved by a report test.

## Blocked by

T-697 (`Suites` on the clock and the in-process provider), T-679 (tiers).

## Comments

### coord · 2026-10-18T09:38:05.650Z

Integration requirement from T-710 and T-716 (coord, 2026-10-18 09:38Z). Queued admission (T-710) intentionally has no merged tree, so preparing and landing a queued candidate here must keep T-716's immutable merge-budget gate:
- Call `durationBudgetContext(root, {head: mergedTree, base: baseHead, env})` and `checkMergeBudgets(context, workers)` on the merged tree before any checkout or ref change.
- Propagate `budgetLines`, including the conditional T3-wall deferral and the "estimated (no receipt)" diagnostics for new T3 identities.
Reusing `territory.squashTask` keeps the gate. A new landing path must invoke the same checks, and a T2 test must show a budget refusal on a queued candidate.
