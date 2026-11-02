---
id: T-1627
kind: task
title: The first hourly verification-wait snapshot can land inside hub shutdown
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-470
found_by: review
topic: topic-1333
branch: t/T-1627-the-first-hourly-verification-wait
created: 2026-11-02T05:57:32.136Z
updated: 2026-11-02T05:58:56.375Z
---

## Summary

`hub/test/daemon.test.ts` "a stopping hub leaves alone a socket that is no longer the one it bound, and hub.json goes only at the end" fails intermittently on clean dev: the shutdown log carries an extra `verification-wait` event between `socket-kept` and `stopped`. `VerificationWait.record` logs once per new hour, and a fresh store starts at hour -1, so the first `record` call always logs; when that first call lands inside the shutdown window the test's event list gains it.

## What to build

The shutdown sequence carries no `verification-wait` snapshot: either the hourly snapshot is not recorded once the hub is stopping, or the first snapshot is taken at startup before the hub reports ready, so it can never fall inside shutdown. The daemon test keeps its expected list unchanged. Whichever fix, the hourly snapshot still appears once per hour in a running hub.

Found by impl-1615 during T-1615 (topic-1331, 2026-11-02 05:57Z): clean dev c14994a24, `node --test hub/test/daemon.test.ts`, run 1 18/18, run 2 17/18 at daemon.test.ts:583 with actual `['stopping','socket-kept','verification-wait','stopped']`.

## Acceptance criteria

- [ ] C1. A hub stopping before its first hourly snapshot logs no `verification-wait` event between `stopping` and `stopped` (test).
- [ ] C2. A running hub still logs one `verification-wait` snapshot per clock hour, proven with the fake clock (test).
- [ ] C3. `hub/test/daemon.test.ts` passes 10 consecutive runs on macOS at load 10 or below with no test edited.

## Comments

### impl-1627 · 2026-11-02T05:58:56.375Z

Using the brief-authorized startup snapshot alternative at the Suites/log boundary. Consumers searched: VerificationWait/verification-wait/waitClock across hub tests, scheduler, protocol, clients and docs. No wire/schema change; existing hourly/restart metrics regression will move to T-685 FakeClock and assert the initial durable snapshot before any tick. daemon.test.ts remains unedited.
