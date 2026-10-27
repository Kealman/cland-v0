---
id: T-1376
kind: task
title: explorer-card-component epic card test selects T-10 before zR has rendered its row
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1119
branch: t/T-1376-explorer-card-component-epic-card-test
created: 2026-10-27T18:02:39.553Z
updated: 2026-10-27T19:24:24.995Z
closed: 2026-10-27T19:24:24.995Z
---

## Summary

`nvim/test/explorer-card-component.test.ts::epic cards show stage progress, approval, subtree verdict and latest activity including a closed plan` failed once in T-1375's mode-free run 11f33f8b (Linux droplet, head db99ad06, log A-12854:18816) with `Lua: missing row T-10`. The test is unchanged and outside T-1375. Alone it passed 5/5 on dev 05a1c698 (macOS).

## What to build

After `zR` the test calls `select(c,'T-10')` at once; under load the expanded tree has not rendered T-10 yet. Wait for the T-10 row on screen (or in the explorer state) after `zR` before selecting, the way the earlier steps wait for 'The explorer', and check the other `zR`→`select` sites in the file for the same race (T-848 fixed a sibling).

## Acceptance criteria

- [x] C1. Every `zR` followed by `select` in explorer-card-component waits for the target row before selecting.
  - done: impl-1376 · 2026-10-27T19:01:59.170Z
  - verified: rev-26 [reviewer] · run rev-20261027-1376-evidence-1 · 2026-10-27T19:18:06.567Z · commit 663efa344eaae75614a00c0d873057e1d3d35067
- [x] C2. The identity passes 10/10 under two workers plus owned CPU load.
  - done: impl-1376 · 2026-10-27T19:01:59.237Z
  - verified: rev-26 [reviewer] · run rev-20261027-1376-evidence-1 · 2026-10-27T19:18:06.567Z · commit 663efa344eaae75614a00c0d873057e1d3d35067

## Comments

### coord · 2026-10-27T18:47:28.525Z

Reproduced on dev: the Linux droplet stage cover 111bc5a3 at 44b8310d (A-12860, shard-1 exit 1) failed on the same identity with the same `missing row T-10` signature. It is now a dev-red stage blocker for E-1310 stage 2 / E-1313 stage 1, beside the earlier T-1375 run 11f33f8b.

### impl-1376 · 2026-10-27T18:59:15.990Z

Scope/seam: test-only headless Neovim component file, production code unchanged. Consumer scan found nine zR sites: eight already wait for T-10 (seven anchored row regexes, one compact-verdict title wait); epic case line 134 selects immediately. Will retain a deterministic expansion hold released only by a screen observation, then require the anchored T-10 rendered row before select. Existing descendant fetch/cache and closed-plan assertions stay intact. No shared contract change (rule 20 not triggered).

### rev-26 · 2026-10-27T19:03:00.969Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1376-source-1
commit: 663efa344eaae75614a00c0d873057e1d3d35067
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, Standards 0 / Spec 0; A-12865. All nine zR-to-select sites use anchored target-row receipts; compact-title wait tightened and epic immediate selection fixed. Retained deterministic held real fold action releases on first screen observation, followed by positive row and held-observation assertions; original card/cache/closed-plan assertions intact. Existing T2/stub lifecycle and guide format correct, no product/shared-contract/identity change. A-12864 local exact-head macOS 15/15 and 10/10 two-lane CPU proof remain separate from pending configured/Linux runtime; first socket-path setup failure excluded. C1/C2 runtime marks pending unchanged-head mode-free run/original-record final review; QA none; no Reviewer execution.

### rev-26 · 2026-10-27T19:18:06.567Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1376-evidence-1
commit: 663efa344eaae75614a00c0d873057e1d3d35067
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear; C1/C2 verified. A-12866 exact source-clear head, exit 0; independent 3742 ordinary passes and no separate load-gate executions. All 15 explorer-card identities pass, epic .925313443 s / compact .624434469 s, retained held-expansion/cache/closed-plan assertions. A-12864 independently checked 10/10 exact-head macOS records, five per lane, native exit0/no signal/complete one-pass summary and positive owned CPU; cleanup joined, initial socket-path failure excluded. T0/all T1/fallback all T2/Web complete; T3/T4 unrun, Web new-file repetitions0. No new identity/allowance; host gate reused, pinned browser and report-only diagnostics retained. A-12867 records exact timings/platforms/coverage limits. QA none; Coordinator conflict check/enqueue/stage cover/landing separate.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-27T19:24:24.995Z

Merged 33535d69e0ed74c02802cf45d8e185b7ae923131 onto dev.
