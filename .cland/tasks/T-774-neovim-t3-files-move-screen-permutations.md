---
id: T-774
kind: task
title: Neovim T3 files move screen permutations to committed-frame T2 tests (A-4961 group, ~150 s)
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - nvim
  - tests
  - ready-for-agent
assignee: null
parent: E-677
blocked_by:
  - T-709
topic: topic-510
branch: t/T-774-neovim-t3-files-move-screen-permutations
created: 2026-10-18T04:49:28.746Z
updated: 2026-10-18T16:46:10.667Z
closed: 2026-10-18T16:46:10.667Z
---

## Summary

This is a split of T-708, from its C1 inventory A-4961. It covers the 27 Neovim T3 files (232.7 s): their screen permutations move to T2 tests that replay committed hub frames, under the same titles. The real-hub workbench proofs stay in the workbench scenario. It builds on T-709's frame recorder. The proposed removal is 150.0 s.

## What to build

Apply the "Neovim" rows of A-4961 using T-709's recorder and fixtures. Keep the screen assertions' meaning.

## Acceptance criteria

- [x] C1. Every "Neovim" row in A-4961 is applied or explicitly kept, with each moved test's title and assertion meaning unchanged, recorded as an audit artifact.
  - done: impl-774 · 2026-10-18T15:15:50.709Z
  - verified: rev-30 [reviewer] · run rev-20261018-774-source · 2026-10-18T15:21:25.577Z · commit a94f8bb6e1afc84c22e3c77c016a1b04b5fde137
  - verified: rev-30 [reviewer] · run rev-20261018-774-final · 2026-10-18T15:57:34.254Z · commit a94f8bb6e1afc84c22e3c77c016a1b04b5fde137
- [x] C2. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify, including the Neovim shard.
  - done: impl-774 · 2026-10-18T15:55:47.948Z
  - verified: rev-30 [reviewer] · run rev-20261018-774-final · 2026-10-18T15:57:34.254Z · commit a94f8bb6e1afc84c22e3c77c016a1b04b5fde137

## Comments

### impl-774 · 2026-10-18T14:31:08.815Z

Source inventory underway. T-709 already supplies replay data for the existing stub consumers. Separating screen-only permutations from native lifecycle/CLI/watch proofs under unchanged titles; C1 audit will name every moved/kept title. Cover-quiet is active, so no local tests/timings have run. Initial fetched-origin lint and typecheck pass.

### impl-774 · 2026-10-18T15:15:50.546Z

Source pushed at a94f8bb6e1afc84c22e3c77c016a1b04b5fde137, branch t/T-774-neovim-t3-files-move-screen-permutations, with origin/dev c7baa5d6 integrated before review. A-5395 is the durable C1/C2 Mac evidence bundle: all 27 rows accounted, 162 same-title declarations moved, all 1,317 original test-local assertions and all 4,464 original recording entries unchanged. Ordinary serial validation: 28 files ×5 + 12 unchanged T2 consumers once + six affected files ×5 after fallback =182 invocations,1,843 passes,0fail/cancel/skip,peak1m6.394. Final lint/typecheck/tiers, exact40 selection replay and assertion audit all exit0. Quiet profile (12 extra complete-file runs,peak3.681) totals44.429s full catalog versus38.345s slices across shell/explorer native and component files; raw startup samples and per-file table are in A-5395/T-774-validation.md. C1 is complete; C2 remains pending the exact-reviewed-head droplet including Neovim, which will wait for the Coordinator's hub-restarted announcement.

### rev-30 · 2026-10-18T15:21:25.577Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-774-source
commit: a94f8bb6e1afc84c22e3c77c016a1b04b5fde137
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear against integrated dev c7baa5d6. C1 verified: all 27 A-4961 rows mapped, native keeps match primary 19dc76f5 and name specific proofs/follow-up candidates. Reviewed AST assertion audit preserves 291 exact titles/1317 ordered assertions (162 moved,129 kept); independently checked destination title presence and that audit baseline files match integration base. Three body changes preserve assertions while changing client setup or replacing blind waits. Neutral T2 closure and plan view ownership retain native process boundaries. Original 4464 records/24807 nodes unchanged; independently decoded four slices equal main-catalog records. Unknown frames still fail, lazy fallback reads only committed main JSON, maintenance/drift controls retained. Lint debt unchanged at524; empty entries add no tolerance, no allowance/quarantine. A-5395 raw Mac transcripts independently confirm182 serial runs/1843pass/0fail-cancel-skip and >=5 per touched test file. No integrated speedup claimed. Standards/spec: no findings. C2 awaits exact-head mode-free droplet including Neovim after Coordinator lifts submission hold. No Reviewer execution/per-item QA.

Criteria: C1 verified.

### rev-30 · 2026-10-18T15:57:34.254Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-774-final
commit: a94f8bb6e1afc84c22e3c77c016a1b04b5fde137
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear. A-5407/e609b4ac passes at unchanged A-5398 source-reviewed head:2616 pass,0 fail/cancelled,8 prerequisite skips; hub and full Neovim finalize. Independent timing/positive reporter audit covers27 changed test files plus workbench:238 timing-backed ordinary identities, all positive/no scoped skips;147 scoped load groups pass735/735. C1 remains the reviewed27-row same-title/assertion/native-boundary audit. C2 verified with A-5395 raw Mac182 serial runs/1843passes/0fail-cancel-skip,>=5 per changed test file, plus this exact-head Linux gate. Seven unique scoped report-only duration warnings remain disclosed (thread stress/history/rewrites, events quiet, explorer preferences, shell/thread file totals); no hard gate failure or new allowance. Route remainder for budget follow-up/dedup; no integrated speed target claimed. Four inherited report-only trips remain C-326/T-803, no scoped trips. No source change, Reviewer execution or per-item QA.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-18T16:46:10.667Z

Merged a6b6d018b615029d777f8ae3adaa0ce7898e39ae onto dev.
