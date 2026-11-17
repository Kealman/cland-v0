---
id: T-1949
kind: task
title: telegram-polling-restart "Discord native history setup omitted" waits a fixed 2000 ms for the owned native acquisition, which times out under load
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-17T19:49:22.077Z
updated: 2026-11-17T19:49:22.077Z
---

## Summary

The local macOS stage cover e7494d5d at ca5f70ca4 (A-20922, 2026-11-17, peak 1-minute load 12.84) failed only hub/test/telegram-polling-restart.test.ts, "Discord native history setup omitted drains its Store writers and observations". The error is "owned native acquisition before losing setup receipt: not within 2000 ms", raised from hub/test/until.ts:40 at telegram-polling-restart.test.ts:316. Alone, the two "Discord native history setup" cases pass 5 of 5 at loads 4.86–5.11, in 4–6 s per run. The file hasn't changed since a6bb5e867 (2026-11-15), so this is a fixed wall-clock wait losing under load, not a regression.

## What to build

The case waits on the owned acquisition's own receipt, an event or a fake clock, instead of a fixed 2000 ms wall-clock deadline, and it keeps the drain assertions unchanged.

## Acceptance criteria

- [ ] C1. The case cannot fail on a slow acquisition alone: a deliberately delayed acquisition (fake or held) still reaches the drain assertions (test).
- [ ] C2. 20 of 20 runs of the file under the T3 runner at a 1-minute load of at least 8 pass, with the load recorded per run (native slot).
