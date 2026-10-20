---
id: T-989
kind: task
title: Liveness, version skew and the terminal's door
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-980
  - T-983
topic: null
branch: null
created: 2026-10-20T16:50:00.836Z
updated: 2026-10-20T16:50:00.836Z
---

## Summary

The web edge pings its sockets and reports version skew. It also puts the terminal's reservations into code: binary frames are refused, each frame kind has its own size limit, the welcome carries the feature list and the bundle's build stamp, and every adapter declares its `terminal` capability.

## What to build

The web edge pings every 30 seconds, and the existing sweep closes a socket silent for 60 seconds. A binary frame closes the socket with a dedicated close code until streams exist. Each frame kind has its own size limit; JSON frames keep 1 MiB. The welcome carries the bundle's build stamp, so a page that loaded an older bundle can reload. A hello refused for its protocol tells the page to restart the hub. Every adapter declares `terminal: 'none'`, and clients can read it.

## Acceptance criteria

- [ ] C1. The web edge pings every 30 seconds, and a socket silent for 60 seconds is closed (fake-clock test).
- [ ] C2. A binary frame on the web edge closes the socket with a dedicated close code (test).
- [ ] C3. Each frame kind has its own size limit, JSON frames keep 1 MiB, and an oversize frame of a kind is refused (test).
- [ ] C4. The welcome carries the feature list and the bundle's build stamp, and a hello refused for its protocol carries the instruction to restart the hub (test).
- [ ] C5. Every adapter declares its `terminal` capability, `none` today, readable by a client (test).
- [ ] C6. `hub/README.md` documents the eight reservations as built.
