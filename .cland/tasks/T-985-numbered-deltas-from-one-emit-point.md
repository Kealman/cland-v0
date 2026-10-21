---
id: T-985
kind: task
title: Numbered deltas from one emit point
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-983
topic: topic-791
branch: t/T-985-numbered-deltas-from-one-emit-point
created: 2026-10-20T16:50:00.467Z
updated: 2026-10-21T09:39:51.072Z
---

## Summary

Every model delta is numbered within the epoch where the core emits it, and a delta carries only what changed. A `task` delta carries the changed item and only the changed layers. The verification queue is pushed only when it changes. Each frame is serialized once per feature set.

## What to build

There is one emit point in the core for every model delta to clients, the tracker's `task` frames included. Whole-state frames (`inbox`, `presence`, the verification queue) replace, while `message`, `delivery` and `event` append. A pin or a mute sends the re-projected rows, never a bare invalidation. On a featured connection:
- a `task` delta carries the changed item and only the layers that changed, never the all-items layer map;
- the verification queue goes out only when its holder or waiters change, not about once a second.

A frame is serialized once per feature set, not once per client. Connections without features keep today's frames byte for byte.

## Acceptance criteria

- [ ] C1. After the snapshot, every model frame a featured connection receives carries the next sequence number with no gap, across tracker, topic, session and inbox changes (test).
- [ ] C2. A `task` delta to a featured connection carries the changed item and only the layers that changed (test).
- [ ] C3. The verification queue is pushed only when its holder or waiters change, not while a run merely holds it (fake-clock test).
- [ ] C4. A pin or a mute sends the re-projected rows, not a bare invalidation (test).
- [ ] C5. Each frame is serialized once per feature set, whatever the number of receiving connections (test counts serializations with three clients).
- [ ] C6. Neovim's frames are unchanged: the recorded Neovim frame fixtures and the Neovim T2 tests pass without edits.
- [ ] C7. `hub/README.md` documents the numbering, replace against append, and the slim `task` frames.
