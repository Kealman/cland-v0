---
id: T-873
kind: task
title: Uninjected deliveries retry every minute without bound and log every attempt, flooding hub.log
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
created: 2026-10-19T12:24:05.900Z
updated: 2026-10-19T12:24:05.900Z
---

## Summary

While a session's bridge is down, the hub retries every uninjected message to it about once a minute and logs each attempt as `inject-unconfirmed`. After coord's bridge died at restart #18 (2026-10-19), hub.log grew by about 100 lines a minute: 1069 lines in 23 minutes from 100 distinct ids, the oldest retried 15 times. Reported by cland-impl at 12:23Z.

## Acceptance criteria

- [ ] C1. Retries to a session whose bridge is down are bounded (backoff, or a stop until the bridge reconnects), and the log records one line per message per episode, not one per attempt. A test with a fake clock drives an hour of retries and counts the log lines.
