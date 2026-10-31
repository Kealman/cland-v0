---
id: T-1495
kind: task
title: Memory budget report shows the interval maximum and states whether the limit applies to endpoints or the whole interval
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1276
branch: t/T-1495-memory-budget-report-shows-the-interval
created: 2026-10-30T22:55:14.530Z
updated: 2026-10-31T15:52:29.862Z
---

## Summary

The report-only memory budget (T-1478, 256 MiB heap / 768 MiB RSS, agreed with the human) compares readiness and rest endpoints. In the E-1466 QA run (A-14729, qa-2026-10-30-677-1466 at 3cc3d62e8), the endpoints passed: heap 153.0 MiB at readiness and 129.2 MiB at rest. But a transient heap peak of 294.3 MiB during rest exceeded 256 MiB, and the report does not show it. The budget output should publish the observed interval maximum beside the endpoints and say explicitly whether the limit applies to endpoints or to the whole interval. Origin: qa-677's proposal from the E-1466 demo.

## Acceptance criteria

- [x] C1. The memory budget report prints readiness, rest endpoint and interval maximum for heap and RSS, each marked within or over the agreed limit, plus one line naming which readings the limit governs. It stays report-only.
  - done: impl-1495 · 2026-10-31T15:31:32.698Z
  - verified: rev-26 [reviewer] · run rev-20261031-1495-evidence-1 · 2026-10-31T15:52:29.675Z · commit af92bf5395e040958cc6198936cb8a5948c4fe13

## Comments

### impl-1495 · 2026-10-31T15:29:32.356Z

Consumer audit before additive report change: memoryBudgetReport/MemoryReading/MemoryLimits and memory-budget.json searched across hub, web, nvim, shared, docs, skills and QA sources. Production caller is hub/test/measure-memory.ts; persisted JSON readers are hub/test/measure-memory.test.ts; help and docs are measure-memory.ts, hub/README.md and docs/agents/tests/hub-test-measure-memory.test.ts.md. Existing readiness/rest/mode fields and three-argument comparison remain compatible. New intervalMaximum and endpoint policy fields are additive; no wire contract changes. Tests use existing comparison and sealed-worker seams; no live measurement or GUI.

### rev-26 · 2026-10-31T15:33:45.762Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1495-source-1
commit: af92bf5395e040958cc6198936cb8a5948c4fe13
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14949 full source clear, all seven paths read. Persisted admitted-phase samples accumulate readiness/rest/streaming maxima before final report, excluding startup/disposal; pending joins and frozen endpoint preserved. Shared formatter prints three heap/RSS within/over comparisons and explicit endpoints-only report policy; old mode/readiness/rest and3arg calls retained, no enforcement. Consumer search includes QA budget readers with additive compatibility; help/README/guide/skill align. Regression uses existing comparison+sealed native producer, retains native0/report-only and exact persisted-max assertions. A-14946 Mac58/58/typecheck/lint summary stays partial, no reviewer workload or live measurement. C1 done/runtime-unverified. One configured mode-free verify at frozenaf92bf539 then original generated-case/native evidence review; preserve raw local receipts.

### rev-26 · 2026-10-31T15:52:29.676Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1495-evidence-1
commit: af92bf5395e040958cc6198936cb8a5948c4fe13
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14961 original6f0a3d31/A-14957 at unchangedaf92bf539 audited:5270matching pairs,4501ordinarytest+519file passes, separate125loadtest+125loadfile passes,zeroadverse/missing/duplicates;fivefailurearrays[]. C1verified by sealedrest23447→23448/transientmaximum23462→23463,missing-limit/native0/heldlate-sample receipts and pinned formatter/persisted-max assertions. ChangedT3measurememory58paired inclnested vs57durationidentitiesonce38.095s excludingmachinewait;remainingT3/T4unexecuted. T0host/T1/allfallbackT2inclNeovim/selectedT3/Web0;hosttypecheck reused. Candidate82dbbfa vsGit17b15 differ only1526excludedtracker/rulespaths. Linuxx64dropletc8lon1Node24.21/Nvim.12.5;actualShell1248Chrome156.0.8078.4;cache/occasionnull/skips[];reportadvisories122/59zero refusals retained. Synthetic reporting/sampler proof,no live-scale measurement/leak claim. Findings[].

Criteria: C1 verified.
