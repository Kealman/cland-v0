---
id: T-1450
kind: task
title: Discord fixture's cold tempProject acquisition exceeds the 2 s exchange operation budget once on macOS
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1208
branch: t/T-1450-discord-fixture-s-cold-tempproject
created: 2026-10-29T18:19:08.852Z
updated: 2026-10-29T18:54:23.988Z
---

## Summary

The Discord hub fixture's first `tempProject` acquisition took over 2 s on an unloaded Mac, so the exchange run deadline fired before the test began. Find the slow cold-start phase and bound it from measured receipts, or move cold project setup outside the operation budget.

## Evidence

Observed by impl-1429 during T-1429, first targeted run of `hub/test/discord-messenger.test.ts` at dev 78d77a329 (macOS arm64, no extra load):

```
Error: Discord exchange operation incomplete
    at Object.run (hub/test/fakes/discord/exchange.ts:50:21)
    at Object.start (hub/test/fakes/discord/hub.ts:34:33)
    at TestContext.<anonymous> (hub/test/discord-messenger.test.ts:432:19)
```

Test "Discord hub fixture aborted held receipt joins writers before Store close": 3036 ms (process 3428 ms). `hub.ts:34` is `const root = await native.run(() => tempProject(t));`, which runs before hub acquisition or held-receipt setup. This is the run-operation deadline, not the disposal path T-1429 instrumented. The next identical run passed in 112 ms. No phase receipts existed at the time.

## Acceptance criteria

- [x] C1. The fixture records a timing receipt for the tempProject acquisition phase, and a failure names that phase and its elapsed time.
  - done: impl-1450 · 2026-10-29T18:26:14.789Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1450-final · 2026-10-29T18:50:26.011Z · commit 0611e564dcbb8af18c3ade6a075e2140502896f5
- [x] C2. The acquisition bound is sized from measured cold-start receipts on macOS (at least 10 fresh processes), or cold setup runs outside the 2 s exchange budget; the test passes 10/10 fresh-process repetitions under two workers plus CPU load on macOS.
  - done: impl-1450 · 2026-10-29T18:26:15.052Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1450-final · 2026-10-29T18:50:26.011Z · commit 0611e564dcbb8af18c3ade6a075e2140502896f5

## Comments

### impl-1450 · 2026-10-29T18:22:12.306Z

Consumer inventory before additive fixture contract change: discordHubFixtureOwner is used by discord-messenger.test.ts and doctor-remotes.test.ts; discordExchangeOwner.run is used throughout Discord API/messenger/card/artifact fixtures and tests (all existing calls retain 2 s default). Docs consumers are discord-messenger and discord-api per-file guides plus implement skill. No production wire/schema, persisted records, QA brief, startup probe, or T3/T4 contract is changed. New optional run bound and acquisition receipts are fixture-only; prior one-argument run calls remain the compatibility control. Plan: separately bounded 15 s cold tempProject phase with monotonic elapsed receipt and named error; keep all native exchange operations at 2 s. Deterministically hold acquisition past 2 s and prove successful setup; force failed acquisition and verify named elapsed receipt and drained cleanup.

### impl-1450 · 2026-10-29T18:25:57.319Z

C1/C2 implemented. TDD red: named-failure case initially failed with Missing expected rejection and receipt case with missing acquisitionReceipts. Additional sensitivity control restoring only the old 2 s bound failed as intended: Error: tempProject acquisition incomplete after 2065.7 ms (cause Discord exchange operation incomplete). Restored 15 s acquisition bound: 2/2 new cases green. Whole discord-messenger.test.ts 40/40 green locally; npm run typecheck green on macOS arm64 Node v24.21.0, no browser. Stress A-13938: 10 fresh processes, 2 workers plus 2 CPU threads, 3/3 cases each, 13.924 s wall, peak sampled load 4.8618. Full integrated evidence pending review/verify. No new test measured >=3 s on Linux yet; cold test deliberately holds 2050 ms. Exact unchanged one-argument run consumers: discord-api.test.ts, discord-messages.test.ts, discord-commands.test.ts, discord-artifacts.test.ts, discord-render.test.ts, discord-cards.test.ts, discord-inbound-media.test.ts, fakes/discord/hub.ts; fixture owner also doctor-remotes.test.ts. No production contract changed.

### rev-34 · 2026-10-29T18:28:21.424Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1450-source1
commit: c7fcd817676291bd548043e4dfa1829720cd0f2e
scope: full
findings: [{"severity":"medium","text":"M1: new 2050 ms setTimeout wait/elapsed assertion violates docs/agents/tests.md:422/439. Prove the acquisition/native deadline split with an owned receipt and complete injected Clock, preserving real frame and cleanup assertions plus unchanged native operation defaults.","file":"hub/test/discord-messenger.test.ts","line":419}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13943: Consolidated audit has sole Standards M1 and no independent Spec finding. Separate acquisition budget/phase receipts and compatibility are sound. Original macOS stress and first parser-failure limits retained; C1/C2 runtime remain unverified. Changed test source needs fresh review before verification.

### impl-1450 · 2026-10-29T18:28:47.812Z

Review M1 correction plan: retain additive per-call budget, add optional complete Clock only at that per-call deadline seam; acquisition uses its own complete monotonic/default clock, never the frozen hub scheduling clock. Test pre-owns an abort-aware acquisition gate, observes actual tempProject allocation before advancing its deadline clock past 2 s, then releases and requires real hub.status plus drained cleanup. Existing run callers keep real 2 s defaults. No production/shared wire/persistence consumer changes; prior inventory remains valid.

### rev-34 · 2026-10-29T18:31:58.126Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1450-source2
commit: c5d540b65e9acad13da24a23a851d1ba4a33932b
scope: full
findings: [{"severity":"medium","text":"M2: within(acquired.promise, 2000) covers real cold allocation and recreates the original too-short setup deadline. Give this pre-owned observer an independent acquisition-sized setup cap, preserving injected old-budget sensitivity and all assertions.","file":"hub/test/discord-messenger.test.ts","line":426}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13951: M1 resolved. Sole successor M2 recreates original real cold-setup failure in the allocation observer. Original A-13949 source hashes, ten 3/3 TAP/native passes and CPU progress/joins audited; local pass does not exercise >2 s natural allocation. Runtime criteria remain unverified.

### impl-1450 · 2026-10-29T18:32:45.367Z

M1/M2 corrections at 0611e564dcbb8af18c3ade6a075e2140502896f5: no new wall-clock wait; owned abort-aware allocation-return gate and complete acquisition deadline/timestamp Clock, separate 20 s observer for native startup + 15 s cold phase. Real hub.status and cleanup assertions preserved; existing native operation defaults unchanged. Whole messenger file 40/40 in 4.218 s; npm run typecheck green (local macOS arm64 Node v24.21.0). Final-head stress A-13952: 10/10 fresh processes, 3/3 exact generated cases each, 2 workers plus 2 CPU threads, 4.166 s wall, peak sampled 1-minute load 3.0864; source SHA256/TAP/native exits/CPU progress retained. Acquisition-control 2050 ms is injected time. Original held case acquisition receipts are warmed wall time. No browser or integrated suite yet. Earlier stress artifacts document earlier heads only.

### rev-34 · 2026-10-29T18:33:14.303Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1450-source3
commit: 0611e564dcbb8af18c3ade6a075e2140502896f5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13954: M1/M2 resolved. Setup observer now independently covers cold acquisition; operation defaults and injected sensitivity/frame/drain assertions retained. Original A-13952 source hashes, exact TAP 10×3 passes and CPU/native joins audited. C1/C2 runtime remain unverified pending exact-head configured result; no Linux/browser claim.

### rev-34 · 2026-10-29T18:50:26.011Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1450-final
commit: 0611e564dcbb8af18c3ade6a075e2140502896f5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13994: Original A-13991 independently confirms 4194 ordinary passes plus new acquisition cases ordinary+5/5 each; original writer/Store control and phase diagnostics pass. Exact-source macOS ten-process CPU proof retained. C1/C2 verified. Pre-admission dirty probe refusal, host reuse, browser path limit, report-only warnings and unrun T3/T4 preserved. Coordinator owns integration/enqueue.

Criteria: C1 verified, C2 verified.

### rev-34 · 2026-10-29T18:54:23.988Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1450-source4
commit: bd4eda53d3ac3031f13a1cfae02a0e9f4e951a18
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14001: Authorized merge resolution preserves both acquisition/drain receipt properties. Acquisition path, run function and T-1450 regression bodies byte-identical to reviewed parent; incoming disposal joins/fences/assertions retained. Coordinator conditional stress carry satisfied, prior receipts remain earlier-head only. Runtime criteria await fresh merged-head verification/final audit.
