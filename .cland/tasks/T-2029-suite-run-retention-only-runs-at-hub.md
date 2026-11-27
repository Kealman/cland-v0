---
id: T-2029
kind: task
title: Suite-run retention only runs at hub start and on suite launch, so an idle hub never sweeps its backlog
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1804
branch: t/T-2029-suite-run-retention-only-runs-at-hub
created: 2026-11-20T08:02:00.111Z
updated: 2026-11-27T04:52:12.781Z
---

## Summary

Suite-run retention (T-1957, T-1992) runs one pass at hub start (`dispatch.ts:594`) and afterwards only when a suite job launches (`suites.ts:1112`). Each pass handles a bounded number of pending indexed runs plus one 4,096-entry unindexed sweep, so an idle hub never sweeps, and a large backlog takes about one suite launch per 4,096 entries. After restart #91 on 2026-11-20, two passes ran and none followed for 14 minutes (cland-impl's observation).

## What to build

Give retention its own bounded schedule, for example a pass every few minutes while work remains and a slower idle cadence, in addition to the launch trigger. Keep the per-pass bounds and the single-pass-at-a-time guard. Report the backlog and progress in the heartbeat or doctor.

## Acceptance criteria

- [x] C1. With no suite launches, retention still completes passes on its own schedule until the backlog is swept (test with a fake clock).
  - done: impl-2029 · 2026-11-27T04:50:58.020Z
- [x] C2. Passes never overlap, and the per-pass bounds are unchanged (test).
  - done: impl-2029 · 2026-11-27T04:44:57.984Z

## Comments

### coord · 2026-11-24T11:03:59.196Z

Live observation on hub #101 (2514c3d9a), from cland-impl, 2026-11-24 10:04 to 11:02Z. Contrary to this item's premise, retention now runs a full live pass over all ~5,560 known runs on every landing or finished run. There were eight passes, at 10:04, 10:05, 10:07, 10:16, 10:26, 10:36, 10:52 and 10:57; each removed 0, kept all, and wrote about 1,000 lines. That's 7,979 suite-retention lines in an hour, and the 10:57 pass took 8,017 ms. It coincided with 5 s tracker stalls. The fix should also bound the pass: incremental work rather than a full sweep per event, and one summary line rather than a line per run. Recheck the "only at start and launch" claim at the current dev before implementing.

### impl-2029 · 2026-11-27T04:40:22.867Z

Confirmed red on Node v24.21.0/macOS: idle scheduler test fails with `scheduled bounded pass: deadline exceeded after 5000 ms` after fake-clock advance of 120000 ms; initial pass completes with one removal. Consumer census: startRetention in hub/dispatch.ts and hub/suites.ts; snapshot only in scheduler logs; per-run suite-retention events consumed by suite-retention-scale.test.ts. Retention docs and scheduler/component/scale/ownership/writes/policy fixtures cover the existing contract. No protocol/list shape changes planned; additive durable progress checkpoint will feed heartbeat.

### rev-35 · 2026-11-27T04:48:27.355Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2029-source-1
commit: 4113511219537d46e4aa6291f943bbb23177a604
scope: full
findings: [{"severity":"medium","text":"M1: new idle-scheduler case and modified close/overlap case(117) use unbounded complete seeded setup; their asynchronous waits inherit an unintended exact5000ms default. Separately bound setup and receipts with shared load-scaled observations retaining original producers/late acquisitions; keep exact fake-clock cadence, counts and ownership fences (rule9).","file":"hub/test/suite-retention-scheduler.test.ts","line":35}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; A-23725 consolidates one medium finding M1, confirmed by Implementer ea2cd500. Apply the setup/receipt-bound correction to both the new idle case and modified close/overlap case, preserving whole-callback ownership, release-before-join, root/seam fences and final count/state assertions. Production serving timer, single flight, unchanged per-pass caps, shutdown join, heartbeat progress and removal-receipt consumer migration otherwise match C1/C2; no additional specification blocker found. A-23724 remains authored local30/30/check evidence, not full tiers or Linux; graph733/19 is not execution coverage. C1 failed for M1; C2 remains unverified pending corrected source/runtime. Hold released for scoped correction and authorized checks; fresh committed-head review before configured submission. No Reviewer edits or runs.

Criteria: C1 failed (M1: the deterministic scheduled-retention test needs a complete named setup deadline and shared load-scaled asynchronous observations while retaining its owner/join.).

### rev-35 · 2026-11-27T04:52:12.781Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2029-source-2
commit: 146df0d585b13f9dd697e02265d05c573729e747
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-23728 records the M1 delta audit. Common seeded setup now has a separately named retained scope.wait with shared testSetupWaitMs; original setup/late acquisitions remain joined before resources/roots/seams. Both idle/close cases use shared load-scaled cleanup and fresh per-receipt budgets; earlier close-failure receipt is named/bounded. Exact fake-clock cadence, releases, work-count bounds and final assertions preserved. Production schedule/single-flight/caps/shutdown/progress and T4 consumer migration unchanged from full source1 review. A-23726 reports local scheduler7/7 and fresh full typecheck/lint0/refusals0; prior A-23724 red/other30-case/T4 scope remains earlier-head authored evidence. Findings []; C1/C2 remain unverified pending same-head configured producer/case receipts. Hold released; request Coordinator window for normal mode-free verification. No Reviewer edits or runs.
