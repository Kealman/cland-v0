---
id: T-726
kind: task
title: accounts/limits.ts fullWindowReset reads Date.now() while the core schedules limits on the hub Clock
state: open
status: planned
size: S
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-677
blocked_by:
  - T-696
topic: null
branch: null
created: 2026-10-17T06:41:52.740Z
updated: 2026-10-17T06:42:01.303Z
---

## Summary

`fullWindowReset()` in hub/src/accounts/limits.ts compares rate-limit windows with `Date.now()`, while HubCore schedules limit and reset work on `core.clock` (limitAccount, publishAccountLimits). With a FakeClock far from wall time, the two can disagree about whether a cached 100% window has expired. Production uses the real clock for both and is unaffected. T-696 found the split and kept current production behaviour.

## What to build

The limits module takes its "now" from the hub Clock wherever HubCore passes it, so every expiry decision in the account-limit path uses one time source. The real clock stays the production default.

## Acceptance criteria

- [ ] C1. With a FakeClock set days away from wall time, a cached 100% window is judged expired or live consistently by fullWindowReset and the core scheduler, proved by a T1 test.
- [ ] C2. Production behaviour is unchanged with the real clock, proved by the existing account-limit tests passing with their assertions unchanged in meaning.
