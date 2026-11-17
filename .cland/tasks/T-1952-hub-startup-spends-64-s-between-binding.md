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
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-17T21:09:36.382Z
updated: 2026-11-17T21:09:36.382Z
---

## Summary

Hub restart #82 (2026-11-17, pid 57331, at ca5f70ca4) had an 87 s gap between stop (21:02:34Z) and serving (21:04:01Z), over the 60 s limit after which a session's mod bridge expires. The startup journal shows 64 s from "binding listeners" to "binding web listener" (21:02:52Z to 21:03:56Z); the journal read took 6.6 s, and every other step under 5 s. impl-1950 traced daemon.ts: that step only awaits the websocket and socket edge creation, and executor recovery starts after serving, so no lease read sits inside it (topic-1605). Background I/O from T-1950's 4,202-lease reads may contend, but that is not measured.

## What to build

Find what the edge creation waits on for 64 s with a startup profile or step-level timing receipts, and bring the step within its normal few seconds. Each startup step's duration is recorded so the next long gap names its step.

## Acceptance criteria

- [ ] C1. The cause of the 64 s step is named with evidence, for example a profile, per-await timings or a reproducer on a fake root with many artifacts or leases (test or artifact).
- [ ] C2. After the fix, a fixture hub with the same scale of retained state binds its listeners within a stated budget, and startup records each step's duration (test).
