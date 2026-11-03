---
id: T-1663
kind: task
title: Two release tests carry a 5 s per-test timeout that macOS T3 load exceeds; they take 1.7–2.6 s alone
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-1369
branch: t/T-1663-two-release-tests-carry-a-5-s-per-test
created: 2026-11-03T19:32:19.687Z
updated: 2026-11-03T20:20:34.940Z
closed: 2026-11-03T20:20:34.940Z
---

## Summary

`hub/test/release.test.ts` "release checks the committed dev package version before preview or publication" (line 132) and "release permits a package without a version key" (line 165) declare `{ timeout: 5_000 }`. Both were cancelled at 5000 ms in two consecutive E-1532 stage-3 macOS covers at dev a1cd8943: 75684387 (A-16320, peak load 14.4) and 79115353 (A-16325, peak load 13.6). They pass on Linux (a0392ad0, A-16321). Run alone on the same Mac at load about 4 (coord, 2026-11-03 ~19:30Z), the file passes 22/22, these two at 2.616 s and 1.665 s. The per-test timeout leaves no headroom for the macOS T3 load, which peaks around 13–14 since today's host-agent landings; earlier covers peaked around 9. This blocks the E-1532 stage-3 cover pair.

## What to build

Give these two cases timeouts with headroom, matching the file's other release cases, or make them faster by removing what dominates their time. Record the measured time under load in the item. Don't add a duration allowance.

## Acceptance criteria

- [x] C1. Both cases pass five load-gate repetitions locally on macOS under the package runner's alongside-phase load, with their measured times recorded, and their timeout leaves at least 2× headroom over the slowest repetition (test).
  - done: impl-1663 · 2026-11-03T19:36:02.437Z
  - verified: rev-35 [reviewer] · run rev-35-1663-final-1 · 2026-11-03T19:45:56.963Z · commit ba8cd04ae8a1dc9fcff5139322a4495dfebfb6bc

## Comments

### impl-1663 · 2026-11-03T19:33:51.640Z

Baseline (macOS arm64, Node 24.21.0, isolated archived ecd5c936c): target cases pass in 3362.665 and 1681.586 ms. Temporary setup instrumentation records project() at 1807.524 ms (cold prepared seed) and 175.131 ms (warm seed). Remaining native Git/publication work is shared with surrounding release cases; no avoidable wait was found. Removing the two unique 5 s overrides aligns them with every other case and the package runner's configured 120 s test timeout. No assertions or duration allowances change. Load proof is running with package runSuite/runLoadGate and its joint shared machine lease, two alongside lanes and five fresh-process repetitions per target. Copied reporter instrumentation only exports native duration receipts; it is absent from the source change.

### impl-1663 · 2026-11-03T19:36:10.754Z

C1 proof A-16326, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16326-t-1663-macos-normal-file-and-five-load-repetitions. macOS arm64 / Node 24.21.0 / local, ba8cd04ae source test bytes, shared package-runner machine lease. Normal file: 22/22 passed; targets 4873.387 and 3303.094 ms. Five alongside repetitions: committed-version case 3553.698, 4835.162, 5319.113, 5049.552, 5056.727 ms; unversioned-package case 3563.370, 4642.019, 5120.778, 4951.944, 4974.109 ms. Both 5/5 passed. Peak 1m load 3.87; suite wall 87.13 s, lock wait 0.02 s; configured inherited timeout 120 s =22.56x slowest repetition. Duration gate report mode, warnings preserved, no allowance. T0/other tiers/Web/droplet not part of this targeted proof. origin/dev fetched/merged before review (already current).

### rev-35 · 2026-11-03T19:37:31.031Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1663-source-1
commit: ba8cd04ae8a1dc9fcff5139322a4495dfebfb6bc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Exactly two5000ms overrides removed; assertions/fixtures/production/config/duration allowances unchanged. Source traced inherited configured120s via suiteLimits/run-suite, matching surrounding release cases. Read A-16326 normal22/22 and both5/5 exact scope=load-gate/native-PID records alongside ordinary file; slowest5.31911325s leaves22.56x headroom. Evidence is qualified archived parent+reviewed edits macOS arm64 Node24.21/local with copied reporter instrumentation, not exact-commit checkout or integrated-stage proof; peakload3.87 and scoped wall87.13s retained. No other tiers/Web/droplet/QA ran in that proof. C1 remains unverified in source-only verdict; exact-head configured verification then evidence settlement required. No Reviewer runtime checks/probes/edits/browser/delegation. QA none. Detail A-16327: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16327-t-1663-clear-source-review-inherited-release-test-timeout.md.

### rev-35 · 2026-11-03T19:45:56.963Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1663-final-1
commit: ba8cd04ae8a1dc9fcff5139322a4495dfebfb6bc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, no findings; C1 verified. A-16326 independently checked Mac normal22/22 and both exact targets5/5 alongside repetitions; native durations retained in A-16329. Slowest5.31911325s vs configured120s leaves22.56x headroom. Archived/source-equivalent Mac arm64 Node24.21/local proof, peakload3.87, not integrated-stage cover. Exact unchanged head run e3fe6d69/A-16328 passed1392/1392, no fail/cancel/skip/todo; target ordinary pass rows8563/8568 at1.948577167s/1.074855261s, all release22 pass. T0/allT1/changedT3 once/Web smoke5 completed; T2 selection empty, no T2 coverage claim; remainingT3 deferred, T4 none. Uncached Linuxx64 c-8sfo2 Node24.21/Nvim0.12.5 tree80cb301d08971d7a7641b0993140f8f2beb58acb; isolated HeadlessShell1248/ChromeForTesting156.0.8078.4; skips[]/missing0 report; duration/lint/ratchet report-only, no allowance added. Billing356s/$0.0247 not suite wall time. Stage-cover rerun after landing remains separate, QA none. No Reviewer runtime checks/probes/edits/browser/delegation. Detail A-16329: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16329-t-1663-final-clear-macos-repetition-headroom-and-linux-verification.md.

Criteria: C1 verified.

### coord · 2026-11-03T20:20:34.940Z

Merged be9ff456622e6c3a0b19c30110e7a0bf3ef1414d onto dev.
