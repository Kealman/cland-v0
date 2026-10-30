---
id: T-1472
kind: task
title: A `deaf` state for a live harness that cannot take deliveries
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1468
blocked_by: []
topic: null
branch: null
created: 2026-10-30T07:50:18.206Z
updated: 2026-10-30T07:54:20.996Z
---

## Summary

A live process with deliveries held or unconfirmed for minutes looks like `running/busy` today. Retry refuses it and nobody is told. Derive a `deaf` mark and tell the human.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [ ] C1. A running session with a human delivery queued, or a delivery acked but not injected, for over 5 min while its pid is alive shows `deaf` in `cland session list`, `hub.status` and the workbench.
- [ ] C2. On entering `deaf`, the hub posts one Agents notice and one human inbox entry naming the session, the oldest held message id and the recovery command; for the Coordinator, also one General line.
- [ ] C3. The `deaf` mark and its inbox entry clear on the session's next `injected` event.
