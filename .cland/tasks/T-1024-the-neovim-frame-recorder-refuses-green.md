---
id: T-1024
kind: task
title: The Neovim frame recorder refuses green runs whose frame count depends on scheduling
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
topic: topic-1062
branch: t/T-1024-the-neovim-frame-recorder-refuses-green
created: 2026-10-20T19:05:14.551Z
updated: 2026-10-25T17:38:43.947Z
closed: 2026-10-25T17:38:43.947Z
---

## Summary

The Neovim frame recorder refuses to publish when a run under concurrent load records fewer frames than its floor (`explorer-component.test.ts recorded 251 frames; expected at least 253`), although every consumer test passed and a serial retry published byte-identical fixtures. Found by impl-1002 on T-1002 (2026-10-20, Darwin arm64).

## What to build

Make the recorder's completeness check independent of scheduling: count recorded test identities or required frame kinds instead of a raw frame floor, or run the recorder serially by default, so a green run under load publishes.

## Acceptance criteria

- [x] C1. A recorder run with concurrent targets publishes when every consumer test passed and no file was skipped (test simulating a scheduling-dependent frame count).
  - done: impl-1024 · 2026-10-25T17:17:30.648Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1024-final · 2026-10-25T17:32:42.482Z · commit d6d3d5c9d53869b357a4d98127fea9f5d110aeec
- [x] C2. The recorder still refuses a run that skipped a file or a test (test).
  - done: impl-1024 · 2026-10-25T17:13:00.059Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1024-final · 2026-10-25T17:32:42.482Z · commit d6d3d5c9d53869b357a4d98127fea9f5d110aeec

## Comments

### impl-1024 · 2026-10-25T17:09:50.990Z

Consumer inventory before changing the recorder completeness policy (rule 20): production maintenance caller hub/test/record-nvim-frames.ts uses assertRecordingRun and refreshFrameCatalog; public npm script is package.json test:nvim-fixtures; pure admission regressions are hub/test/nvim-frame-refresh.test.ts (T1). Recording consumers and native T3 fixture validator use the unchanged JSON catalog/slice format via nvim/test/frame-fixtures.ts, stub-hub.ts and nvim/test/scenarios/workbench.test.ts; discovery is nvim-frame-consumers.ts, guarded by nvim-fixture-boundary.test.ts. Existing persisted catalogs/slices remain readable, with no shape change. Shipped skill examples (.agents/skills), QA briefs, all test tiers and startup probes searched for helper/cmd references: no additional helper consumers. Documentation to migrate: hub/README.md Tests and docs/agents/tests.md Neovim recorded frames. Approved existing T1 seam: in-memory capture + actual TAP completion receipts and publication callback; catches admission/publication behavior without launching Neovim or a hub. Source tree initially clean. Triage A-11669 confirms nvim-frame-refresh.ts:28,34.

### impl-1024 · 2026-10-25T17:10:59.342Z

TDD at existing T1 seam (Darwin arm64, local Node; no browser/process fixture): C1 red: `fixture refresh failed: concurrent.test.ts, peer.test.ts recorded 1 catalog frames; expected at least 2`; green after replacing raw floors with per-file nonempty captures. C2 red: `Missing expected rejection ... # tests 1 ... # pass 0 ... # todo 1`; now requires passed=tests>0 and explicit zero fail/cancelled/skipped/todo. Regression simulates two concurrent targets whose requests coalesce, covers full/retained catalogs and prior/no slices, and checks no publication for zero-test files, one skipped test, TODO/cancelled/failed/partial/missing receipts.

### rev-31 · 2026-10-25T17:14:36.004Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1024-source1
commit: d838c06c241bdfb9748e84cfcd3b0172fb597079
scope: full
findings: [{"severity":"medium","text":"M1: guide heading must be '# hub/test/nvim-frame-refresh.test.ts'. Current prose heading deterministically fails unchanged test-docs.test.ts:21–26 with 'hub-test-nvim-frame-refresh.test.ts.md: test file heading'. Correct heading and validate existing guard without weakening assertions.","file":"docs/agents/tests/hub-test-nvim-frame-refresh.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source NOT CLEAR solely M1; Standards1medium/Spec0. A-12041 carries complete eight-file audit at treecd49f7321edfd942d625c60f5af2bd90c5e1cd3a. Scheduling-independent nonempty captures plus per-file successful complete TAP receipts satisfy design in source; full/retained/slice/coalescing and skipped/zero/partial/failed/cancelled/TODO/no-publication controls retained at T1. Catalog/slice wire/readers and whole-file recorder caller unchanged. No other finding. A-12039 local6/6/typecheck/wording summary retained with raw-capture/platform/process timing limits, not configured proof. Correct exact guide heading only, use existing docs guard for red/green, preserve assertions/index, push and request fresh source before verify. C1 failed for guide/guard obligation; C2 runtime-pending. Restore claimant done mark after correction. Preserve original local/correction outputs without transcription reruns; no expensive full recorder run or dev merge requested. Reviewer read-only.

Criteria: C1 failed (Required per-test guide has prose heading instead of exact test-path heading; existing public documentation guard deterministically rejects it.).

### rev-31 · 2026-10-25T17:16:11.810Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1024-source2
commit: 103220470d976aa91ba5ecffcfe5e540e1a93305
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source CLEAR, Standards0/Spec0; A-12044 carries full audit A-12041. Exact tree72ff0d35686a80d9db068ef86bc518117ed52d15, sole direct-child change is exact canonical test-path guide heading. M1 resolved; docs/index/guard assertions and all runtime/test sources unchanged. A-12043 original available local Darwinarm64 docs guard red2/3 exit1/exact heading refusal then green3/3 exit0/native duration_ms104.735125, with corrected precommit attribution and no transcription rerun; A-12039 remains limited earlier summary. Scheduling-independent successful per-file TAP plus nonempty captures/discovery and all C1/C2 publication/refusal controls carry unchanged, no other findings. C1/C2 claimant done, runtime verification pending ordinary unchanged-head mode-free configured run and final named-case/repetition/phase/provenance evidence. No full expensive recorder refresh, dev merge or guard relaxation requested; QA none. Reviewer read-only.

### rev-31 · 2026-10-25T17:17:12.398Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1024-source2-admission
commit: 103220470d976aa91ba5ecffcfe5e540e1a93305
scope: full
findings: [{"severity":"medium","text":"M2: remove retired exact identities 'full refresh refuses a smaller catalog even without existing file slices' and 'zero or reduced file captures preserve catalog and slices in full and retained refreshes' (also line5800). Verifier refuses the first before execution; both no longer match tests. Preserve existing identities/file metadata; no invented baseline or renamed measurements.","file":"hub/test/durations.json","line":5797}]
finding_counts: {"high":0,"medium":1,"low":0}

Follow-up source NOT CLEAR corrects preceding A-12044/source2 clearance; I missed retired duration consumers. A-12045 independently audits all nvim-frame-refresh manifest identities and identifies exactly two stale keys, including the second not yet named by host refusal. No suite/runtime pass exists. M1 remains resolved; full core Standards/Spec audit otherwise unchanged with no further findings. Remove only obsolete exact keys, validate existing identity guard, push/request fresh source before one new mode-free verify; restore claimant done. No baseline/allowance invention, guard relaxation, expensive refresh/dev merge/transcription rerun. C2 runtime-pending. Reviewer read-only.

Criteria: C1 failed (Two task-owned removed/renamed test duration keys block configured verification before execution.).

### rev-31 · 2026-10-25T17:18:08.505Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1024-source3
commit: d6d3d5c9d53869b357a4d98127fea9f5d110aeec
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source CLEAR, Standards0/Spec0, A-12047 carries complete A-12041/A-12044/A-12045 audit. Exact tree59b940ff1b01cd13f9e89d19440aa497dd41e439. Sole two-line removal deletes both retired exact test duration keys; file metadata/three current identities/all allowances and baselines unchanged, no renamed/invented measurements. M2 resolved; M1 heading remains fixed. A-12046 original local existing lintDurationIdentities command validates all keys against current source, exit0/complete stdout with attribution; not runtime evidence. Core scheduling-independent completion/TAP/capture/publication source and full T1 controls unchanged, no other findings. Previous submission pre-execution refused; C1/C2 done but runtime-unverified. One new ordinary mode-free verify at unchangedhead then exact named/repetition/phase/provenance evidence. No expensive recorder refresh, dev merge/guard change/transcription rerun directed. Reviewer read-only.

### rev-34 · 2026-10-25T17:32:42.482Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1024-final
commit: d6d3d5c9d53869b357a4d98127fea9f5d110aeec
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear:4e24346a/A-12055; audit A-12058 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12058-t-1024-final-evidence-at-d6d3d5c9.md), carrying rev31source3/A-12047 full audit. Parsed3238ordinary+15load passes. C1 coalesced concurrent-target simulation, C2 skipped/incomplete no-publication matrix and empty-discovery case each ordinary+5/5load; all6frame-refresh guards pass with exact retained publication/catalog assertions. This is pure admission simulation, not native concurrent refresh. HostT0/LinuxT1/allT2/Web complete; T3/T4/native refresh absent; prepared host check not repeated remotely. Docs3/3, prior duration refusal remains preexecution history. Report-only diagnostics retained, newcase peak0.009696756s. C1/C2 verified, no findings; QA none.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T17:38:43.947Z

Merged 8811120ea961ed413fd810e57e3e943b4cb1c8eb onto dev.
