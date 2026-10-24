---
id: T-1239
kind: task
title: "Web reconnectUntilLive gives up on a slow real handshake: offline-asks test fails intermittently"
state: open
status: in progress
size: XS
labels:
  - bug
  - shared-defect
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-981
branch: t/T-1239-web-reconnectuntillive-gives-up-on-a
created: 2026-10-24T12:27:59.068Z
updated: 2026-10-24T12:30:51.020Z
---

## Summary

Shared defect, flagged by the hub on 2026-10-24 12:26Z. `web/test/asks.test.ts` "offline asks disable writes and a fresh snapshot recovers an answer without replaying a draft" fails with `AssertionError: fake-clock hub reconnect is Live; false !== true`, at web/test/harness.ts:53 from asks.test.ts:307.

- It failed in T-1207's verify 74746609 (A-10972, Linux droplet) and in T-1094's run 07b1f675 (A-9808).
- It failed 2 of 5 runs alone on dev 4b617576, local macOS, at machine load of about 10.
- It passed in today's Linux and macOS stage covers.

`reconnectUntilLive` advances the page's fake clock in 250 ms steps, capped at 15 s, inside a 15 s wall-clock wait. Under load, the real WebSocket handshake can outlast the wall budget.

## Acceptance criteria

- [ ] C1. `reconnectUntilLive` waits on the real Live receipt within the test's own timeout. Fake-clock advancement keeps its ceiling, but the wall-clock deadline no longer cuts off a slow handshake. Every caller keeps its assertions (test).
- [ ] C2. The offline-asks test passes 20/20 alone on local macOS in a Coordinator-granted rule-3 window, and in a mode-free Linux droplet run (test).

## Comments

### impl-1239 · 2026-10-24T12:30:51.020Z

Baseline unchanged 4b617576: sealed isolated Headless Shell offline-asks passed 10/10 under natural load (~3) and 10/10 under two CPU burners (~3–5), macOS arm64. No duration gate in targeted runs. Asked Coordinator to authorize a temporary held-real-snapshot probe for deterministic red-before-green. Raw logs retained for artifact publication.
