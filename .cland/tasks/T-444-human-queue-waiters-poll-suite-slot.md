---
id: T-444
kind: task
title: Human-queue waiters poll suite.slot about 2.4 times a second each
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: null
branch: t/T-444-human-queue-waiters-poll-suite-slot
created: 2026-10-15T00:25:21.216Z
updated: 2026-10-24T08:43:21.055Z
---

## Summary

Two `node hub/test/run-suite.ts` invocations waiting in the human queue (T-392's census runs, 2026-10-15 00:19–00:24Z) wrote 1466 `suite.slot` audit rows in five minutes, about 300 a minute, against a few dozen for every other session. The hub was at load 21. The wait in `humanQueue` (hub/test/run-suite.ts) polls in a tight loop. It should back off, at 2–5 s like the CLI's other waits, or subscribe to the queue's events.

## Acceptance criteria

- [ ] C1. A human-queue waiter issues at most one `suite.slot` request every 2 s while it waits, and is admitted within one poll interval of the slot freeing.
