---
id: T-1474
kind: task
title: Detect Claude daemon idle retirement
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
created: 2026-10-30T07:50:18.630Z
updated: 2026-10-30T07:50:18.630Z
---

## Summary

The daemon retires a background session idle at the prompt for 60 min (`bg retire <id>: idle-prompt, idle 60m`: 10-18, 10-20, 10-21, 10-24, 10-30). With one process, that took coord offline silently on 10-20 and 10-24.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [ ] C1. When a hub-launched Claude Code job disappears from `claude agents --json`, or its job reports `done`, while the row is running, the hub logs `harness-exited` with reason `retired` within 60 s.
- [ ] C2. A retired Coordinator gets one human inbox entry with the relaunch command within 2 min.
