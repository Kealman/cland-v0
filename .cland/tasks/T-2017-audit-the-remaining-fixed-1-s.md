---
id: T-2017
kind: task
title: "Audit the remaining fixed 1 s FrameClient setup waits: product bounds versus setup headroom"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1768
branch: t/T-2017-audit-the-remaining-fixed-1-s
created: 2026-11-20T00:16:34.111Z
updated: 2026-11-25T05:43:43.083Z
closed: 2026-11-25T05:43:43.083Z
---

## Summary

T-1875 made FrameClient `request` and `waitFor` cancellable and moved card-web's inner receipts onto the shared load-scaled wait. Its caller sweep (A-21962) found more callers that still keep fixed real 1 s setup waits:
- hosts-state, executor-liveness, opencode-native, fixture-endpoints and remote-workbench;
- the Telegram tests: approvals, liveness, catchup, pairing, users and the liveness fixture;
- config-set, item-summary, suite-retention-scale and discord-artifacts.

They are compatible and unchanged, but each fixed bound is a candidate load flake.

## What to build

Audit each caller and classify every fixed bound as either a product bound, which stays, or setup headroom. Move setup headroom onto the shared load-scaled wait with fixture-owned cancellation and a named reason. Keep every assertion unchanged.

## Acceptance criteria

- [x] C1. Every listed caller's fixed bound is classified as product or setup in a published inventory, with a reason for each (evidence).
  - done: impl-2017 · 2026-11-25T02:14:23.285Z
  - verified: rev-35 [reviewer] · run rev-35-2017-source-1 · 2026-11-25T02:22:36.651Z · commit 51490e3f10a5c2a1d33e9ad8768b2714bd3c85fe
  - verified: rev-40 [reviewer] · run rev-40-20261125-2017-source2 · 2026-11-25T02:35:51.042Z · commit 293e7aa966f45e85062063317d264f438b92042d
  - verified: rev-40 [reviewer] · run rev-40-20261125-2017-source3 · 2026-11-25T02:49:38.529Z · commit ccf4818de8841e84d5ac0c647fc41076dec3a082
  - verified: rev-40 [reviewer] · run rev-40-20261125-2017-final · 2026-11-25T04:27:54.502Z · commit ccf4818de8841e84d5ac0c647fc41076dec3a082
- [x] C2. Setup bounds use the shared load-scaled wait with teardown cancellation, and the touched files pass at a 1-minute load of at least 8 (test).
  - done: impl-2017 · 2026-11-25T02:44:16.859Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-2017-source3 · 2026-11-25T02:49:38.529Z · commit ccf4818de8841e84d5ac0c647fc41076dec3a082
  - verified: rev-40 [reviewer] · run rev-40-20261125-2017-final · 2026-11-25T04:27:54.502Z · commit ccf4818de8841e84d5ac0c647fc41076dec3a082

## Comments

### impl-2017 · 2026-11-25T02:12:48.318Z

Consumer inventory before additive SocketClient.next cancellation: rg connectSocket|SocketClient across hub/nvim/web/docs/skills found harness.ts; hub/src/test-lint.ts; tests hosts-state, tracker-component, progress, harness-framing, session-brief-component, suite-admission-close, host-secret-admission, session-brief, session-credential-io, subscriptions, remote-workbench, item-summary-lua-fixture, adapter-composition, request-guard-component, artifact-lifecycle, project-clock, fake-harness, tracker, topics-component, session-async-processes-lifecycle, verify-all, topic-withdraw, scenarios/hub-lifecycle, roles-component, edges-component, daemon, connection-snapshot, startup-replies-scale, name-reservation; durations.json and harness-framing per-file docs. Existing one-argument/default readers keep exact signatures and behaviour; five audited next sites migrate with signal. No production or wire contract changes; previous protocol-2 shape regression stays in hosts-state/remote-workbench.

### rev-35 · 2026-11-25T02:22:36.956Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2017-source-1
commit: 51490e3f10a5c2a1d33e9ad8768b2714bd3c85fe
scope: full
findings: [{"severity":"medium","text":"Both new controls lack pre-acquisition whole-callback ownership, separately bounded setup and positive-close restoration fences; socket acquisition cleanup registers after connect and mock timers reset only on success.","file":"hub/test/connection-snapshot.test.ts","line":19},{"severity":"medium","text":"Receipt abort observes TestContext/private teardown only, not explicit enclosing fixture disposal. Earlier fixture closers may join a receipt before its later onCleanup abort; liveness start continuation is not fully joined.","file":"hub/test/setup-frames.ts","line":22}]
finding_counts: {"high":0,"medium":2,"low":0}

A-23167: C1 inventory independently verified:42 classified sites,39 setup migrated,3 exact unchanged retention product bounds. M1/M2 confirmed by retained-source answers. Hold positively released for consolidated correction; preserve all assertions and classifications, add deterministic cancellation/dispose controls, then fresh committed source review. Loaded C2 evidence remains required before configured verify.

Criteria: C2 failed (New controls lack whole-case ownership and migrated waits miss explicit owner-dispose cancellation/join; loaded>=8 touched-file proof also remains pending.).

### impl-2017 · 2026-11-25T02:28:22.380Z

Corrected head 293e7aa966f45e85062063317d264f438b92042d addresses source review A-23167 M1/M2. New explicit-disposal regression showed red: `explicit disposal completion receipt: deadline exceeded after 5000 ms`; old wrapper ignored enclosing signal and waited for its independent deadline. Green after optional enclosing-signal forwarding: 42/42 focused cases across connection-snapshot, telegram-liveness and discord-artifacts. Whole callbacks use receiptFixtureCase before setup, native-launch positive guard, separate named setup observations, owned late socket acquisition/closed receipt and timer restoration after receipt-owner close. Explicit-dispose control retains a held original cancellation continuation and observes disposal only after it joins. Telegram fixture now joins full acquire/subscribe continuation; its outer failure-to-dispose wrapper remains outside that join to prevent a cycle. Shared wrapper consumer search covers all 39 inventoried setup sites; existing 3-argument forms retain defaults, explicit-owner sites pass the fourth signal. Typecheck exit 0; full lint and C2 loaded proof pending. No configured verification receipt claimed.

### rev-40 · 2026-11-25T02:35:50.795Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-2017-source2
commit: 293e7aa966f45e85062063317d264f438b92042d
scope: full
findings: [{"severity":"medium","text":"M1-R: new callbacks inherit unfenced fixtureNativeGuard/proxy cleanup, which continues to guard restoration after resource/hub close rejection; body joining alone is not positive-success fencing.","file":"hub/test/receipt-fixture-case.ts","line":20}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear: residual originalM1 at receipt-fixture-case.ts:20, confirmed bdb6305b/24ae9d0d. New callbacks require positive-success proxy fencing and deterministic rejected-close/repair control; T-1979 affects a different helper and does not supply it here. M2 signal forwarding/full acquire+subscribe join is corrected, as are setup ownership/late-socket closure/timer-finally parts ofM1. C1 inventory42sites/39setup/3exactproduct rechecked unchanged and can be separately verified at this head. Loaded C2 sub-evidence A-23178 independently has14 files all native0/null, complete positive summaries/zero failures/skips and CPU progress at startload8.159–11.133; C2 still failed for closure ordering. Preserve all classifications/assertions and assess changed-head loaded freshness after correction. No Reviewer runs or configured proof. A-23183: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23183-t-2017-corrected-source-not-clear-at-293e7aa96.md.

Criteria: C2 failed (New controls still restore the native guard after rejected proxy resource/hub close; add explicit success fence and actual rejected-close/repair proof (M1-R).).

### rev-40 · 2026-11-25T02:49:38.529Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2017-source3
commit: ccf4818de8841e84d5ac0c647fc41076dec3a082
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear; no findings. A-23203 records Standards/Spec review and the M1-R closure: explicit proxy success fences plus actual rejected-close/root+guard retention/same-owner repair control; M2 owner signals/full continuation joins and original assertions preserved. C1: unchanged 42-site inventory A-23163 verified. C2: independently read fresh A-23193 connection-snapshot17/17 at load1 8.239 and Telegram-liveness12/12 at9.021, native0/null, complete summaries/positive CPU progress; approved prior-head A-23178/A-23179 reused for twelve byte-identical files, not a fresh14-file run. macOSarm64 Node24.21, no browser. Entire correction diff confirms only two tests and guide changed. T-2096 owns shared default/comment audit. Configured exact-head verification remains pending; this source pass does not establish T3/T4/Web coverage or final suite clearance. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified.

### rev-40 · 2026-11-25T04:27:54.502Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2017-final
commit: ccf4818de8841e84d5ac0c647fc41076dec3a082
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-23253. Exact-head00b0129d/A-23252 passed; canonical2f944183 executable match. C1 unchanged42-site classified inventory. C2 prior audited macOS>=8loaded proof retains explicit fresh2file/prior-head12byte-identical mapping; configuredLinux receipt is additional proof, not replacement for loaded admission. All14 touched files have structured passing base outcomes; all5new cleanup/cancellation/disposal controls have separate5/5 load receipts. Exact refusal/retention/repair and original receipt assertions retained. Actual T0/all247T1/fallback448T2/selected241T3/55Web exit0; T4unexecuted/remainingcoveragebatch. NoncachedLinuxx64 c8fra1 workers2 Node24.21/Nvim.12.5 HeadlessShell1248/CfT156.0.8078.4.12prerequisite skips and report-only budgets retained. T-2096 remains shareddefault follow-up. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T05:43:43.083Z

Merged b7252dbab1c4e4f60e868056fb2545bd019b311a onto dev.
