---
id: T-1325
kind: task
title: The outbox drain, the retry_after cap and reconnection backoff
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by:
  - T-1324
topic: null
branch: null
created: 2026-10-26T02:28:47.280Z
updated: 2026-10-26T02:28:47.280Z
---

## Summary

The outbox drains predictably: a job queued while a drain runs leaves in that drain, a platform `retry_after` wait is capped at 5 minutes, and reconnection backs off with jitter and a cap.

## What to build

Drain-loop semantics on top of the outbox: re-read the queue before the drain ends, so a job queued mid-drain is not left for the next trigger. Honour `retry_after` up to a 5-minute cap. Reconnect with exponential backoff, jitter and a stated ceiling, driven by an injected clock and random source so tests stay deterministic (no wall-clock waits). Spec §3.9.

## Acceptance criteria

- [ ] C1. A job queued while the outbox drains leaves in that same drain (test).
- [ ] C2. A `retry_after` above 5 minutes waits 5 minutes, and successive reconnect delays grow with jitter up to the stated cap, under an injected clock (test).
