---
id: T-1463
kind: task
title: The release skill asks for a conditional release approval in daytime
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: null
branch: null
created: 2026-10-30T05:44:58.508Z
updated: 2026-10-30T10:16:25.287Z
---

## Summary

The v0.3.0 release waited 6.8 h overnight for approval (retro A-14149). The release skill gains a recorded conditional approval: the Coordinator asks in daytime "release vX once the release epic is clear and the covers are green", and releases on those conditions. Retro v0.3.0 change 3.

## Acceptance criteria

- [ ] C1. The release skill describes recording and checking a conditional approval, with the conditions named in the ask.
