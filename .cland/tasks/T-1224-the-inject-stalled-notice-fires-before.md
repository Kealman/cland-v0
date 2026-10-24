---
id: T-1224
kind: task
title: The inject-stalled notice fires before Codex app-servers finish reconnecting after a hub restart
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-24T10:13:49.994Z
updated: 2026-10-24T10:13:49.994Z
---

## Summary

After hub restarts #50 and #51 (2026-10-24), the hub posted "injection has remained unconfirmed for 60000 ms (the hub is not connected to this session's app-server)" for every Codex session at +60 s, and all of them confirmed 64–90 s after the stop without any action. The notice is noise after every restart and trains the Coordinator to ignore it.

## Acceptance criteria

- [ ] C1. During the reconnect window after a hub start, a Codex session whose app-server reconnects and confirms within a startup grace (measured from the hub start, long enough to cover the observed 90 s) produces no inject-stalled notice; a session still unconfirmed after the grace still gets one (test with a fake app-server).
