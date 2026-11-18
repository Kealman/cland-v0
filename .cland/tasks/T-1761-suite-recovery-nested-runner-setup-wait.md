---
id: T-1761
kind: task
title: suite-recovery nested-runner setup wait uses the 15 s default and times out under macOS cover load
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1612
branch: t/T-1761-suite-recovery-nested-runner-setup-wait
created: 2026-11-07T23:19:52.447Z
updated: 2026-11-18T07:43:47.731Z
closed: 2026-11-18T07:43:47.731Z
---

## Summary

`hub/test/suite-recovery.test.ts` "admission quarantines a dead run's recreated root and releases both compatibility locks" waits for its nested suite runner's fake child with `eventually(...)`. That wait uses the default setup budget, `testWaitMs()` (15 s). The wait covers a whole nested `runSuite` launch: a node --test runner, its worker, and the fake child's rename, kill and recreate. Under local macOS load that launch alone exceeds 15 s. Other nested-launch helpers in `harness.ts` use `testWaitMs(45_000)`.

## Evidence

- E-1534 stage-1 macOS cover 8e4e8dff (A-17640) at dev c130bac4, local darwin arm64, workers 2, peak 1-minute load 7.38. The run failed with `fake child recreated root after runner kill: not within 15000 ms` at `suite-recovery.test.ts:164`, after 15.98 s. That was the only failure; 6975 tests passed. The file was last changed by T-511.
- The case was run alone at the same tree, under the preservation lock with `CLAND_*` stripped, at a 1-minute load of about 4.5: 5/5 green.

## Acceptance criteria

- [x] C1. The nested-runner setup wait uses a launch-sized budget, `testWaitMs(45_000)` like the other nested-launch helpers. Behaviour bounds keep their names and do not change.
  - done: impl-1761 · 2026-11-18T06:37:29.822Z
  - verified: rev-39 [reviewer] · run rev-39-1761-source-20261118 · 2026-11-18T06:38:53.458Z · commit c056d62db6ed1d336f3d630b9d8e1147c12cbda1
  - verified: rev-39 [reviewer] · run rev-39-1761-final-20261118 · 2026-11-18T06:51:28.512Z · commit c056d62db6ed1d336f3d630b9d8e1147c12cbda1
- [x] C2. A sweep of `suite-recovery.test.ts` and its sibling suite-runner tests lists, in an item comment, every `eventually()` that covers a nested runner launch with the default budget, and each one is fixed.
  - done: impl-1761 · 2026-11-18T06:38:01.482Z
  - verified: rev-39 [reviewer] · run rev-39-1761-source-20261118 · 2026-11-18T06:38:53.458Z · commit c056d62db6ed1d336f3d630b9d8e1147c12cbda1
  - verified: rev-39 [reviewer] · run rev-39-1761-final-20261118 · 2026-11-18T06:51:28.512Z · commit c056d62db6ed1d336f3d630b9d8e1147c12cbda1

## Comments

### impl-1761 · 2026-11-18T06:17:29.483Z

Red evidence (Coordinator accepted A-17640 for this budget-only fix): fake child recreated root after runner kill: not within 15000 ms. macOS cover 8e4e8dff at c130bac4, workers 2, peak 1-minute load 7.38. No new source-shape test; retain the existing public lifecycle seams and all behaviour bounds.

### impl-1761 · 2026-11-18T06:17:42.594Z

C2 sweep: searched every suite-*.test.ts for runSuite/runPackageSuite and eventually, then read nested-launch contexts. Default-budget launch waits fixed to testWaitMs(45_000): suite-recovery.test.ts — fake child recreated root after runner kill; borrowed root creation crashed; borrowed planned root exists. suite-cancel.test.ts — detached fake child ready (both recreate variants); runner child started. suite-runner-contract.test.ts — hand run waiting; hand holds package lock; hub phase entered; hand waits behind both phases; live package holder (legacy and UTC variants). suite-timeouts.test.ts — hung runner and worker PID receipt; silent test owns children. Total: 12 call sites, including parameterized variants. suite-runner.test.ts has no eventually calls (uses its separate until helper); suite-admission.test.ts and suite-preflight.test.ts invoke the CLI runSuiteCommand rather than a nested package runner; suite-admission-cost.test.ts uses fake admission. Completion/result waits and waits after releasing a prior phase or holder are behaviour/ordering checks and unchanged, including tests entered, Neovim phase entered, hand admitted after verification, legacy result and successor results. Existing FIFO_SETUP_MS and PIPE_HOLDER_SETUP_MS setup waits already have explicit budgets. Ordinary direct child startup waits do not cover a nested suite runner and remain unchanged.

### rev-39 · 2026-11-18T06:38:53.458Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1761-source-20261118
commit: c056d62db6ed1d336f3d630b9d8e1147c12cbda1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at c056d62db6ed1d336f3d630b9d8e1147c12cbda1. Standards/spec: no findings. C1: all12 setup call sites use shared testWaitMs(45_000); diff preserves predicates, names, behaviour bounds and final lifecycle assertions. C2: item comment lists every changed wait and exclusions; independent sibling suite-*.test.ts search/read confirms nested launch waits migrated, with direct child startup, completion and post-release ordering waits unchanged. Inspected supplied local darwin arm64 Node24.21.0 logs A-21070–A-21076:44 native passes and7 until T1 passes; report-only lint notices retained, not counted as passing prerequisite probes. Reviewer ran no tests. This is source clear only; final verdict awaits same-head configured verification.

Criteria: C1 verified, C2 verified.

### rev-39 · 2026-11-18T06:51:28.512Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1761-final-20261118
commit: c056d62db6ed1d336f3d630b9d8e1147c12cbda1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged reviewed head. Durable run df2e54e4-f355-42d7-93af-01865144bad6 finished/passed; A-21087 provenance pins c056d62db6ed1d336f3d630b9d8e1147c12cbda1 / tree f237d30148e0dfa1fb93ef58a7eb465e74d913e1, no cache. Host T0 passed; Linux x64 droplet Node24.21.0 T1, selected T2, changed T3 and Web smoke commands exit0. Independently streamed44 passing top-level T3 case receipts (11 recovery,8 cancel,6 contract,19 timeout) and four passing file completions. Chrome Headless Shell156.0.8078.4 / Playwright1248. Task selection only: remaining T3/T4, full T2/Web and Neovim not claimed; duration/lint notices report-only. C1/C2 source/sweep verification from A-21079 stands. No findings; reviewer ran no tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T07:43:47.731Z

Merged 6b8f2939341b9ce43d41142f066125b03bd12700 onto dev.
