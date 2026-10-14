---
id: T-442
kind: task
title: sessions.test.ts hard-limits display test fails when the reset falls after local midnight
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-14T22:00:11.207Z
updated: 2026-10-14T22:00:11.207Z
---

## Summary

`nvim/test/sessions.test.ts:331` (the hard-limits display) sets reset = Date.now() + 120000 and expects `↻<clock>` with no weekday. When the run is within two minutes of local midnight, the reset falls on the next day, and the formatter rightly shows the weekday (`↻Thu 00:01`), so the test fails. Seen in T-441's run 2c0e86a1 (A-2579) at about 21:58Z on 2026-10-14. Pin the clock in the test, or compute the expected label with the same formatter rule.

## Acceptance criteria

- [ ] C1. The test passes when the reset falls after local midnight (simulated clock or TZ), and still checks the same-day format otherwise.
