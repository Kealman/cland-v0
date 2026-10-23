---
id: T-1178
kind: task
title: Web reconnect waits advance the fake clock without giving the real socket time to reconnect
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1163
topic: null
branch: t/T-1178-web-reconnect-waits-advance-the-fake
created: 2026-10-23T09:40:21.371Z
updated: 2026-10-23T09:40:30.744Z
---

## Summary

web/test/composer.test.ts:196–198 (T-1124) and web/test/asks.test.ts:310–313 (T-1163's fix) wait for the hub connection to read Live by advancing the page's fake clock in 250 ms steps up to 15 s of fake time, checking Live between steps with no real-time wait. The reconnect itself is real socket I/O, so under load the 60 steps finish in real milliseconds before the socket reconnects. T-1128's verify 08dcc577 (A-9942, Linux) failed composer.test.ts "per-topic drafts survive reload and hub disconnection…" with `bounded fresh-epoch reconnect`, false !== true.

## What to build

One shared helper in web/test/harness.ts that waits for Live by advancing the fake clock in bounded steps and, between steps, giving real time for the socket to connect, bounded by a fake-time ceiling and a real-time timeout. Both tests, and any other fake-clock reconnect wait in web/test, use it.

## Acceptance criteria

- [ ] C1. web/test/harness.ts exports a reconnect wait that interleaves fake-clock steps with a bounded real-time poll, and composer.test.ts, asks.test.ts and every other fake-clock Live wait in web/test use it, with their assertions unchanged (test).
- [ ] C2. The composer and asks reconnect cases pass 20/20 alone and 10/10 under two CPU-load loops on macOS, with counts posted in the item topic (test).
