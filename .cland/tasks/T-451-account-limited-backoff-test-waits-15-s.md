---
id: T-451
kind: task
title: account-limited backoff test waits 15 s for a reset its own assertion requires at 16 s or later
state: open
status: in progress
size: XS
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-271
branch: t/T-451-account-limited-backoff-test-waits-15-s
created: 2026-10-15T04:36:56.217Z
updated: 2026-10-15T04:37:47.428Z
---

## Summary

`hub/test/account-limited.test.ts:236` ('after-hit read waits for a recent failed poll backoff and duplicate hits share it') waits with `eventually()`'s default of 15,000 ms for the deferred poll's reset (line 261). Its final assertion requires the failed-poll delay to be at least 16,000 ms (minimum 6,000, floor 8,000). The wait is shorter than the behaviour it asserts, so the case races itself: it failed in T-254's gate 938db829 (A-2679), and once in four runs alone at 871876cc (A-2684; A-2681 to A-2683 green, at 17.3–17.6 s). This is a shared fix, which blocks T-254 and the release.

## What to fix

Give that wait a bound derived from the asserted delay, the backoff plus a margin, rather than the 15 s default. Better still, drive the backoff from a test timing knob (T-389's pattern) so the case no longer waits on real clocks. Keep the assertion's meaning: the read waits for the backoff, and duplicate hits share it.

## Acceptance criteria

- [ ] C1. The case's wait is bounded by the backoff it asserts, or the backoff runs on a test timing knob, and the assertion is unchanged in meaning.
- [ ] C2. The file passes 10/10 whole-file runs serially.

## Comments

### impl-451 · 2026-10-15T04:37:47.428Z

Confirmed A-2679 and A-2684 both fail at deferred poll supplies reset: not within 15000 ms. AccountPoller uses floor × 2 after the first failure (8000 × 2 = 16000 ms); the test asserts that same lower bound. Existing failure artifacts cover reproduction, so no extra flaky baseline run is needed. Plan: share the asserted delay with an explicit eventually bound plus 5000 ms margin, retaining all no-early-read and duplicate-hit assertions. T-440 timing cleanup stays out of scope.
