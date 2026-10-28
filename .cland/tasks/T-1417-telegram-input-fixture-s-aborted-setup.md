---
id: T-1417
kind: task
title: Telegram input fixture's aborted-setup drain test misses its observation bound once in five under a loaded macOS cover
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
regression_of: T-1378
topic: null
branch: t/T-1417-telegram-input-fixture-s-aborted-setup
created: 2026-10-28T06:30:22.866Z
updated: 2026-10-28T06:59:50.367Z
---

## Summary

`hub/test/telegram-inbound.test.ts::Telegram input fixture drains observers after aborted setup receipt` (added by T-1378) passed 4/5 in the load gate of the macOS stage cover 59165f59 at dev 10a58d78 (A-13085, local 2 workers, peak 1m load 6.29): repetition 5 failed with `fake Telegram observation aborted or exceeded its time bound` from hub/test/fakes/telegram/fake-api.ts. Alone on dev it passes 5/5 (~0.4 s). The cover's tracker-watcher identities (T-1377) all passed; this is the only failure.

## What to build

Find why the fake's observation bound runs out once under CPU load (a fixed wall-clock bound in the fixture, or an observer that waits on a receipt the aborted setup never sends) and make the test wait on the fixture's own receipt with a bound sized for a loaded runner, without hiding a leaked observer.

## Acceptance criteria

- [ ] C1. The cause is attributed with the failing output and a reproduction under CPU load.
- [ ] C2. The identity passes 10/10 at two workers plus owned CPU load on macOS.
