---
id: T-1491
kind: task
title: measure-memory offline analyzer test exceeds its 5 s T3 budget on Linux droplets
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1466
blocked_by: []
regression_of: T-1467
found_by: droplet
topic: topic-1249
branch: t/T-1491-measure-memory-offline-analyzer-test
created: 2026-10-30T16:38:55.247Z
updated: 2026-10-30T17:07:36.270Z
closed: 2026-10-30T17:07:36.270Z
---

## Summary

Every full T3 run that includes dev since T-1467 fails on one per-test duration budget, and on nothing else. The failing test is `hub/test/measure-memory.test.ts::offline analyzer reads a real V8 snapshot and finds an owned large array`, which takes 5.1–5.3 s on Linux c-8 droplets against the 5 s per-test budget. `hub/test/durations.json` has no allowance or baseline for the file.

## Evidence

- verify all da4fb1a4 / A-14575 (T-373 at 10b574f02): 5,425 pass, 0 fail. T3 exit 1 on `duration budget: … 5.134 s > 5 s (add to hub/test/durations.json with a reason)`.
- verify all c4f4be38 / A-14539 (T-1483 at b5…): the same gate at 5.283 s.
- Both runs also report `missing duration baseline hub/test/measure-memory.test.ts` (17.1 s and 19.6 s observed, report only).
- The "over budget: 60 s" file regressions in those runs (suite-timeouts, orphan-servers and others) also appear in green runs all day. They are not the gate.

## What to build

Make the identity pass the per-test gate on the reference executor. Either speed the test up, for example with a smaller snapshot fixture that still proves an owned large array, or add a reasoned allowance in `hub/test/durations.json` (owner E-1466, added 2026-10-30, expires ≤ 2026-11-06). Size the allowance at about 1.5x the worst observed sample (rule: never from one sample). Use the existing allowance format and `durations.ts` tooling. Keep the baseline add-only.

## Acceptance criteria

- [x] C1. A targeted run of `hub/test/measure-memory.test.ts` on the Linux droplet executor at the head passes with no `duration budget:` failure for the offline-analyzer identity, and the reason, owner and expiry for any allowance are in durations.json.
  - done: impl-1491 · 2026-10-30T17:00:51.883Z
  - verified: rev-26 [reviewer] · run rev-20261030-1491-evidence-1 · 2026-10-30T17:01:19.423Z · commit 6b70499cab79ead1fb14b2736e7a7651f98be8ce
- [x] C2. If the test was changed, it still asserts that the analyzer finds the owned large array in a real V8 snapshot.
  - done: impl-1491 · 2026-10-30T16:41:36.065Z
  - verified: rev-26 [reviewer] · run rev-20261030-1491-source-1 · 2026-10-30T16:42:41.752Z · commit ca67de7a31f9471c5822a284709ddf05b8d942e0
  - verified: rev-26 [reviewer] · run rev-20261030-1491-source-2 · 2026-10-30T16:44:21.358Z · commit 6b70499cab79ead1fb14b2736e7a7651f98be8ce
  - verified: rev-26 [reviewer] · run rev-20261030-1491-evidence-1 · 2026-10-30T17:01:19.423Z · commit 6b70499cab79ead1fb14b2736e7a7651f98be8ce

## Comments

### impl-1491 · 2026-10-30T16:39:51.567Z

Seam: existing production duration checker replaying the two Linux passing samples, plus existing real V8 snapshot analyzer test (unchanged assertions). No shared contract changes. Consumers of allowance: suite-durations.ts check/lint/runner/admission/merge projections remain unchanged. Reviewed A-14539 5.283094746 s and A-14575 5.133541762 s; exact identity gated at 5 s. Prefer bounded allowance: reducing payload size does not reduce most native V8 graph parsing cost and risks weakening the 800000-byte ownership proof. New allowance at ceil(1.5×worst×1000)/1000 = 7.925 s, owner E-1466, expires 2026-11-06. No baseline rewrite from red integrated logs.

### rev-26 · 2026-10-30T16:42:41.752Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1491-source-1
commit: ca67de7a31f9471c5822a284709ddf05b8d942e0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear in accompanying audit. Exact7.925s dated allowance derives from two original passing Linux identity samples5.133541762/5.283094746; owner open E-1466,Oct30–Nov6, baseline/source/budget/prior allowances unchanged. Real V8 snapshot,nodes>1000 and owned MemoryProbeHolder>=800000 proof retained; C2 source verified. A-14586 local Darwin summary not Linux C1. C1 pending original exact-head configured Linux execution and gate facts; one mode-free verify may proceed, no Reviewer workload.

Criteria: C2 verified.

### rev-26 · 2026-10-30T16:44:21.358Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1491-source-2
commit: 6b70499cab79ead1fb14b2736e7a7651f98be8ce
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Reason-only source2 clear. Original A-14582 atdevdb4bb9a874 confirms exact analyzer pass4.762491446s; source reason appropriately adds borderline sample without changing7.925s maximum-derived allowance, owner/expiry/baselines or executable source. A-14591 source conclusions retained,C2 refreshed; C1 exact-head Linux runtime remains pending. One configured mode-free verify at frozen6b70499ca may proceed; no Reviewer workload.

Criteria: C2 verified.

### rev-26 · 2026-10-30T17:01:19.424Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1491-evidence-1
commit: 6b70499cab79ead1fb14b2736e7a7651f98be8ce
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14600 original-record audit clear. A-14599/d75c1165 exact source2 head Linux droplet nativeexit0,4333 ordinary+125load pass/0adverse. Exact analyzer finish/timing pass2.915283907s,all15memory identities once,no duration budget line; committed7.925s owner/date/reason and retained native V8 ownership proof established. C1/C2 verified. T0/T1/T2/changedT3/Web complete,remainingT3/T4unrun; reusedremotehosttypecheck and report-only diagnostics retained. New sample below5s is not performance-improvement proof. No Reviewer workloads.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-30T17:07:36.270Z

Merged 9f96de0db160b2fb0bd8b90aa4da9d25bd404fcb onto dev.
