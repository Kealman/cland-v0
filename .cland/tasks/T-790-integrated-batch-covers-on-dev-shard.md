---
id: T-790
kind: task
title: Integrated batch covers on dev shard across two droplets, like stage close runs
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-499
branch: t/T-790-integrated-batch-covers-on-dev-shard
created: 2026-10-18T09:20:05.013Z
updated: 2026-10-18T10:44:55.627Z
---

## Summary

The Coordinator's ordinary integrated `cland verify all` on dev runs on one slot, about 25 min, and dev merges wait for it. Only `--occasion stage|epic|release` runs shard across `[verification] shards` droplets. Letting batch covers shard the same way roughly halves cover wall time (the hub machine shard is about 1250–1500 s of a 1500–1800 s run) and doubles merge throughput at nearly the same cost (human, General 2026-10-18 09:18Z: speed up the bottlenecks now).

## What to build

An integrated `verify all` on clean root dev, by the Coordinator, uses the same sharded path as close runs: largest-first balancing by durations.json, Neovim on the lightest shard, the whole group's cost reserved against the daily cap, and the same one-slot fallback with its warn notice. It stays an ordinary batch cover: no stage provenance and no change to stage, epic or release gates. Task runs keep one slot.

## Acceptance criteria

- [x] C1. A T2 test shows a Coordinator `verify all` on clean dev reserving two remote slots and producing one merged result with per-shard machine, duration and cost, without stage provenance.
  - done: impl-790 · 2026-10-18T10:44:21.768Z
  - verified: rev-30 [reviewer] · run rev-20261018-790-final · 2026-10-18T10:44:54.644Z · commit be41e99b0924dbe331b4c48c449faa28ebcfe245
- [x] C2. Fewer than two free slots or an insufficient cap runs it whole on one slot with the existing warn notice; a task head or a non-Coordinator request still uses one slot.
  - done: impl-790 · 2026-10-18T09:24:26.463Z
  - verified: rev-30 [reviewer] · run rev-20261018-790-final · 2026-10-18T10:44:54.644Z · commit be41e99b0924dbe331b4c48c449faa28ebcfe245
- [x] C3. docs/agents/tests.md and the Coordinator clause say batch covers shard.
  - done: impl-790 · 2026-10-18T09:51:14.974Z
  - verified: rev-30 [reviewer] · run rev-20261018-790-clause-correction · 2026-10-18T09:51:43.995Z · commit 2ec016ea3d86ec6d29e3f8d9d322282189a11b78
  - verified: rev-30 [reviewer] · run rev-20261018-790-duration-identity-correction · 2026-10-18T10:20:55.238Z · commit be41e99b0924dbe331b4c48c449faa28ebcfe245

## Comments

### impl-790 · 2026-10-18T09:24:33.787Z

Implemented at 723de8d2. Reuses close-run shard planning for clean Coordinator root dev batch requests with fresh origin/dev proof; keeps occasion unset and existing provenance gates. Targeted T2/T1 regressions and existing remote contract file pass, along with lint and typecheck. Evidence posted in item topic.

### rev-30 · 2026-10-18T09:25:34.793Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-790-source
commit: 723de8d2d6febe0237aa87961e2dee165d584844
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-5115. Clean fetched root-dev Coordinator all requests reuse existing shard planner/accounting/fallback/collector; task and non-Coordinator isolation remains enforced by dispatcher integration identity plus branch/root guards. Unset occasion omitted from merged log, no stage provenance fabricated; gates unchanged. T2 batch reservation/merged-result, cap/slot fallback and single-slot controls reviewed; real batch/cache expectations intentionally updated. C3 docs/clause verified. C1/C2 await exact-head droplet evidence; A-5112 reported red/green/static checks retained. No reviewer execution or throughput claim.

Criteria: C3 verified.

### rev-30 · 2026-10-18T09:26:36.117Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-790-clause-delta
commit: 415573cb86e06b052919c26a51491083bf779f8a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta clear, A-5118. Sole change restores QA clause to dev, matching primary Coordinator8f8f08a5 single-Coordinator-line scope. Runtime/tests/docs unchanged from A-5115; no dev merge. C3 current, C1/C2 await exact-head droplet evidence. Prior A-5112 validation remains applicable; no reviewer execution.

Criteria: C3 verified.

### rev-30 · 2026-10-18T09:50:55.342Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-790-runtime
commit: 415573cb86e06b052919c26a51491083bf779f8a
scope: evidence
findings: [{"severity":"medium","text":"M1: expanded sharding instruction makes the Coordinator defaults clause reply 7806 bytes, exceeding the existing 7680-byte reserved-cap guard in roles.test.ts:62. Exact-head gate fails; shorten the clause without weakening the guard.","file":"hub/src/roles/default-roles.ts","line":60}]
finding_counts: {"high":0,"medium":1,"low":0}

A-5161: A-5160 fails roles defaults snapshot: task-expanded Coordinator clause is 7806 bytes against 7680-byte guard. Keep the guard and shorten the instruction; fresh source review and exact-head verification required. All 13 batch/fallback carrier tests pass and all five owned load gates are 5/5, retained as positive evidence. Overall exit 1, 2143 pass/1 fail/5 skip; Neovim smoke absent after hub failure.

Criteria: C3 failed (The Coordinator clause fails its existing reply-size guard (7806 > 7680 bytes); shorten it and rerun at the reviewed head.).

### rev-30 · 2026-10-18T09:51:43.995Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-790-clause-correction
commit: 2ec016ea3d86ec6d29e3f8d9d322282189a11b78
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5164: M1/A-5161 source correction clear. One Coordinator bullet only, 140 UTF-8 bytes shorter, explicitly retaining batches shard too and cap/slot fallback. Existing size guard unchanged; A-5162 reports roles whole-file 4/4 green. C3 verified; C1/C2 and final readiness await fresh exact-head droplet evidence. No runtime/test changes or dev merge, no findings.

Criteria: C3 verified.

### rev-30 · 2026-10-18T10:19:32.108Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-790-runtime-budget
commit: 2ec016ea3d86ec6d29e3f8d9d322282189a11b78
scope: evidence
findings: [{"severity":"medium","text":"M2: renamed existing batch/cache test has no matching duration allowance, so new identity hard-fails at8.321s >5s. Carry measured provenance/expiry/open-epic ownership to the correct identity without rewriting historical baselines.","file":"hub/test/suite-close.test.ts","line":121}]
finding_counts: {"high":0,"medium":1,"low":0}

A-5199: A-5196 has zero assertion failures but exits1 on the renamed task-owned batch/cache identity (8.321s > unallowanced5s). Correct measured duration metadata without rewriting historical baselines; fresh source review then accepted exact-head gate required. Clause snapshot passes and five owned load gates pass25/25. This hard budget failure is task-caused, not shared/report-only.

Criteria: C1 failed (Renamed task-owned batch/cache test hard-fails duration budget (8.321s >5s); metadata correction and accepted exact-head gate required.).

### rev-30 · 2026-10-18T10:20:55.238Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-790-duration-identity-correction
commit: be41e99b0924dbe331b4c48c449faa28ebcfe245
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5202: M2 source correction clear. Historical test title restored per primary cb9ef3ab, with explicit two-shard behavior comment; all assertions, production source and durations.json unchanged. A-5200 replay maps captured8.321s to existing identity without hard failure; close file4/4 reportedgreen. C3 source verified again. C1/C2 and final readiness await fresh exact-head gate and current claimant done marks. No findings.

Criteria: C3 verified.

### rev-30 · 2026-10-18T10:44:54.644Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-790-final
commit: be41e99b0924dbe331b4c48c449faa28ebcfe245
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5217: exact-head A-5215 passes hub plus Neovim smoke, 2149 pass/0 fail/5 prerequisite skips. All13 carrier identities and20/20 current new repetitions pass, zero owned trips. Coordinator clause and restored duration identity both pass; no hard budgets. C1/C2 verified, C3 remains current. Earlier failed receipts retained; no findings.

Criteria: C1 verified, C2 verified.
