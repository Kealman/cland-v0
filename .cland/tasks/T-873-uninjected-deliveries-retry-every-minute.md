---
id: T-873
kind: task
title: Uninjected deliveries retry every minute without bound and log every attempt, flooding hub.log
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - needs-triage
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-597
branch: t/T-873-uninjected-deliveries-retry-every-minute
created: 2026-10-19T12:24:05.900Z
updated: 2026-10-19T17:33:12.208Z
---

## Summary

While a session's bridge is down, the hub retries every uninjected message to it about once a minute and logs each attempt as `inject-unconfirmed`. After coord's bridge died at restart #18 (2026-10-19), hub.log grew by about 100 lines a minute: 1069 lines in 23 minutes from 100 distinct ids, the oldest retried 15 times. Reported by cland-impl at 12:23Z.

## Acceptance criteria

- [x] C1. Retries to a session whose bridge is down are bounded (backoff, or a stop until the bridge reconnects), and the log records one line per message per episode, not one per attempt. A test with a fake clock drives an hour of retries and counts the log lines.
  - done: impl-873 · 2026-10-19T17:14:00.498Z
  - verified: rev-31 [reviewer] · run rev-20261019-873-final-2 · 2026-10-19T17:33:11.598Z · commit fbf5c85f4ccf6a617a7d4ba5c860e2eecdb8c225

## Comments

### impl-873 · 2026-10-19T14:50:29.830Z

Investigating the existing T-867 delivery/recovery path. C1 is checkable locally through the adapter fake-clock regression before review/verification; no separate QA brief is required (qaPolicy scope none).

### rev-31 · 2026-10-19T14:55:25.465Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-873-source-1
commit: 15fcab264d6111a677b0113a5c0bf5830debb4b5
scope: full
findings: [{"severity":"medium","text":"M1: Two ordinary failures establish future retryAt; a reconnect bypass can then return InjectUncertain while preserving that backoff entry. Explicit session.retry changes uncertainty back to delivered and returns retried:true, but calls #inject without bypass, so the new deadline guard silently prevents adapter recovery. Clear ordinary-failure state on uncertainty or otherwise preserve immediate explicit retry, with a mixed-sequence regression.","file":"hub/src/adapters/sessions.ts","line":1498},{"severity":"medium","text":"M2: flight.sentAt now uses core.clock while native idle signal.at and #signal ordering remain transport realClock timestamps. An offset policy clock can misclassify delayed idles relative to an in-flight attempt. Preserve a consistent transport domain for flight ordering and cover distinct-clock delayed-idle behavior.","file":"hub/src/adapters/sessions.ts","line":1505}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear; A-6107 separates Standards M2 and Spec M1. Implementer confirmed both gaps in decision24e70fb3 and is adding regressions/fixes. Existing fake-hour and reconnect proofs do not cover explicit retry after ordinary failure→uncertain transition or delayed-idle ordering across distinct clocks. C1 failed; no verification on this head. Replacement committed head needs fresh source review.

Criteria: C1 failed (Automatic backoff can silently block explicit human recovery after an uncertain reconnect attempt; flight/idle ordering also mixes policy and transport timestamps.).

### impl-873 · 2026-10-19T14:56:26.249Z

Review findings reproduced with added regressions: explicit session.retry reported success with only three attempts (expected four) after failure→backoff→reconnect→uncertain; delayed old idle replayed an inject across policy/transport clock domains (two attempts instead of one). Fixed by clearing ordinary-failure state on uncertainty and retaining transport-time flight ordering. Changed file now 6/6 green (1.70s wall); Codex delivery 2/2 green (0.47s). No dev merge after first review.

### rev-31 · 2026-10-19T14:58:18.395Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-873-source-2
commit: 09ac40e5b467f406327caa484288164ec875d646
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-6116 records full two-axis review. M1 resolved by clearing ordinary-failure timer/backoff on InjectUncertain; mixed failure→backoff→reconnect→uncertain→explicit retry regression asserts immediate fourth injection without policy-time advancement. M2 resolved by restoring transport realClock flight timestamps and retaining core.clock only for backoff; delayed-idle regression uses distinct clock domains and keeps one-attempt assertion after the held failure receipt. Per-message capped backoff/log deduplication, direct/in-flight reconnect recovery and existing T-867 notice rules remain. New tests stay T2 with fake time/adapters, no new processes/sleeps. A-6113 reports both controls red→green, inject-stalled6/6 and codex-delivery2/2 plus typecheck/lint green. No remaining findings; C1 final execution verification awaits same-head mode-free task gate with positive owned receipts/budget checks. No dev merge after first review.

### impl-873 · 2026-10-19T14:58:37.200Z

Source review rev-20261019-873-source-2 clear at unchanged 09ac40e5b467f406327caa484288164ec875d646. Submitted mode-free configured verification 32637e62-3879-4c44-939a-e837163c17d6; admitted, project queue position 1, reports to Reviewer and item lead in topic-597. Waiting for hub result; no head changes.

### rev-31 · 2026-10-19T15:18:28.912Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-873-final
commit: 09ac40e5b467f406327caa484288164ec875d646
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6139 records independent A-6137/run32637e62 audit at exact source-2 head. 1562 ordinary pass outcomes, zero fail/cancel/skip; all482 admitted load gates5/5. All six inject-stalled cases pass ordinary plus5/5 each (30 repetitions), including fake-hour one-log/bounded-attempt controls and both A-6107 recovery regressions. Hour case1.341064765s; explicit retry0.208821958s; transport ordering0.155137973s; file test-seconds2.766049633s. All owned cases/file below T2 budgets and no owned runtime trip. C1 verified across source and positive same-head receipt. Full run's22 unrelated report-only budget identities and4 tripwire resource rows on one skills-onboarding push fixture are fully retained in A-6139 and reported Bugs/S to lead for deduplication; no external diagnosis/fix. Linux c-8 lon1, lifetime989s, cost$0.0687; native T3 landing evidence remains deferred. No additional task run needed.

Criteria: C1 verified.

### impl-873 · 2026-10-19T16:43:58.867Z

Coordinator authorized batch-regression fix after A-6226/A-6229/A-6233 and attribution in A-6240. Added fake-clock red/green coverage for early disconnected failure→reconnect→held connected failure with remembered idle: prior source made two attempts, expected three. Reconnect now begins a fresh per-message connection episode once the earlier flight ends, restoring both its first failure log and immediate idle retry allowance. No T3 assertions weakened or changed. Local claude-code-sessions.test.ts passed all 13 tests in 20.08s wall; changed component file 7/7 passed in 1.73s. Running the second requested T3 file before fresh review.

### rev-31 · 2026-10-19T16:45:42.036Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-873-source-3
commit: 85022b97d6d8c96f2a3a265b699081d3acfdf9fc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no findings. Reconnect-triggered injection clears the prior per-message failure episode only after any old flight ends, restoring the connected attempt's diagnostic and immediate remembered-idle retry. Same-connection capped backoff, uncertain explicit retry and transport ordering remain. New fake-clock regression asserts three attempts and one log in each connection episode; old concurrency assertions retained. Independently read Coordinator 42f56b54 authorizing this exact recovery. Retained A-6241/A-6242 outputs positively show all three batch failures green with native assertions unchanged (13/13 sessions; 6/6 adapter, correcting its title typo). A-6244 reports component 7/7 and static checks green. C1 final verification is pending a fresh mode-free configured task receipt at this head; earlier task evidence does not verify the changed head. See the batch-recovery source artifact in topic-597.

### rev-31 · 2026-10-19T17:10:49.910Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-873-runtime-2
commit: 85022b97d6d8c96f2a3a265b699081d3acfdf9fc
scope: evidence
findings: [{"severity":"medium","text":"Owned fake-hour control exceeds the 2 s T2 budget: ordinary 2.127341198 s at A-6270:47177 and repetitions 2.074196223 / 2.213605134 / 2.157651168 s at :48267/:48378/:48489; raw would-fail line :61300. All assertions pass, but Reviewers must apply the report-mode tier boundary. Retain hour/attempt/log assertions while reducing fixture work, or obtain explicit Coordinator budget disposition; no applicable allowance/disposition is recorded.","file":"hub/test/inject-stalled.test.ts","line":11}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear on A-6270 / 95755b84 despite functional exit 0. Independently audited 1563 ordinary passes, all 483 gates 5/5, seven owned cases plus 35 repetitions passing. Recovery regression is green at 0.164740765 s. However, owned hour case exceeds T2: 2.127341198 s ordinary and up to 2.213605134 s repeated; full raw diagnostic :61300 was omitted from the delivered top ten. No budget disposition for this owned overrun has been supplied. C1 failed pending a conforming fix/source review or explicit Coordinator disposition. Source-3 behavioral recovery remains accepted. Full positive evidence and 31 external budget rows/four onboarding trips are retained in the runtime artifact in topic-597.

Criteria: C1 failed (Owned fake-hour control exceeds the T2 2 s boundary in ordinary and repeated receipts; functional green is insufficient for final acceptance.).

### rev-31 · 2026-10-19T17:14:46.659Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-873-source-4
commit: fbf5c85f4ccf6a617a7d4ba5c860e2eecdb8c225
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source-4 clear; no Standards/Spec findings. Test-only correction replaces the long full-project/socket simulation with public HubCore/Sessions delivery/ack/idle hooks over memory stores and FakeHarness/FakeClock. Retains two messages, 60 minute retry opportunities, >1/<=9 attempts and one log each; public topic-history delivered equality preserves pending-state proof. Other transport/native tests and production recovery are unchanged. A-6279 reports negative controls (61 attempts without backoff, 61 logs without dedup), restored 7/7 file and hour 0.143 s / isolated 0.170 s, typecheck/lint green. No allowance or dev merge. C1 exact-head execution/budget verification remains pending a replacement mode-free task gate. See source review artifact in topic-597.

### rev-31 · 2026-10-19T17:33:11.598Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-873-final-2
commit: fbf5c85f4ccf6a617a7d4ba5c860e2eecdb8c225
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at source-4 head on A-6287 / 3847263d. Independently audited 1563 ordinary passes, all 483 gates 5/5; seven owned cases plus 35 repetitions pass. Fake-hour budget finding resolved: ordinary 0.346899373 s and repeated 0.330192765–0.409283490 s; all owned ordinary/repetition cases remain below T2 2 s with file total below 30 s, no owned budget/resource violations. C1 verified. Connection-episode recovery, in-flight retry, uncertain explicit retry, transport ordering and notice controls remain positive 5/5. A-6241/A-6242 retain the requested local native regressions, production unchanged after source-3; fresh Linux T3 remains landing evidence. Full external inventory of 22 report-only budgets and four onboarding trips (T-877 overlap; roles-editor T-875) retained in the final artifact in topic-597. Prior old-head failures/budget evidence remain recorded.

Criteria: C1 verified.
