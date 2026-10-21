---
id: T-986
kind: task
title: Resume, the ring and resync
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-985
topic: null
branch: null
created: 2026-10-20T16:50:00.557Z
updated: 2026-10-21T09:39:18.481Z
---

## Summary

A reconnecting client sends `resume` with its epoch and number. It receives the missed deltas from the hub's in-memory ring, or a fresh snapshot when the ring no longer covers them or the epoch changed. A connection that falls too far behind has its model stream resynced.

## What to build

The ring holds the last 15 minutes of deltas, at most 4 MiB. A hub restart starts a new epoch. On `resume` with a number the ring still covers, the hub sends exactly the missed deltas, then the live ones. Otherwise it sends a fresh snapshot. A connection whose unsent bytes pass 4 MiB has its model stream closed with `resync`, and the client resumes from its number.

## Acceptance criteria

- [ ] C1. A featured client dropped while five items change sends `resume` and receives exactly those five deltas in order, then live ones (test).
- [ ] C2. A `resume` whose number the ring no longer covers, or whose epoch differs, receives a fresh snapshot in the current epoch (test, both cases).
- [ ] C3. A hub restart starts a new epoch, and a client resuming across it receives a fresh snapshot (test with two hub starts).
- [ ] C4. The ring keeps at most 15 minutes and 4 MiB of deltas (fake-clock test at both bounds).
- [ ] C5. A connection whose unsent bytes pass 4 MiB gets `resync` on its model stream and resumes from its number (test with a stalled reader).
- [ ] C6. `hub/README.md` documents `resume`, the ring's bounds and `resync`.
