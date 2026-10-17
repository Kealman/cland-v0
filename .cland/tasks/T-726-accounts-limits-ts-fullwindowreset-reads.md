---
id: T-726
kind: task
title: accounts/limits.ts fullWindowReset reads Date.now() while the core schedules limits on the hub Clock
state: open
status: review
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-677
blocked_by:
  - T-696
topic: topic-447
branch: t/T-726-accounts-limits-ts-fullwindowreset-reads
created: 2026-10-17T06:41:52.740Z
updated: 2026-10-17T15:19:59.305Z
---

## Summary

`fullWindowReset()` in hub/src/accounts/limits.ts compares rate-limit windows with `Date.now()`, while HubCore schedules limit and reset work on `core.clock` (limitAccount, publishAccountLimits). With a FakeClock far from wall time, the two can disagree about whether a cached 100% window has expired. Production uses the real clock for both and is unaffected. T-696 found the split and kept current production behaviour.

## What to build

The limits module takes its "now" from the hub Clock wherever HubCore passes it, so every expiry decision in the account-limit path uses one time source. The real clock stays the production default.

## Acceptance criteria

- [x] C1. With a FakeClock set days away from wall time, a cached 100% window is judged expired or live consistently by fullWindowReset and the core scheduler, proved by a T1 test.
  - done: impl-726 · 2026-10-17T15:17:28.306Z
  - verified: rev-31 [reviewer] · run rev-20261017-726-source · 2026-10-17T15:19:59.305Z · commit a2324522fc30c1dfa64f8897dfefee773ec7456c
- [x] C2. Production behaviour is unchanged with the real clock, proved by the existing account-limit tests passing with their assertions unchanged in meaning.
  - done: impl-726 · 2026-10-17T15:17:28.887Z

## Comments

### impl-726 · 2026-10-17T15:15:57.582Z

Implemented fullWindowReset(windows, clock = realClock) and passed HubCore.clock at both call sites. Added T1 red/green regressions for 2000/2099 clocks, cached-hit and updated-reading resets, and exact scheduler expiry. Existing assertions unchanged. Typecheck and tier lint passed; targeted/account-file serial validation underway.

### impl-726 · 2026-10-17T15:17:43.140Z

Pushed a2324522fc30c1dfa64f8897dfefee773ec7456c and requested Reviewer in topic-447; hub queued request for next free verifier. Validation A-4575: typecheck/tier lint/diff-check green, final touched T1 5/5 (0.310–0.393s), 12 unchanged hub account files passed (59 tests), Neovim account-poll passed (1 test); no skips. C1/C2 done. Awaiting source review before droplet verification.

### rev-31 · 2026-10-17T15:19:59.305Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-726-source
commit: a2324522fc30c1dfa64f8897dfefee773ec7456c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 / Spec 0 findings, A-4582. fullWindowReset defaults to realClock, both HubCore callers pass this.clock; native Codex caller retains real default. Comparison/window selection otherwise unchanged. T1 regressions use years 2000/2099, helper live/exact expiry, and both cached-hit/updated-reading scheduler paths. They assert blocked at 999 ms and inspect removed mark at 1000 ms before lazy checkAccountLimit, proving timer behavior. In-memory core/store cleaned in finally; no process/socket/wall wait. Existing assertions unchanged. A-4575 reports red/green, final unit 5/5 and account compatibility passes; summary-only evidence not claimed as raw audited logs. C1 verified from source/test coverage; C2 final compatibility execution awaits exact-head diff-selected droplet. Origin/whitespace exact, no QA. No Reviewer edits/tests.

Criteria: C1 verified.
