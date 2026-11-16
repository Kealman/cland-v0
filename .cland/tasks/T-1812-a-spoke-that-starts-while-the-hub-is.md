---
id: T-1812
kind: task
title: "A spoke that starts while the hub is down never connects: no hub.json at startup means no endpoint for its lifetime"
state: closed
status: done
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1553
branch: t/T-1812-a-spoke-that-starts-while-the-hub-is
created: 2026-11-11T06:00:56.866Z
updated: 2026-11-16T15:11:27.730Z
closed: 2026-11-16T15:11:27.730Z
---

## Summary

`hub/src/spoke/spoke.ts` resolves discovery once at startup: `findDiscovery(cwd)` returns the nearest existing `.cland/hub.json`, and only then builds the `endpoint` closure that re-reads the file before every reconnect. If the spoke starts in the window where the hub has stopped and removed `hub.json` (a restart, or a session started while the hub is down), `discoveryFile` is null, no endpoint exists, and the spoke stays `hub: null` for the MCP transport's lifetime, even after the hub listens again. T-1811's diagnosis showed it: a relaunched Codex spoke initialized 22 ms after the fixture hub stopped and never connected, while the new hub listened 6 ms later (topic-1473, T-1811's C1 comment). Already-connected sessions are unaffected; they keep their endpoint and reconnect.

## What to build

When no discovery file exists at startup and no `CLAND_HUB_URL`/`CLAND_HUB_SECRET` is set, keep looking: resolve the project's discovery path (the nearest `.cland` directory walking up, or `CLAND_HUB_FILE`) and re-check for `hub.json` on the existing reconnect schedule, connecting once it appears. A cwd with no `.cland` anywhere above it keeps today's "not configured" answer. The session's tools answer the existing not-connected error until it connects.

## Acceptance criteria

- [x] C1. A spoke started in a project whose `.cland/hub.json` is absent connects, within the reconnect schedule, after a hub starts and writes `hub.json` (test).
  - done: impl-1812 · 2026-11-16T13:49:58.383Z
  - verified: rev-37 [reviewer] · run rev-37-1812-final-1 · 2026-11-16T14:20:41.687Z · commit a612f507f867e58c550fe07d0908f3a5d7937fec
- [x] C2. A spoke started where no `.cland` directory exists above its cwd still answers the not-configured error and never polls (test).
  - done: impl-1812 · 2026-11-16T13:46:16.191Z
  - verified: rev-37 [reviewer] · run rev-37-1812-final-1 · 2026-11-16T14:20:41.687Z · commit a612f507f867e58c550fe07d0908f3a5d7937fec
- [x] C3. A spoke with `CLAND_HUB_FILE` naming an absent file connects once that file appears (test).
  - done: impl-1812 · 2026-11-16T13:49:58.919Z
  - verified: rev-37 [reviewer] · run rev-37-1812-final-1 · 2026-11-16T14:20:41.687Z · commit a612f507f867e58c550fe07d0908f3a5d7937fec

## Comments

### impl-1812 · 2026-11-16T13:43:49.073Z

Red before fix at base  (macOS arm64, Node v24.21.0, local fake-hub T2): C1/C3 fail `AssertionError: a configured project retains its reconnecting client while discovery is absent`, actual null, expected true. C2 exact not-configured reply/no polling and existing C4 handlers passed. After fix the same file passes 4/4. No native hub/DB, browser, credentials or provider calls. Full verification not run yet.

### impl-1812 · 2026-11-16T13:45:17.803Z

Base for initial red: 66d8d54c6c5799f24a0b1553a9cbdf21095a508e (tests-only dirty tree). Consumer sweep: rg for new HubClient, HubClientOptions, findDiscovery( and describeOutage( across hub/nvim/shared/qa/.agents found production spoke.ts, hub-client.ts, project.ts; fixture harness.ts and T2 spoke-readiness/resilience-component. Existing endpoint/reply shapes and not-configured text unchanged; new guard only admits initially absent credentials to existing backoff, so no consumer migration or older-wire change. First origin/dev merge completed at 78393cf43 before source review. Per-item QA scope none; no brief required.

### rev-36 · 2026-11-16T13:48:37.172Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1812-source-1
commit: 8d57f9ac854451cf4d5eada77741723a79a15605
scope: full
findings: [{"severity":"medium","text":"New MCP/HubClient and stub-server cleanup at lines23/44 uses standalone t.after after tempProject's shared directory cleanup hook. No earlier owner joins them before root disposal on early failure. Register joined attempt-all closure in the shared resource phase as resources are acquired (claimant f99700f5 confirmed).","file":"hub/test/spoke-lazy-tools.test.ts","line":23},{"severity":"medium","text":"Pre-armed receipt starts an independent bounded poll and state listener before awaited writeFile/clock.advance, without failure-path cancellation/join/removal. A trigger failure leaves a later rejecting poll and listener during teardown. Record state synchronously, then await the bounded observation after successful trigger, removing the listener in finally (claimant confirmed).","file":"hub/test/spoke-lazy-tools.test.ts","line":51}]
finding_counts: {"high":0,"medium":2,"low":0}

Full pinned source review A-20107. Two Standards medium findings; no additional production/spec finding. Pending project/explicit discovery uses existing capped backoff, no-project remains unconfigured/no polling, contracts unchanged. Candidate-only A-20104 receipts and direct/shared/native consumer limitations retained. No Reviewer runtime. C2 remains unverified; no configured pass or ready claimed. Pin released for consolidated correction; fresh exact-head source review required before verify.

Criteria: C1 failed (New discovery proof has resource-before-directory and pre-armed wait ownership gaps on early failure.), C3 failed (Explicit absent-file proof shares the unsafe cleanup and unjoined receipt paths.).

### rev-37 · 2026-11-16T13:54:06.492Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1812-source-2
commit: a612f507f867e58c550fe07d0908f3a5d7937fec
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source review A-20114: Standards clear, Spec clear; no findings. Both A-20107 medium findings resolved by resource-phase attempt-all closure before directory disposal and synchronous prearmed welcome observation removed in finally, with bounded polling after successful publication/advance. Production retains pending project/explicit-file discovery through existing capped reconnect and preserves exact no-project error/no polling and existing admission. A-20104/A-20110 are qualified local candidate/excerpt evidence, not same-head configured verification. No Reviewer runtime; C1–C3 remain unverified pending configured evidence at a612f507f867e58c550fe07d0908f3a5d7937fec.

### impl-1812 · 2026-11-16T14:19:34.682Z

Configured run 8a8b3851 at unchanged reviewed a612f507f867e58c550fe07d0908f3a5d7937fec passed (A-20150). T0, all T1, fallback all T2, Web complete; 6417 aggregate passing outcomes include load repetitions, base phase counts 6230. C1/C2/C3 each have passing base case/file receipts and 5/5 load repetitions. Linux x64 droplet, Node24.21, Nvim0.12.5, isolated Chrome for Testing Headless Shell156.0.8078.4; lifetime1301s/$0.0904. Timing and lint gates report-only, notices retained. T3 merge batch and T4 integrated evidence deferred; no per-item QA. Reviewer evidence settlement requested, source/tree unchanged, claim retained until merge.

### rev-37 · 2026-11-16T14:20:41.687Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1812-final-1
commit: a612f507f867e58c550fe07d0908f3a5d7937fec
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear; C1–C3 verified. A-20155 independently reconciles run 8a8b3851/A-20150 head and canonical tree ec5b5c183484e62c06bdb0f9241efb8ab9a50151 to source-clear A-20114. All three exact criterion case names have ordinary pass plus five load-gate passes/explicit 5/5; existing C4 handler census and named preservation files pass. Host T0 and droplet all T1/fallback all T2/Web exit0; hub aggregate 6417/6417, no fail/cancel/skip/todo. Linux x64 c-8 sfo2 Node24.21.0/Nvim0.12.5; actual isolated Headless Shell1248/CfT156.0.8078.4, uncached. T3/T4 unexecuted/deferred, advisories report-only. Stream event scopes/counts qualified in artifact; no aggregate-repetitions inference. No Reviewer runtime or source changes. Standards clear; Spec clear; findings [].

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1812 · 2026-11-16T14:20:57.626Z

Count correction to my previous run summary: A-20155 independently records 6417 unscoped passing test-finish events and 704 unscoped file passes, separately 225 load-gate test/file passes. My earlier inference that aggregate 6417 included repetitions (from summed tier summaries) was unsupported and is withdrawn. C1–C3 each have ordinary pass + 5/5 scoped load passes. Final reviewer evidence clear rev-37-1812-final-1 verifies all criteria at a612f507f; hub status ready, no holds. Claim retained; no further source changes or merge by Implementer.

### coord · 2026-11-16T15:11:27.730Z

Merged 50bf074d8a41fad8c18da1181d0d5d8bab766bed onto dev.
