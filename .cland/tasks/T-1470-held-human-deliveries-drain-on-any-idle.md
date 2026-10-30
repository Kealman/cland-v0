---
id: T-1470
kind: task
title: Held human deliveries drain on any idle observation and on a timer
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1468
blocked_by: []
topic: null
branch: null
created: 2026-10-30T07:50:17.481Z
updated: 2026-10-30T07:50:17.481Z
---

## Summary

A human message held for `busy` leaves the queue only on an idle transition, so a stuck busy holds it until the 24 h TTL. Flush whenever any source observes idle, transition or not. While a human delivery is held, re-check the session on a timer.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [ ] C1. A human delivery held for a busy session is sent within 60 s after any signal source reports the session idle, even when the state did not change.
- [ ] C2. While a human delivery is held, the hub re-evaluates the session at least every 60 s and logs `human-hold-recheck` with the state source and its age.
- [ ] C3. A busy state that comes only from a poll and is older than 5 min with no push signal no longer holds human deliveries.
