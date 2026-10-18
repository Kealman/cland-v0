---
id: T-714
kind: task
title: Stage, epic and release runs execute T1 to T4 on both platforms, with the load gate for tests new since the last stage
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by:
  - T-679
  - T-681
topic: topic-490
branch: t/T-714-stage-epic-and-release-runs-execute-t1
created: 2026-10-16T19:59:43.897Z
updated: 2026-10-18T13:21:11.730Z
---

## Summary

Decision 2 keeps two-platform T3 and T4 at stage, epic and release. T4 is where perf cases, the full QA case set, the 4-seed differential oracle, harness self-tests and long lifecycle waits live after E-677 (memo §5.1 T4 row). Until this ticket, T4 files run wherever T3 runs; after it, they run at occasions and in the nightly soak (T-715) only.

## What to build

- **Occasion runs** (`--occasion stage|epic|release`, Linux sharded and the macOS local run as today) plan T1, T2, T3 and T4 and set `CLAND_TEST_SOAK=1`. `balanceCloseShards` places T4 files like the others.
- **The load gate** at occasions repeats each identity that is new since the last green stage run five times.
- **Other runs.** The Coordinator's `all` and integrated `dev` runs plan T1 to T3. Task runs follow T-713.

## Acceptance criteria

- [x] C1. An occasion run plans every T1–T4 file with `CLAND_TEST_SOAK=1`, and an `all` run plans T1–T3 without it, proved by planning tests.
  - done: impl-714 · 2026-10-18T12:16:51.575Z
  - verified: rev-30 [reviewer] · run rev-20261018-714-final · 2026-10-18T12:44:26.504Z · commit 9ac7d4e9ae3eb037531bc4e9921eef6e86da255c
  - verified: rev-30 [reviewer] · run rev-20261018-714-override-integration-final · 2026-10-18T13:21:10.393Z · commit 580c57a08bedf6cffb15abffc2c2a72b9e557262
- [x] C2. The load gate at an occasion repeats the identities new since the last green stage run five times, and none older, proved by a load-gate test.
  - done: impl-714 · 2026-10-18T09:29:46.782Z
  - verified: rev-30 [reviewer] · run rev-20261018-714-final · 2026-10-18T12:44:26.504Z · commit 9ac7d4e9ae3eb037531bc4e9921eef6e86da255c
  - verified: rev-30 [reviewer] · run rev-20261018-714-override-integration-final · 2026-10-18T13:21:10.393Z · commit 580c57a08bedf6cffb15abffc2c2a72b9e557262
- [x] C3. A two-shard stage run's result shows the T4 tier line per shard, proved by a close-run test on the in-process provider.
  - done: impl-714 · 2026-10-18T09:29:47.724Z
  - verified: rev-30 [reviewer] · run rev-20261018-714-final · 2026-10-18T12:44:26.504Z · commit 9ac7d4e9ae3eb037531bc4e9921eef6e86da255c
  - verified: rev-30 [reviewer] · run rev-20261018-714-override-integration-final · 2026-10-18T13:21:10.393Z · commit 580c57a08bedf6cffb15abffc2c2a72b9e557262

## Blocked by

T-679 (tiers), T-681 (tier lines).

## Comments

### impl-714 · 2026-10-18T09:27:01.160Z

Implemented occasion T1–T4 planning and soak worker environment, stage-receipt identity load gating, shard tier reporting and tier-aware cache/stage-cover admission. T1 red/green tests prove planner and identity policy; T2 red/green test proves T4 lines per shard. Added a T1 large-selection round trip because the current identity list is ~297 KB, beyond an inline environment value. Typecheck and test lint pass; sequential touched-file checks in progress before dev merge/source review.

### rev-30 · 2026-10-18T09:53:59.969Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-714-source
commit: f1a03d958bf559d96b1cc56d55233073f4d518d8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5166: source clear, no findings. Audited occasion T1–T4/soak versus ordinary T1–T3, persisted stage-receipt identity baseline through local/droplet/shards/reopen, large-selection file transport, tier-aware cache/stage cover and per-shard T4 summary. C1–C3 remain runtime-dependent and unverified. Per sequencing, wait for authorized T-790 integration and fresh delta review, including ordinary-batch shard filtering, before final droplet verification.

### impl-714 · 2026-10-18T11:14:54.559Z

Coordinator-authorized post-source-review dev merge completed at 6ec6b8ee (includes T-790/T-788). Added red/green T2 evidence and soak-based exclusion before ordinary batch balancing, including duration weights. All five affected files pass sequentially (A-5228), followed by lint/typecheck. Delta review requested; waiting for clear verdict and hub-restarted notice before the single droplet verify. No further dev merges without instruction.

### rev-30 · 2026-10-18T11:16:20.768Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-714-integration-delta
commit: 6ec6b8ee73a1cd3c3eaa05ad43aa23f179df11a4
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5232: authorized T-790/dev integration source clear, no findings. Ordinary sharding excludes T4 paths and all T4 timing weights; occasions retain them. Sentinel test preserves reservation/accounting/cleanup and proves ordinary files balance without T4; stage T4 lines remain covered. T-788/planner merge resolutions intact, prior transport/policy files unchanged. C1–C3 runtime pending. Preserve Coordinator hold: verify only after source clear AND hub-restarted notice; E-676 merge hold separate.

### rev-30 · 2026-10-18T12:07:46.988Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-714-runtime
commit: 6ec6b8ee73a1cd3c3eaa05ad43aa23f179df11a4
scope: evidence
findings: [{"severity":"medium","text":"M1: ordinary dry-run/report expectations still demand T4 and the old 1000s denominator; suite-selection.test.ts:575 likewise expects T4 fixture self-tests without occasion soak. A-5251 has three failures from these stale consumers. Align ordinary T1–T3 expectations while preserving occasion-positive and reporting/selection assertions.","file":"hub/test/suite-dry-run.test.ts","line":59},{"severity":"medium","text":"M2: seeded historical full receipts omit selection.soak, now required by Suites.stageCover at suites.ts:258. Both platform receipts become ineligible; 13 planned-stage/stage-QA/scenario failures wait for cover or advancement. Refresh the fixture to the new occasion contract while retaining provenance and ordinary-cover rejection checks.","file":"hub/test/stage-cover-fixture.ts","line":18}]
finding_counts: {"high":0,"medium":2,"low":0}

Runtime not clear, A-5254. A-5251 exits1: 2141 pass,16 fail,0 cancelled,5 prerequisite skips. M1 accounts for three ordinary-population expectation failures; M2 accounts for 13 stage cover/advancement failures. Correct M2 source citation is stage-cover-fixture.ts:18 (selection field; artifact adjacent-line citation is off by one). Focused planner/baseline/shard tests and ten associated 5/5 groups pass, but failed full gate cannot clear runtime criteria. C1 failed; C2/C3 remain unverified. Preserve receipt, correct carriers without weakening assertions, obtain fresh source review before replacement verification. Zero tier trips; no reviewer execution.

Criteria: C1 failed (Exact-head A-5251 exits1 with 16 failures: stale ordinary T4 expectations and historical stage-cover fixtures lacking required soak; no complete Neovim phase.).

### impl-714 · 2026-10-18T12:17:14.633Z

Fixed runtime findings M1/M2 at 9ac7d4e9, only three test carriers. Original head reproduced all 16 failures; identical baseline files pass on dev 54657bf8. Seeded stage receipts now encode soak/occasion; ordinary dry-run census and T4 harness inclusion/exclusion match the new cadence. All 124 targeted tests pass serially (A-5264), plus lint/typecheck. Fresh delta review requested before one replacement droplet gate; no dev merge or production gate relaxation.

### rev-30 · 2026-10-18T12:19:04.627Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-714-carrier-correction
commit: 9ac7d4e9ae3eb037531bc4e9921eef6e86da255c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source correction clear, A-5268; M1/M2 closed. Three test carriers only, no dev merge or production predicate relaxation. Ordinary CLI/MCP/report expectations now exactly T1–T3/900s/55.556% with no T4 line and existing budget/census/mutation controls retained; remote fixture guard explicitly proves ordinary exclusion and occasion inclusion. Historical stage receipts now carry stage/soak/loadGate on both platforms; provenance/publication/ancestry and ordinary-cover rejection controls remain. Independently parsed A-5264: original 16 failures reproduced; fixed serial six-file run 124/124, no fail/cancel/skip. C1–C3 await fresh exact-head droplet; A-5251/A-5254 retained. No reviewer execution.

### rev-30 · 2026-10-18T12:44:26.505Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-714-final
commit: 9ac7d4e9ae3eb037531bc4e9921eef6e86da255c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, A-5285. Exact-head A-5284 full gate passes 2523 tests, zero failures/cancellations, eight prerequisite skips; all phases finalize. Six changed files positively execute 121 ordinary identities, all 16 previously failing names now pass, and shared stage/provenance consumers recover. Ten scoped groups pass 50/50 repetitions. Occasion/ordinary planning, last-green-stage identity baseline and large transport, and two-shard T4 report controls verify C1–C3 with source mapping A-5166/A-5232/A-5268. Zero tier trips and no hard budgets. A-5251/A-5254 failure retained; production predicates remain intact. No reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-30 · 2026-10-18T12:50:42.428Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-714-override-integration-delta
commit: 580c57a08bedf6cffb15abffc2c2a72b9e557262
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta clear, A-5298. Coordinator 3ffcc49b authorized this single merge. Sole resolution retains occasion and requested executor/size/workers signature, incoming override-aware lookup/recovery and task occasion mismatch rejection before reuse. Existing soak/baseline/shard/report and carrier corrections remain. Incoming T-792 tests retain separate platform/override runs and exact retries/reopen; no assertions removed. A-5294 raw 37/37 serial passes, no failures/cancellations/skips; diff check clean. C1–C3 await fresh exact-head droplet; A-5284/A-5285 remain previous-head evidence. No reviewer execution.

### rev-30 · 2026-10-18T13:21:10.393Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-714-override-integration-final
commit: 580c57a08bedf6cffb15abffc2c2a72b9e557262
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Latest integration final clear, A-5322. A-5319 exact-head full gate passes 2582 tests, zero failed/cancelled, eight prerequisite skips; all hub/Neovim phases finalize. Six affected carriers positively execute 126 identities, shared stage consumers pass, and twelve occasion/override/batch groups pass 60/60 repetitions (including incoming separate-platform and requested-override recovery controls). Zero tier trips and no hard budgets. C1–C3 verified with source A-5298 and retained planning/baseline/shard mapping. Prior failure/correction and previous-head receipts remain disclosed. No reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.
