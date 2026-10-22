---
id: T-1152
kind: task
title: Hub start spends 16 s silent between binding listeners and restoring sessions when a lease needs recovery
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-865
branch: t/T-1152-hub-start-spends-16-s-silent-between
created: 2026-10-22T18:04:51.408Z
updated: 2026-10-22T20:11:16.233Z
---

## Summary

At hub restart #46 the new hub logged "binding listeners" at 18:02:28.83Z and "restoring sessions" at 18:02:44.89Z, a 16 s gap. Only one explorer recompute, one archive sweep and one claude-schedule event fell in it, so this is not the T-1104 storm. The first executor events after serving were executor-reconcile-failed "lease recovery deferred" (18:03:01.99Z) and executor-sweep leases 1 / failures 1 (18:03:05Z). The suspect is synchronous recovery of the lease orphaned by T-1151's stop, a provider call before sessions are restored. With the stop's 26 s, the mod bridge gap reached 46.7 s of its 60 s grace.

## What to build

Startup restores sessions without waiting on executor lease recovery or any provider call. Recovery runs after serving, and the startup steps log their durations so a gap names its cause.

## Acceptance criteria

- [x] C1. A hub start with a recorded lease whose provider calls hang reaches "restoring sessions" and serving within 2 s of listening, and recovery completes or defers afterwards (test).
  - done: impl-1152 · 2026-10-22T19:59:43.732Z
  - verified: rev-23 [reviewer] · run rev-20261022-1152-final · 2026-10-22T20:11:16.154Z · commit 0db9a720911633bf5dd442c7d19f293de86a7b2e
- [x] C2. Each startup step between listening and serving logs its duration (test).
  - done: impl-1152 · 2026-10-22T19:43:36.552Z
  - verified: rev-23 [reviewer] · run rev-20261022-1152-final · 2026-10-22T20:11:16.155Z · commit 0db9a720911633bf5dd442c7d19f293de86a7b2e

## Comments

### impl-1152 · 2026-10-22T19:41:51.324Z

TDD local Darwin/arm64 worktree evidence: the hanging scripted-provider fixture served on the baseline (7.171 ms listening→serving), so it does not reproduce the incident's 16 s delay. With recovery-admission diagnostics present, RED failed `recovery admission is logged after serving` against eager constructor admission. Deferred admission GREEN: startup-ready-component.test.ts 4/4. Second RED lacked named web-listener/discovery steps; GREEN adds monotonic completion durations, 5/5 targeted tests. No live hub/provider used. Full verification is pending exact-head source review.

### rev-23 · 2026-10-22T19:48:52.240Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1152-source
commit: e3bc4196d2ef1c4495da08e65efe8669afd73ecb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-9430 reviews the complete ten-file delta from 78fb39f5: recovery admission follows serving in listener and stdio paths; early close releases the unadmitted gate after marking closed; named startup completion events use monotonic durations; held-provider tests retain exact observable boundaries, final assertions and cleanup. Matching help/docs/skill provenance updated. C1/C2 are run-dependent and remain unverified pending configured mode-free evidence at this exact head. A-9426 is local precommit targeted evidence only. Its baseline already served in 7.171 ms, so the live 16-second delay was not reproduced and its cause remains unproven. No tests executed by Reviewer. Coordinator landing freeze remains in force.

### impl-1152 · 2026-10-22T19:58:23.429Z

Same-head verification b501ab8d-f8fd-4542-80de-5f391e044733 passed at reviewed e3bc4196d2ef1c4495da08e65efe8669afd73ecb: auto exit 0, 2527/2527 tests; T0 check/host gate, all T1 plus all T2 (fallback for skill path), Web. Linux x64 droplet c-8 lon1, Node v24.21.0; machine lifetime 504 s, cost $0.0350. Duration/test-lint gates report only; reported budget overruns and missing baselines are not enforce passes. T3 absent from task selection/configured batch tiers and deferred to periodic/integrated occasions; no T4 receipt. Durable evidence A-9434 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9434-suite-b501ab8d-f8fd-4542-80de-5f391e044733-auto-at-e3bc419.log). Branch remains unchanged and clean; waiting for Reviewer final same-head settlement. No merge; dev freeze respected.

### impl-1152 · 2026-10-22T19:59:17.584Z

Detailed A-9434 inspection found a new report-only tier mismatch: `startup restores sessions and serves ... tier T2 resource child_process.spawn`; stack doctor/report.ts:85 → hub/lock.ts:72/90. Executor locks used native ps because droplet.processes was omitted. Targeted RED on local Darwin/arm64 with the T2 tripwire enforced exited 1 on that exact child_process.spawn despite the assertion test passing. Injected synthetic executor lock process facts; GREEN runs all 5 startup-ready-component tests with the T2 tripwire enforced, exit 0, no mismatch. Hub typecheck and diff check pass. Docs name the process-facts injection. Requesting fresh source review before another exact-head mode-free verify; old e3bc4196 receipt is not new-head evidence.

### rev-23 · 2026-10-22T19:59:24.579Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1152-evidence
commit: e3bc4196d2ef1c4495da08e65efe8669afd73ecb
scope: evidence
findings: [{"severity":"medium","text":"Missing DropletDependencies.processes lets recovery lock ownership invoke native child_process.spawn in the sealed T2 fixture; A-9434:11746 reports the task-owned mismatch. Inject synthetic process facts and re-review/reverify the corrected head.","file":"hub/test/startup-ready-component.test.ts","line":63}]
finding_counts: {"high":0,"medium":1,"low":0}

A-9435 records the evidence audit. A-9434/b501ab8d is exit 0 at this head: 2527 ordinary passes, T1/all fallback T2/Web, Linux x64 c-8 lon1; both new identities have five distinct repeated passes. However the exact new provider case reports T2 child_process.spawn at doctor/report.ts:85 -> hub/lock.ts:72/90, mode report-only. Suite success did not enforce this isolation gap. C1 failed; no final ready. C2 assertions pass but final marks remain pending corrected-head review/evidence. Host check 526a5eec reused remotely; generic budget/lint/ratchet/resource diagnostics report-only; T3/T4 absent. Production startup ordering is unchanged; historical 16-second cause remains unproven.

Criteria: C1 failed (Held-provider assertions pass, but the new T2 fixture falls back to native process inspection (A-9434:11746); synthetic executor lock facts and corrected-head evidence are required.).

### rev-23 · 2026-10-22T20:00:15.083Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1152-source-2
commit: 0db9a720911633bf5dd442c7d19f293de86a7b2e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-9435 medium fixture finding resolved. The only changes from e3bc4196 inject synthetic executor lock process facts in the held-provider test and document that seam. Current PID stays live with unknown start identity; executor/spend lock dependencies use the injected table instead of native ps. Production source, bounds, cleanup and final assertions are unchanged; A-9430 production review retained. C1/C2 remain run-dependent and unverified pending fresh configured verification at this exact head. A-9434 is old-head passing evidence only. No Reviewer test execution; historical 16-second cause remains unproven. Detailed corrected-head audit is the artifact posted in topic-865.

### impl-1152 · 2026-10-22T20:10:43.208Z

Corrected-head verification 9505067f-5d9e-49dc-9256-7a8678dd6bc3 passed at reviewed 0db9a720911633bf5dd442c7d19f293de86a7b2e: exit 0, 2527/2527; T0 host check (tree 6cf7964637333091f65a247d3977685305246f32, not repeated remotely), all T1, fallback all T2 in both packages, Web. Linux x64 droplet c-8 lon1 / Node v24.21.0 / Neovim v0.12.5; lifetime 571 s, cost $0.0396. A-9443 detailed audit: zero startup-ready-component tier mismatches; both new tests 5/5 load repetitions passed. Generic duration/lint/ratchet/resource gates remain report-only, with reported unrelated overruns/missing baselines; T3/T4 absent. Local targeted fixture tests additionally passed with T2 resource tripwire enforced before this head was committed. Clean unchanged branch; awaiting Reviewer same-head final settlement. No merge.

### rev-23 · 2026-10-22T20:11:16.155Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1152-final
commit: 0db9a720911633bf5dd442c7d19f293de86a7b2e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified against exact-head A-9443/9505067f plus source A-9437. Actual Linux x64 c-8 lon1 all T1/fallback hub+Neovim T2/Web passed: 2527 ordinary tests, zero fail/skip/cancel. Both new startup identities have five distinct repeated passes and explicit 5/5 receipts. C1 held-provider listening-to-serving diagnostic is 12.805 ms against unscaled 2000 ms, retaining restoration, held status reply and durable recovery completion assertions. C2 named monotonic phase-duration assertions pass. No startup-ready-component tier mismatch remains after synthetic process-table correction. Host check 6cf7964 reused, not remote repeated; generic timing/lint/ratchet/resource diagnostics report-only, Web 64.52 s > 40 s report budget, T3/T4/QA absent. Historical 16-second cause remains unproven. Final evidence artifact posted in topic-865 records exact counts, identities and limits. Landing/freeze remains Coordinator-owned.

Criteria: C1 verified, C2 verified.
