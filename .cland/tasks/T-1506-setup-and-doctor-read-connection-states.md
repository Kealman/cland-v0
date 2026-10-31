---
id: T-1506
kind: task
title: Setup and doctor read connection states through a bounded readiness wait
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: null
branch: null
created: 2026-10-31T08:18:54.524Z
updated: 2026-10-31T14:43:34.833Z
---

## Summary

T-1502 found that `cland setup` read a paired remote's connection state as a single sample and reported `open` while the gateway was reconnecting. Audit setup and doctor for any other status read as a single sample, and give each one a bounded readiness wait. Rule batch 5 (A-14855) C3, accepted by the human on 2026-10-31.

## Acceptance criteria

- [ ] C1. The item lists every setup and doctor step that reports a connection, pairing, process or service state, and records for each one whether it reads a single sample.
- [ ] C2. Each single-sample read that can see a transient state polls through the shared readiness helper from T-1502, within a bound. A test on fake clocks covers one transient-then-ready case and one past-the-bound case for each changed step.
