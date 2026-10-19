---
id: T-712
kind: task
title: "A red batch is bisected by failing file: the culprit is refused with merge-bisected, the rest land, a culprit-less repeat proposes quarantine"
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
  - T-711
topic: topic-540
branch: t/T-712-a-red-batch-is-bisected-by-failing-file
created: 2026-10-16T19:59:43.692Z
updated: 2026-10-19T00:18:27.180Z
---

## Summary

A red batch must never become an Implementer's resubmit. The hub finds the culprit by rerunning only the failing files, which cost 10–60 s each as file-level jobs (memo §5.2.5; report-strategy §3c and §4.2.6). With at most three heads, leave-one-out reruns find a single culprit in at most three file-level jobs, and the green leave-one-out tree is exactly the tree the remaining heads land on.

## What to build

- **Batch of one.** A red batch with one member refuses it with `merge-bisected`, naming the failing files and tests.
- **Leave-one-out.** In a larger batch, the hub reruns the failing files on each tree that leaves one member out. If exactly one removal makes them green, that member is refused with `merge-bisected` (naming the file and test that fail with it in), and the rest land on the green leave-one-out tree through T-711's landing.
- **No single culprit.** The failing files rerun once on the batch tree. Green means a flake: the batch lands and each failing file gets a flake observation. Red means every member is refused with `merge-bisect-unresolved` and the Coordinator gets one notice with the evidence.
- **Quarantine proposal.** A test with flake observations in two different batches produces a quarantine proposal, an ask to the Coordinator carrying both receipts, in the form `docs/agents/tests.md` requires for `quarantine.json`.
- **Cost.** File-level jobs and their seconds and cost appear in the batch result.

## Acceptance criteria

- [x] C1. A red batch of one is refused with `merge-bisected` naming the failing test, proved by a test on the in-process provider.
  - done: impl-712 · 2026-10-19T00:18:26.746Z
- [x] C2. In a red batch of three with one culprit, the culprit is refused with `merge-bisected` and the other two land on the leave-one-out tree after at most three file-level jobs, proved by a test.
  - done: impl-712 · 2026-10-19T00:15:59.468Z
- [x] C3. A red batch whose failing files pass on rerun lands and records a flake observation, and a second observation of the same test in another batch posts a quarantine proposal to the Coordinator, proved by tests.
  - done: impl-712 · 2026-10-19T00:15:59.829Z
- [x] C4. A red batch with no single culprit and a red rerun refuses every member with `merge-bisect-unresolved` and posts one Coordinator notice, proved by a test.
  - done: impl-712 · 2026-10-19T00:10:19.694Z
- [x] C5. The batch result lists each file-level job with its tree, seconds and cost, proved by a report test.
  - done: impl-712 · 2026-10-19T00:10:20.258Z

## Comments

### impl-712 · 2026-10-19T00:03:06.719Z

Implementation seam agreed by launch brief: T1 durable MergeBatches/Suites with FakeClock and scripted in-process droplet provider. Extending existing merge-batches.test.ts; no real API or global state. First slice: a red single-member batch refuses with named failure evidence.

### rev-30 · 2026-10-19T00:13:44.132Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-712-source
commit: a21b2c67d093cb0da9307d8f853353f6862f6e5d
scope: full
findings: [{"severity":"high","text":"H1: exit-zero original-tree repeat lands even if failing identities skipped or have no valid completed-pass evidence; recordBatchFlakes rejects observations but its void result cannot gate landing. Existing new skipped-rerun test explicitly lands all members. Require valid executed passing proof for every original failure before flake landing, with skip/TODO/cancel/missing/malformed controls.","file":"hub/src/hub/merge-batches.ts","line":177},{"severity":"medium","text":"M2: cancelled/requester-died diagnostic receipts collapse to passed=false and count as red alternatives. One green plus aborted omissions can falsely identify a unique culprit; cancelled repeat can falsely establish unresolved red. Preserve inconclusive state and block attribution/landing until valid evidence, with T1 aborted-diagnostic controls.","file":"hub/src/hub/merge-batches.ts","line":232}]
finding_counts: {"high":1,"medium":1,"low":0}

Source not clear. H1: original-tree repeat requires executed passing evidence before flake landing; observation-only rejection does not stop unsafe merge. M2: preserve inconclusive diagnostic outcomes instead of treating cancelled/abandoned jobs as red comparisons. A-5672 records complete audit, exact counterexamples, positive selection/persistence/report paths and raw28/28 host checks. All criteria remain unverified. These are the completed audit findings; fresh source review after fixes, no verification at this head.

Criteria: C3 failed (Original-tree repeat lands on exit0 despite skipped/missing completed-pass evidence; skipped regression currently expects unsafe landing.), C2 failed (Inconclusive cancelled/abandoned leave-one-out jobs count as red and can falsely establish a unique culprit.).

### rev-30 · 2026-10-19T00:17:03.731Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-712-correction-source
commit: f689a3c4ba95e3f2de620b5cca3892f34172fc35
scope: full
findings: [{"severity":"medium","text":"M3: original batch receipt bypasses diagnosticResult. A cancelled/timed-out/lost singleton with no failing-test receipt is still refused merge-bisected using generic cause; aborted multi-member originals can also start diagnosis on partial failures. Gate initial receipt eligibility and hold inconclusive originals with evidence instead of blaming members; add aborted original singleton/multi controls.","file":"hub/src/hub/merge-batches.ts","line":132}]
finding_counts: {"high":0,"medium":1,"low":0}

Correction not clear atf689a3c4. H1 executed repeat proof and M2 diagnostic inconclusive handling are resolved with raw22/22 host checks. M3 remains in original-result branch before diagnosis: aborted singleton can be falsely refused, and partial aborted multi result can enter attribution. A-5675 details exact path and controls. All criteria unverified; no verification before fresh source review. No other findings from correction pass.

Criteria: C1 failed (Original singleton batch cancellation/timeout/lost result still causes merge-bisected without a failing test.).
