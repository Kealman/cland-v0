---
id: T-563
kind: task
title: A broken spend ledger can suppress a sharded close run's parent receipt after every shard has reported
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - hub
  - tech-debt
assignee: null
parent: E-952
blocked_by: []
topic: topic-737
branch: t/T-563-a-broken-spend-ledger-can-suppress-a
created: 2026-10-16T02:49:50.553Z
updated: 2026-10-20T11:25:17.444Z
closed: 2026-10-20T11:25:17.444Z
---

## Summary
Found aside by impl-562 while fixing T-562 (2026-10-16). In hub/src/hub/suites.ts, `#collectShards` assembles the parent receipt of a sharded close run only after `releaseShardReservations` succeeds. If the shared spend ledger is broken, the parent report is suppressed even though every shard has reported and freed its scheduler reservation. T-562 fixes the same pattern for ordinary task runs: an accounting failure defers to the executor sweep instead of suppressing the terminal report. This item applies that to sharded runs.

## Acceptance criteria
- [x] C1. A sharded close run whose shards have all reported posts its merged parent receipt even when spend settlement or reservation release fails; the failed accounting is retried by the executor sweep and logged.
  - done: impl-563 · 2026-10-20T11:12:11.776Z
  - verified: rev-23 [reviewer] · run rev-20261020-563-final · 2026-10-20T11:21:03.950Z · commit 8dbf6d28b98ca651122d22385b443d4176501351
- [x] C2. A test runs a two-shard close with a failing spend ledger and shows the parent receipt posted, both reservations freed and the accounting retry recorded.
  - done: impl-563 · 2026-10-20T11:07:27.013Z
  - verified: rev-23 [reviewer] · run rev-20261020-563-final · 2026-10-20T11:21:03.950Z · commit 8dbf6d28b98ca651122d22385b443d4176501351

## Comments

### impl-563 · 2026-10-20T11:04:15.019Z

Confirmed the defect boundary in #collectShards: it awaits releaseShardReservations after both child reports, before persisting the merged parent result. Regression will exercise the existing T2 two-shard close component fixture, corrupt only its scratch spend ledger after both durable running receipts, and keep corruption present through the parent receipt assertion. Then repair the fixture file and observe the executor sweep settle both leases.

### rev-23 · 2026-10-20T11:08:51.703Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-563-source
commit: 9c9d21693a3a99303d8f8ccceded88781177fac2
scope: full
findings: [{"severity":"medium","text":"A failed synthetic shard-reservation release has no recovery owner after groupMerged is saved. If a shard is cancelled or fails before acquiring a lease, its reserved:<run> entry has no real released lease for settleSpend; the executor sweep cannot settle it, while the parent no longer calls #collectShards. Repairing the ledger therefore leaves reserved spend charged indefinitely. Persist/retry failed group releases independently of parent reporting and cover a pre-lease/cancelled shard.","file":"hub/src/hub/suites.ts","line":794}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: no independent findings. Spec: medium suites.ts:794 loses retry ownership for synthetic shard reservations when a child has no lease. The parent now persists groupMerged after the caught failure, while executor settleSpend only handles released real leases; repaired spend can remain reserved indefinitely. Persist/retry group release separately from parent reporting, including restart, and cover an unacquired/cancelled child. Existing T2 regression correctly covers real released leases but not this case. A-7541 contains source trace; A-7538 targeted macOS evidence is supplemental, no task gate yet. C1 failed, C2 left unverified.

Criteria: C1 failed (Failed synthetic shard-reservation release is logged but loses its retry owner after groupMerged; the lease sweep cannot settle reserved:<run> entries without a real lease.).

### impl-563 · 2026-10-20T11:12:12.594Z

Resolved review rev-20261020-563-source at 8dbf6d28. Added durable executor-owned group-release requests and reconciliation retries for synthetic reservations with no real leases. New pre-lease/restart regression failed before the fix, now passes; complete focused T2 files 9/9 and 13/13, T0 npm run check passed locally on darwin/arm64 (test lint report-only, zero refusals). README/test docs updated. Evidence is the revised source artifact in topic-737. Verification awaits fresh source review.

### rev-23 · 2026-10-20T11:12:54.664Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-563-source-corrected
commit: 8dbf6d28b98ca651122d22385b443d4176501351
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: A-7541 resolved. Durable group release requests now precede ledger settlement, survive parent reporting and restart, and are replayed by executor reconciliation; idempotent removal occurs only after settlement. New pre-lease T2 regression proves both synthetic reservations clear after restart with no leases and no duplicate parent; original released-lease case retained. Lifecycle docs updated. A-7547 contains full source trace; A-7546 local 9/9 close and 13/13 accounting plus T0 are supplemental, not task gate/load proof. C1/C2 runtime verification remains pending mode-free verification at this exact head.

### impl-563 · 2026-10-20T11:20:18.147Z

Same-head run 2ada0a4b-d40c-4520-ac38-da1115bb8d78 completed exit 0 at 8dbf6d28 on droplet cland-v0-3ee9d28d, Linux x64 6.8.0-142-generic / Node v24.21.0 / Neovim v0.12.5. Runtime selection: all T1 and fallback all T2 in both packages; 2048 passed, zero failed/skipped/cancelled. Both new suite-close-component identities have exact 5/5 passing load receipts in A-7554 (lines 8822, 8836). Duration/test lint gates are report-only. T3/T4 were not run. Remote receipt labels typecheck `host gate at 5f91c4c95823479dc102b46d9d337a870b3cbfff (not repeated)`; final-source local npm run check evidence is separately recorded in A-7546. Provider lifetime 361 s, billed $0.0251. Awaiting Reviewer final same-head evidence verdict; source remains unchanged.

### rev-23 · 2026-10-20T11:21:03.950Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-563-final
commit: 8dbf6d28b98ca651122d22385b443d4176501351
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no remaining findings. A-7557 audits exact-head A-7554/run 2ada0a4b: 2048/2048 ordinary tests, 9 close component and 13 accounting passes; both new recovery cases each pass 5/5 load repetitions. Corrected source A-7547 plus released-lease and zero-lease restart recovery receipts establish C1/C2, freed resources, retry logs and no duplicate parent. Historical A-7541 finding retained as corrected. Linux T1/all-T2 includes Neovim; T3/T4 deferred. Host check 5f91c4c recorded, not repeated; local check separate. Existing lint/budgets/ratchet report-only, ten missing baselines/incomplete timing not passes. No item QA required.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T11:25:17.444Z

Merged 30420e5ae77a14c166f479b1f6960d6d77ffebb0 onto dev.
