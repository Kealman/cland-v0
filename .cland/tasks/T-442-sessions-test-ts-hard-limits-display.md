---
id: T-442
kind: task
title: sessions.test.ts hard-limits display test fails when the reset falls after local midnight
state: closed
status: done
size: XS
rank: 4446
criterion_seq: 1
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-286
branch: t/T-442-sessions-test-ts-hard-limits-display
created: 2026-10-14T22:00:11.207Z
updated: 2026-10-16T17:26:42.371Z
closed: 2026-10-15T09:52:03.531Z
---

## Summary

`nvim/test/sessions.test.ts:331` (the hard-limits display) sets reset = Date.now() + 120000 and expects `↻<clock>` with no weekday. When the run is within two minutes of local midnight, the reset falls on the next day, and the formatter rightly shows the weekday (`↻Thu 00:01`), so the test fails. Seen in T-441's run 2c0e86a1 (A-2579) at about 21:58Z on 2026-10-14. Pin the clock in the test, or compute the expected label with the same formatter rule.

## Acceptance criteria

- [x] C1. The test passes when the reset falls after local midnight (simulated clock or TZ), and still checks the same-day format otherwise.
  - done: impl-442 · 2026-10-15T09:40:52.261Z
  - verified: rev-30 [reviewer] · run rev-20261015-442-final · 2026-10-15T09:51:54.943Z · commit 05df4ec3c3bbd4cf74ac81293ed9b2b3d9a69c85

## Comments

### impl-442 · 2026-10-15T09:38:13.709Z

Keeping the existing real hub → fake harness → rendered Neovim account seam requested by C1. Plan: use a future 00:01 UTC reset, pin only the Neovim wall clock on either side of midnight, and assert both HH:MM and weekday HH:MM. This fixes the flaky expectation without changing production formatting or widening waits.

### rev-30 · 2026-10-15T09:41:40.771Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-442-source
commit: 05df4ec3c3bbd4cf74ac81293ed9b2b3d9a69c85
scope: full

Source review clear; no high, medium or low findings.

Standards: no findings against repo test guidance or baseline smells.
Spec: nvim/test/sessions.test.ts:315–343 now explicitly controls UTC and the test Neovim clock, asserting both same-day 00:01 and next-day weekday 00:01. The os.time wrapper preserves date-table conversion and triggers redraw. Line 348 returns the pinned UI time to current account-reading time before the unchanged freshness, clear-by-push and highlight checks. Event-only account update guard remains; no production changes or widened time bounds.

A-2836 records old-expectation red reproduction and the changed file passing all 5 tests with zero skips. C1 remains unverified in this source pass pending same-head post-source gate verification.

### rev-30 · 2026-10-15T09:51:54.943Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-442-final
commit: 05df4ec3c3bbd4cf74ac81293ed9b2b3d9a69c85
scope: evidence

Final review clear; no high, medium or low findings. Source review rev-20261015-442-source remains applicable at the unchanged current branch head.

Standards: no findings.
Spec: C1 verified. A-2840:694 shows the modified hard-limits test passing (5.269 s), including both same-day HH:MM and simulated next-day weekday HH:MM assertions, with clear-by-push checks preserved. A-2836 records the old-expectation midnight red reproduction and green local file run.

Same-head gate b6ea9f45-ea71-430d-b373-6cfa5b518c94 / A-2840: exit 0; host/remote typecheck green; nvim-only + hub smoke; Linux x64, Node v24.21.0, Neovim v0.12.5. 403 tests: 400 pass, 0 fail/cancelled, 3 documented macOS sandbox-exec skips in nvim/test/qa.test.ts. No C1 checks skipped.

Criteria: C1 verified.

### coord · 2026-10-15T09:52:03.531Z

Merged 30a98a6d050df4f8f6596cb9db8b68e2fb0a0017 onto dev.
