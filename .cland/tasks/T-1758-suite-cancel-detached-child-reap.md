---
id: T-1758
kind: task
title: suite-cancel detached-child reap assertion fails under load right after the cancelled result
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1881
blocked_by: []
topic: null
branch: null
created: 2026-11-07T16:25:55.075Z
updated: 2026-11-16T07:28:48.664Z
---

## Summary

`hub/test/suite-cancel.test.ts` "verify cancel reaps a detached fake child before removing the phase root, then admits the next run" failed once under load at line 90: `detached descendant is reaped before cancellation is reported` (`pidAlive(fake.pid)` true !== false). The assertion reads `pidAlive` immediately after the cancelled result appears. Under load the reaped detached child can still be visible for a moment, or the result is published before the kill is confirmed. One of the two is a test race and the other a product ordering defect; this item finds which.

## Evidence

- Failed: T-1738 native importer sweep, local macOS arm64, Node 24.21.0, five implementer lanes active, host 1-minute load about 11 (16:18Z, 2026-11-07). File result 7 pass / 1 fail, 87.8 s. T-1738 touches no process or cancel code.
- Solo rerun at T-1738 head e3c911e0, `CLAND_*` stripped, no concurrent tests from that session: 8/8 pass, 28.2 s.

## Acceptance criteria

- [ ] C1. The cause is named: either the cancelled result can be published before the detached descendant is confirmed dead (product), or the probe runs before the kernel retires an already-killed pid (test).
- [ ] C2. Product cause: the cancelled result follows confirmed death of every tracked descendant, with a regression that delays the reap. Test cause: the assertion waits through `eventually()` for the pid to vanish within the behaviour bound, keeping the ordering claim.
- [ ] C3. The case passes 20/20 under a parallel CPU burner at load ≥ 10 on macOS, run alone otherwise.

## Comments

### coord · 2026-11-07T16:53:29.592Z

Dev check at cc23cc1f, local macOS arm64, Node 24.21.0, run alone under the preservation lock with CLAND_* stripped, 1-min load 2.2–3.0: hub/test/suite-cancel.test.ts 5/5 runs green (8/8 each). The failure needs load (about 11 at the T-1738 occurrence); C3's ≥10-load burner is the reproduction path.
