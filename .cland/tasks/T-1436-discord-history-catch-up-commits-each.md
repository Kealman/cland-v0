---
id: T-1436
kind: task
title: "Discord history catch-up commits each replayed input separately: about 55 ms per input on Linux"
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1217
branch: t/T-1436-discord-history-catch-up-commits-each
created: 2026-10-29T04:18:09.413Z
updated: 2026-10-29T19:32:18.017Z
---

## Summary

Found by T-1413 (topic-1171). Once the quadratic outbox scan was fixed, a 620→500 history catch-up took 7 s on macOS but 25–30 s on a Linux c-8 droplet: about 55 ms against 14 ms per input. The hub keeps answering (an active `topic.send` takes 6 ms), so this is throughput, not a stall.

## Cause (suspected)

The frame dispatcher commits each replayed `topic.send` and its reaction receipt as separate durable transactions. Each one pays the droplet's fsync (8–35 ms). T-1413 deferred batching the durable writes of one history page because that needs a dispatcher transaction seam across awaited remote results.

## What to build

Commit one history page (or a bounded group of inputs) in a single durable transaction, keeping order, the at-most-once receipts, and the interruption semantics T-1413 established (persisted selection, process-kill recovery). Measure the Linux 620→500 case before and after, then shrink its T3 allowance (owner R-1278).

## Acceptance criteria

- [ ] C1. The 620→500 production-frame catch-up completes in under 10 s in the task's Linux c-8 verify run (before: 19.8 s and 23.5 s in integrated runs A-13961 and A-14040) and in 5 of 5 local macOS repeats under two workers plus owned CPU load; later c-8 cover samples are recorded as landing evidence.
- [ ] C2. Killing the hub during a page commit replays no input twice and loses none, shown by a T3 process-kill case.
- [ ] C3. Telegram catch-up and gap tests pass unchanged.
