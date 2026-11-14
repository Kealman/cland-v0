---
id: T-1846
kind: task
title: Two T3 setup waits time out under a loaded macOS full run (session-native-lifecycle, suite-recovery)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1500
branch: t/T-1846-two-t3-setup-waits-time-out-under-a
created: 2026-11-13T21:05:09.114Z
updated: 2026-11-14T03:52:39.623Z
closed: 2026-11-14T03:50:35.882Z
---

## Summary

Two T3 cases timed out in the E-1537 stage-2 macOS cover 14cf91c6. It ran on dev 8efd8f0aa (log A-19218), local darwin arm64, 1 worker, peak 1-minute load 7.47. Both cases pass alone 5/5. Their wall-clock setup bounds are too tight for a loaded full run.

## Evidence

- `hub/test/session-native-lifecycle.test.ts` "an Implementer pool moves to the next task worktree after merge (opencode, keep_context=true)": `Error: no result for session.launch within 5000ms` (harness.ts:709). Alone five times on 2026-11-13 21:04Z under the preservation lock, it passed 5/5 in 5.9–8.0 s each. The lone run already exceeds the 5 s reply bound's margin on some machines. A sibling case (keep_context=false) failed the same way in the loaded batch 35865a52 (A-19192).
- `hub/test/suite-recovery.test.ts` "cancel removes an admitted worker's compatibility FIFO ticket without releasing a racing hand holder": `admitted worker has a legacy FIFO ticket: not within 15000 ms` (line 338), 30.9 s against a 2.0 s baseline. Alone five times at 21:03Z, it passed 5/5 in 2.1–2.8 s each.

## What to build

Each case's setup wait uses the shared `testWaitMs()` scaling, or a named bound sized for a loaded full T3 run, so a slow machine no longer reads as a product failure. Each behaviour bound the case asserts stays exact and named. The cause of each slow path under load is named on this item: launch reply latency, and FIFO ticket observation.

## Acceptance criteria

- [x] C1. The session.launch reply wait in session-native-lifecycle and the FIFO-ticket wait in suite-recovery use scaled or named setup bounds, and every behaviour bound they assert stays exact (test).
  - done: impl-1846 · 2026-11-14T01:26:57.172Z
  - verified: rev-36 [reviewer] · run rev-36-1846-source-2 · 2026-11-14T01:33:56.242Z · commit cbbd6aacfe4c7415f53ffed25c92a5af15c986f9
  - verified: rev-36 [reviewer] · run rev-36-1846-source-3 · 2026-11-14T02:12:14.814Z · commit 93a59bd723082da086ba67f7c5026245da542386
  - verified: rev-36 [reviewer] · run rev-36-1846-final-1 · 2026-11-14T02:43:15.801Z · commit 93a59bd723082da086ba67f7c5026245da542386
- [x] C2. All three cases pass five lone repetitions on macOS and the task's mode-free verify, and the slow path under load for each is recorded on this item (test).
  - done: impl-1846 · 2026-11-14T02:40:46.721Z
  - verified: rev-36 [reviewer] · run rev-36-1846-final-1 · 2026-11-14T02:43:15.801Z · commit 93a59bd723082da086ba67f7c5026245da542386

## Comments

### coord · 2026-11-13T22:48:01.523Z

Third identity of the same class: hub/test/suite-timeouts.test.ts 'verify reports unverified fast-exit pipe cleanup once, preserves unrelated processes and admits its successor' failed in T-1842's local batch 08c287d6 (A-19229, 1 worker, peak load 5.26). The error was 'fast pipe holder started after snapshot: not within 15000 ms' (line 389), and the case took 18.8 s. Alone five times at 0b506cd2e (2026-11-13 22:47Z) it passed 5/5 in 8.3-10.3 s each. Even lone runs approach the 10 s T3 default.

### coord · 2026-11-14T01:16:17.930Z

Moved into R-1530 by ask 96990fef, answered 2026-11-14 01:16Z: land the test-timing fixes locally, then rerun the E-1537 stage-2 macOS cover.

### impl-1846 · 2026-11-14T01:25:36.818Z

Red evidence: A-19218 (dev 8efd8f0, local macOS arm64, one worker, peak load 7.47) says "Error: no result for session.launch within 5000ms" and "Error: admitted worker has a legacy FIFO ticket: not within 15000 ms"; case duration 30.871430375s. A-19229 (nested batch 08c287d6, local macOS one worker, peak load 5.26) says "Error: fast pipe holder started after snapshot: not within 15000 ms"; case duration 18.753894709s. Native launch waits on worktree creation/native discovery. FIFO fixture held a 3000ms production self-identity probe: under load it can expire before release, so a longer observation alone cannot recover it. The 30.85s figure is a 15s timeout plus setup/teardown, not a measured slow acquisition. Moved its barrier to immediately before queue creation. Pipe-holder startup waits for the pre-child snapshot; parent and outer setup now share 45s. No production change, ordering or ownership assertions removed. Five lone fresh-process repetitions now pass for both OpenCode settings, FIFO cancellation and denied-census fast exit on Node24.21.0 darwin arm64; targeted evidence only, full T3 remains Coordinator landing evidence.

### rev-36 · 2026-11-14T01:31:29.799Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1846-source-1
commit: cb286380461d59410a4b80444131c479b3793f55
scope: full
findings: [{"severity":"medium","text":"The Codex keep_context=false cap/reason uses3.673796583s as worst, omitting retained passing4.377601875s in A-19229. The Coordinator's native2.5× rounded-up brief yields11s, not10s. Correct cap/reason and retain both sample/head/artifact references; the author confirmed this arithmetic. No other source defect found.","file":"hub/test/durations.json","line":15663}]
finding_counts: {"high":0,"medium":1,"low":0}

Pinned full source pass complete, not clear for one medium allowance-evidence correction. Test setup changes preserve exact behaviour bounds and all lifecycle/ownership/cancellation assertions; no other source finding. Artifact records Standards/Spec separately. A-19242 retained replay/linkage will be assessed with corrected pin/final evidence; no tests rerun by reviewer. Commit repair/request fresh review before mode-free verify; full T3 remains Coordinator landing evidence, Linux unexecuted.

Criteria: C2 failed (Retained native sample accounting is incomplete in the pinned allowance; corrected-source review and mode-free receipt remain required.).

### rev-36 · 2026-11-14T01:33:56.242Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1846-source-2
commit: cbbd6aacfe4c7415f53ffed25c92a5af15c986f9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, zero Standards/Spec findings. Prior medium resolved: Codex false11s and correct worst/both retained samples; only duration manifest changed after source1. A-19244 retained-data replay35 samples has no report/projection failures; projection is not enforcement or test execution. C1 source verified; C2 stays run-dependent until exact-head mode-free receipt and restored implementation mark. A-19239/A-19242 targeted proof retains working-tree/constant-naming linkage, completion/signal capture and top-level inventory limits. No reviewer execution/source change. FullT3 Coordinator landing evidence and Linux unexecuted; no broadT3/provenance-only rerun requested.

Criteria: C1 verified.

### rev-36 · 2026-11-14T01:55:31.157Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1846-evidence-1
commit: cbbd6aacfe4c7415f53ffed25c92a5af15c986f9
scope: evidence
findings: [{"severity":"medium","text":"Required mode-free run efd3b0fb/A-19248 fails the changed fast-exit setup: 'fast pipe holder started after snapshot: not within45000 ms', case48.704945917s. The missing positive holder receipt is still unresolved; this is a functional failure, not advisory timing. Diagnose retained failure evidence and request fresh source review after repair before another verify.","file":"hub/test/suite-timeouts.test.ts","line":393}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. Exact A-19248 failed finish/error independently read; OpenCode both settings and FIFO pass, fast-exit fails. T0/T1/fallbackT2 green; changedT3 red38pass/1fail; Web and remainingT3/T4 unexecuted. Aggregate5944pass/1fail, no skip/cancel;125 load passes separate. Local darwinarm64 Node24.21/Nvim0.12.5, browser unknown/unexecuted, report-only budgets/lints retained. C1 source verification remains valid. No reviewer execution or shared-defect/retry classification inferred.

Criteria: C2 failed (Mode-free same-head efd3b0fb fails fast-exit holder setup after45000ms; lone greens do not satisfy the required configured pass.).

### impl-1846 · 2026-11-14T02:05:21.666Z

A-19248 remains red: fast pipe-holder setup did not complete within 45000ms, failed48.704945917s. Exact producer stopping point is inferred, not proven: its disposed fixture contents were not retained. Two instrumented full-file diagnostic runs subsequently passed; neither proves the original cause. Coordinator34662886 accepted removing the setup dependency on successful periodic product observation: parent explicitly requests a pre-child native ps snapshot, wrapper freezes only while parent lives, returns fresh rows after observed real parent exit; heartbeat during async snapshot request keeps setup outside the 3s silence deadline. Setup now shared testWaitMs() default15s, exact3s stall/30s cleanup/20s result preserved. Permanent failure-only diagnostics retain job id, armed/snapshot facts, native completion or missing, bounded redacted log tail. Product observation swallowing inspection errors reported separately at suite-command.ts:45 (S Bugs). One accidental three-file targeted concurrency interval is excluded from requested paired evidence; no full suite was started.

### rev-36 · 2026-11-14T02:12:14.814Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1846-source-3
commit: 93a59bd723082da086ba67f7c5026245da542386
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, zero Standards/Spec findings. Coordinator34662886 fixture-owned pre-child native snapshot removes periodic observation dependency, keeps setup heartbeat/default15s and exact3s/30s/20s behaviour bounds. Product census/refusal/cleanup/warning/mute/journal/successor paths and assertions preserved; bounded failure-only diagnostics permanent. A-19250 test-source hash independently equals commit;5/5 lone+correct pair close0/signalnull supporting, inventories qualified under22b32e43.56 passing retained samples reconcile eight caps/report-only checker projection; failed48.705s excluded. C1 current-source verified; C2 pending exact-head mode-free receipt/restored done mark. A-19248 remains red and cause inferred, T-1848 separate. No reviewer execution; fullT3 landing/Linux unexecuted.

Criteria: C1 verified.

### rev-36 · 2026-11-14T02:43:15.801Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1846-final-1
commit: 93a59bd723082da086ba67f7c5026245da542386
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C2 verified. A-19255 independently records6293 base passes/694 file passes, separate125 load outcomes and all39 affectedT3 identities/three file finishes. Named OpenCode true/false,FIFO and repaired fast-exit all pass; supporting5/5 native receipts/source linkage and qualified inventories assessed in A-19239/A-19242/A-19250. C2 done restored/current. Source proof remains A-19251; claimant final reconciliation A-19256 agrees. Local darwinarm64 Node24.21/Nvim0.12.5,isolated HeadlessShell1248/CfT156 attested; T0/T1/fallbackT2/changedT3/Web green,report-only advisories retained. A-19248 stays red,original fast-exit cause inferred,T-1848 separate. Full remainingT3/T4/Linux unexecuted; Coordinator landing/per-itemQA-none boundaries retained. No reviewer execution or further run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-14T03:50:35.882Z

Merged 7fbbf283a96622892bb95f2875e7a037ea29dea7 onto dev.
