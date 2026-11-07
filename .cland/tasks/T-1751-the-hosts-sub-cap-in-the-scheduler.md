---
id: T-1751
kind: task
title: The hosts sub-cap in the scheduler
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1746
  - T-1747
topic: null
branch: null
created: 2026-11-07T16:01:59.458Z
updated: 2026-11-07T16:02:07.194Z
---

## Summary

At 100 % of `[hosts] daily_spend_usd`, no new host starts. The waiting launch keeps waiting, and live hosts and their sessions are untouched, renewals included. When the hosts' spend and reservations first cross 80 % of the sub-cap in a day, General gets one line.

## What to build

The scheduler maps T-1747's reservation refusal to "waiting for a host". It also posts the once-per-day 80 % line through the existing `noticeInTopic`, kept once per day across hub restarts.

## Acceptance criteria

- [ ] C1. With a tiny sub-cap, a second host is refused at 100 %, the launch keeps waiting, and the first host keeps running with its sessions and its renewals (test).
- [ ] C2. Crossing 80 % of the sub-cap posts exactly one General line that day, also across a hub restart (test).
- [ ] C3. A refused create makes no provider call and adds no ledger entry (test).

## Blocked by

- T-1746
- T-1747

## Notes

- Hot files: `hub/src/host/pool-runtime.ts`; no `core.ts` edit.
- Tests: new `hub/test/pool-spend-cap.test.ts` (T2, isolated `XDG_STATE_HOME`).
- Serves epic C7. Its plan lane orders it after T-1750, because both edit `pool-runtime.ts`.
