---
id: T-1163
kind: task
title: "asks.test.ts offline case fails 2 in 5 alone: reconnect waits on more fake time than runFor(250)"
state: open
status: in progress
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1122
topic: topic-891
branch: t/T-1163-asks-test-ts-offline-case-fails-2-in-5
created: 2026-10-23T03:59:05.507Z
updated: 2026-10-23T04:04:39.326Z
---

## Summary

web/test/asks.test.ts › "offline asks disable writes and a fresh snapshot recovers an answer without replaying a draft" (T-1122, landed 269ea26f) failed T-1094's verify all 07b1f675 (A-9808, Linux) with `pageUntil "fresh epoch live"` timing out at 3 s, and fails 2 of 5 targeted runs alone on dev (macOS, 2026-10-23 ~04:00Z). The test advances the page's fake clock once by 250 ms and then waits up to 3 s of real time for the connection to read Live; when the reconnect backoff needs more fake time than that, it never arrives.

## What to build

The case advances the fake clock until the hub connection reads Live (bounded by a fake-time ceiling), or drives the reconnect deterministically, so the reconnect no longer depends on one fixed 250 ms step; every existing assertion stays.

## Acceptance criteria

- [ ] C1. The offline ask case passes 20 of 20 targeted runs alone and 10 of 10 under two CPU-load loops on macOS, with its assertions unchanged (test).
- [ ] C2. The reconnect wait in the case is driven by fake-clock advancement bounded in fake time, not one fixed step followed by a real-time wait (test).
- [ ] C3. The "In Inbox from a secondary thread opens and focuses that pane list while the primary thread keeps its ask" case waits for a rendered focus receipt before asserting focus, and passes 20/20 alone and 10/10 under two CPU-load loops (test).

## Comments

### impl-1163 · 2026-10-23T04:01:12.734Z

Baseline e327baef: linked root node_modules and rebuilt bundle. Read asks.test.ts, pageUntil/clock fixture and connection.ts: product backoff is documented 250ms doubling to 10s, no jitter. 20/20 unchanged isolated macOS targeted runs passed; continuing unchanged reproduction under two owned CPU loops after local queue holder:null.
