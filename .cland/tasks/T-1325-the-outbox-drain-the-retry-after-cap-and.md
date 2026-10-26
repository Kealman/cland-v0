---
id: T-1325
kind: task
title: The outbox drain, the retry_after cap and reconnection backoff
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by:
  - T-1324
topic: topic-1081
branch: t/T-1325-the-outbox-drain-the-retry-after-cap-and
created: 2026-10-26T02:28:47.280Z
updated: 2026-10-26T07:53:01.582Z
closed: 2026-10-26T07:53:01.582Z
---

## Summary

The outbox drains predictably: a job queued while a drain runs leaves in that drain, a platform `retry_after` wait is capped at 5 minutes, and reconnection backs off with jitter and a cap.

## What to build

Drain-loop semantics on top of the outbox: re-read the queue before the drain ends, so a job queued mid-drain is not left for the next trigger. Honour `retry_after` up to a 5-minute cap. Reconnect with exponential backoff, jitter and a stated ceiling, driven by an injected clock and random source so tests stay deterministic (no wall-clock waits). Spec §3.9.

## Acceptance criteria

- [x] C1. A job queued while the outbox drains leaves in that same drain (test).
  - done: impl-1325 · 2026-10-26T07:33:09.046Z
  - verified: rev-26 [reviewer] · run rev-20261026-1325-evidence-1 · 2026-10-26T07:47:18.257Z · commit a1f179a5f8800abf5123466e8c0e7b764bb51da6
- [x] C2. A `retry_after` above 5 minutes waits 5 minutes, and successive reconnect delays grow with jitter up to the stated cap, under an injected clock (test).
  - done: impl-1325 · 2026-10-26T07:33:09.132Z
  - verified: rev-26 [reviewer] · run rev-20261026-1325-evidence-1 · 2026-10-26T07:47:18.257Z · commit a1f179a5f8800abf5123466e8c0e7b764bb51da6

## Comments

### impl-1325 · 2026-10-26T07:10:58.248Z

Rule 20 consumer inventory before changing client contract: searched all hub/web/nvim/shared production + all test tiers, .agents shipped skills, qa briefs, docs and startup/probe sources for OutboxClient, DeliveryResult, remote/outbox, outboxMessenger, durable-remote-outbox and retry_after. Production contract is defined/consumed only by hub/src/remote/outbox.ts; state.ts persists jobs/attempts but no client results/delays. Consumers: hub/test/fakes/outbox-messenger.ts (extend fake recovery/rate-limit controls), hub/test/fakes/messenger.ts (inherits delivery fake; no new required fields), hub/test/outbox.test.ts (new timing/drain regressions and retain legacy shape tests), hub/test/outbox-gateway.test.ts (legacy no-reconnect frame outage regression, unchanged). Documentation: hub/README.md durable remote outbox, docs/agents/tests/hub-test-outbox.test.ts.md, .agents/skills/implement/SKILL.md + CHANGES will describe final semantics. docs/spec/v0.3.md is authoritative requirements, unchanged. No web/Neovim, startup probe, persisted-record reader, QA brief or T3/T4 uses the new client fields. Plan additive optional retryAfterMs on failure facts and optional reconnect callback; all existing result/client shapes remain supported and existing legacy-client regressions stay. No wire reply/schema/admission change or storage migration.

### rev-26 · 2026-10-26T07:26:02.649Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1325-source-1
commit: a3032759dc3545f436abc622033db0bdf5d07602
scope: full
findings: [{"severity":"medium","text":"M1 / Spec C1: #drain can return after its final empty read while #draining remains exposed until outer finally. A queued microtask arrival joins the old owner and is left queued. Close the completion handoff and add a deterministic final-read arrival regression.","file":"hub/src/remote/outbox.ts","line":54},{"severity":"medium","text":"M2 / Standards: held reconnect resolves only from the production abort listener, while registered dispose awaits outbox.stop before SQLite close. A failed abort leaves teardown unsettled. Register an independent fixture release before triggering, retain the actual abort assertion, and cover omitted-abort cleanup through the same disposer.","file":"hub/test/outbox.test.ts","line":361}]
finding_counts: {"high":0,"medium":2,"low":0}

Full Standards/Spec source audit recorded in A-12323. M1: final empty-read completion gap can strand an arrival joining the exposed drain owner. M2: held reconnect test resolves only on production abort; its registered disposer cannot independently release the exchange if that behavior regresses. C2 pacing looks consistent statically but runtime verification remains pending corrected fixture/source. No reviewer execution; A-12322 remains attributed local summary, not configured proof.

Criteria: C1 failed (M1: final empty-read arrival can join the finishing drain owner without being delivered.), C2 failed (M2: reconnect shutdown regression lacks independent release of its held exchange on abort failure.).

### rev-26 · 2026-10-26T07:30:47.948Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1325-source-2
commit: 8f41fdf31a45da74068efa5414d56ae4a84df381
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-12325. M1 resolved by explicit completion owner, enqueue revision recheck and synchronous clear/settle with the original visited set; final-read arrival and unknown-proof regressions retain exact shared-owner/delivery/attempt assertions. M2 resolved by independently preowned held-reconnect release, registered disposer joining stop/exchange before SQLite close, and bounded omitted-abort control without fabricated abort receipt. All corrections and carried source audited in-session; no reviewer execution. A-12324 remains attributed focused local evidence, not configured proof. C1/C2 runtime marks await one exact-head mode-free configured result and original timing/load records; Coordinator integrated cover/landing remains separate.

### rev-26 · 2026-10-26T07:32:17.276Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1325-admission-1
commit: 8f41fdf31a45da74068efa5414d56ae4a84df381
scope: evidence
findings: [{"severity":"medium","text":"M3: new direct process-cleanup.ts import is machine-tier classified, so the existing T1 outbox file fails verify-tiers before execution. Preserve unconditional independent disposal with an appropriate T1 ownership seam; retain guard strength and T1 cases.","file":"hub/test/outbox.test.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

Pre-execution tier refusal documented in A-12326. Hub e124d91a refused verify-tiers; no admitted run or runtime proof. Direct onCleanup import from process-cleanup.ts is explicitly machine-tier classified by the existing direct lexical guard. I missed this restriction in source-2. M1/M2 behavior remains statically corrected; preserve those assertions and pre-acquisition/SQLite-last ownership using a suitable T1 seam, then fresh corrected-head source review before retry. Do not promote deterministic tests or relax the guard.

Criteria: C2 failed (M3: the clocked fixture's direct process-cleanup import refuses T1 admission; no configured runtime evidence.).

### rev-26 · 2026-10-26T07:33:59.225Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1325-source-3
commit: a1f179a5f8800abf5123466e8c0e7b764bb51da6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source settlement clear, A-12327, carrying A-12325's M1/M2 audit. M3 resolved by direct TestContext.after(dispose) before tempProject and its later directory cleanup hook; independent release, drain/stop join, SQLite-last ordering and every behavioral assertion remain unchanged. Coordinator decision c70c84b1 independently read; no tier/guard change or import masking. Entire two-file correction inspected; no reviewer execution. Local 25/25/typecheck/tiers results remain attributed claims, not configured proof. A-12326 remains the prior pre-execution refusal. C1/C2 runtime marks await one exact-head mode-free configured result.

### rev-26 · 2026-10-26T07:47:18.257Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1325-evidence-1
commit: a1f179a5f8800abf5123466e8c0e7b764bb51da6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, A-12329; original A-12328/run b6f964bb exits 0 at source-cleared a1f179a5f. Independently parsed 3395 ordinary test passes (nested included), 455 files, plus 60 separate actual load passes: 12 new outbox identities each 5/5. All 25 outbox cases pass. Exact C1 held-send/final-read/unknown-proof and C2 cap/jitter/reset/stop/omitted-abort/source-closure records checked; max new base .025750018 s, max load .052597473 s, no >=3 s Linux allowance needed. Legacy frame outage and docs guards pass. T0/all T1/fallback all T2/Web completed on Linux c-8 lon1, Node24.21/Neovim0.12.5/HeadlessShell156.0.8078.4 v1248; lifetime677 s/$0.0470 is executor accounting. No T3/T4; deferred configured scope. Host typecheck gate reused, not repeated remotely. Lint/budgets/missing baselines/ratchet remain report-only; no budget-clean or integrated-cover claim. Coordinator owns enqueue/landing and separate coverage.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-26T07:53:01.582Z

Merged 5b40498e29bb93cdf49a1625c8f9030c309b1f6a onto dev.
