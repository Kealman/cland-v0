---
id: T-1349
kind: task
title: "Telegram liveness: stalled polls, a lasting 409, and a 401 or 403 that stops only this remote"
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1341
topic: null
branch: null
created: 2026-10-26T19:09:07.935Z
updated: 2026-10-26T19:09:15.626Z
---

## Summary

Liveness and failure on Telegram: a poll that hasn't returned within its timeout plus 15 s restarts the loop, a lasting 409 shows as "another consumer of the token", and a 401 or 403 stops only this remote with the cause and the fix in General.

## What to build

Stall detection on the poll, 409 handling within T-1323's poller lease (ride out up to 60 s at start; a lasting 409 is reported and never settled by stopping another process), and 401 and 403 handling through T-1326's isolation. Spec §3.9.

## Acceptance criteria

- [ ] C1. A stalled poll restarts after its timeout plus 15 s under an injected clock, and a lasting 409 shows as "another consumer of the token" in General and `cland remote status` (test).
- [ ] C2. A 401 stops only the Telegram remote with its cause and fix in General while the hub and the web edge serve on (test).
