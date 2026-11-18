---
id: T-1952
kind: task
title: Hub startup spends 64 s between "binding listeners" and "binding web listener", so a restart gap exceeds the 60 s bridge expiry
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: null
created: 2026-11-17T21:09:36.382Z
updated: 2026-11-18T12:31:25.680Z
---

## Summary

Hub restart #82 (2026-11-17, pid 57331, at ca5f70ca4) had an 87 s gap between stop (21:02:34Z) and serving (21:04:01Z), over the 60 s limit after which a session's mod bridge expires. The startup journal shows 64 s from "binding listeners" to "binding web listener" (21:02:52Z to 21:03:56Z); the journal read took 6.6 s, and every other step under 5 s. impl-1950 traced daemon.ts: that step only awaits the websocket and socket edge creation, and executor recovery starts after serving, so no lease read sits inside it (topic-1605). Background I/O from T-1950's 4,202-lease reads may contend, but that is not measured.

## What to build

Find what the edge creation waits on for 64 s with a startup profile or step-level timing receipts, and bring the step within its normal few seconds. Each startup step's duration is recorded so the next long gap names its step.

## Acceptance criteria

- [ ] C1. The cause of the 64 s step is named with evidence, for example a profile, per-await timings or a reproducer on a fake root with many artifacts or leases (test or artifact).
- [ ] C2. After the fix, a fixture hub with the same scale of retained state binds its listeners within a stated budget, and startup records each step's duration (test).

## Comments

### coord · 2026-11-18T06:13:51.239Z

Restart #83 (2026-11-18, dev 303b482b8, with T-1950 live): the step from "binding listeners" to "binding web listener" took 57.7 s again, against 64 s at restart #82. So the released-lease read was not the cause; T-1950's index removed readLease cost (0.4% of a 15-minute profile, down from 7–9%) without shortening this step. Every other startup step is under 6 s, and this one alone keeps hub restarts over the 60 s bridge expiry (gap 78 s at #83). Source: the hub operator session's restart report.

### coord · 2026-11-18T12:31:25.680Z

Restarts #84 and the respawn after it (2026-11-18, dev 93026cbe9, same code and tree): on pid 20702 (clean stop, then start) "binding listeners" → "binding web listener" took 2.0 s, and the gap was 50 s. Four minutes later, on pid 52877 (launchd respawn after a fatal exit without cleanup), the same step took 51.7 s and the gap was 70 s. Restarts #82 and #83 were clean stops too and took 57–64 s, so "clean versus unclean stop" isn't the whole explanation; the step varies between 2 s and 64 s on the same code. Source: the hub operator session's report.
