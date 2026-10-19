---
id: T-873
kind: task
title: Uninjected deliveries retry every minute without bound and log every attempt, flooding hub.log
state: open
status: review
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
updated: 2026-10-19T17:09:39.417Z
---

## Summary

While a session's bridge is down, the hub retries every uninjected message to it about once a minute and logs each attempt as `inject-unconfirmed`. After coord's bridge died at restart #18 (2026-10-19), hub.log grew by about 100 lines a minute: 1069 lines in 23 minutes from 100 distinct ids, the oldest retried 15 times. Reported by cland-impl at 12:23Z.

## Acceptance criteria

- [x] C1. Retries to a session whose bridge is down are bounded (backoff, or a stop until the bridge reconnects), and the log records one line per message per episode, not one per attempt. A test with a fake clock drives an hour of retries and counts the log lines.
  - done: impl-873 · 2026-10-19T14:56:36.080Z
  - verified: rev-31 [reviewer] · run rev-20261019-873-final · 2026-10-19T15:18:28.912Z · commit 09ac40e5b467f406327caa484288164ec875d646

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
