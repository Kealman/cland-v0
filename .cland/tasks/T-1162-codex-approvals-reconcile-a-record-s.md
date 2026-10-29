---
id: T-1162
kind: task
title: "Codex approvals: reconcile a record's outcome with the item's execution when a TUI answer races the hub's write"
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-23T02:33:54.189Z
updated: 2026-10-29T15:59:43.704Z
---

## Summary

T-1113 (2026-10-23 02:33Z) found a protocol limit: Codex's `serverRequest/resolved` carries only the request and thread ids, and the app-server client's `respond` confirms only the socket write. A remote TUI answer whose resolution arrives after the hub's write succeeded cannot be told from the hub's own echo, so the record reads the hub's choice. T-1113 handles the observable case (resolution before the write receipt is the harness's win) and documents the residue in hub/README.md.

## What to build

Where Codex later reports the item's execution (for example a command that runs after the hub sent Deny, or is declined after the hub sent Approve), the hub reconciles the record's outcome to "answered in the harness" with a warn event, and never infers consent.

## Acceptance criteria

- [ ] C1. Through the scripted app-server, a hub Deny followed by a resolution and then the command's execution reads as answered in the harness with a warn-level event (test).
- [ ] C2. A hub Approve followed by the item's declined completion reads as answered in the harness (test).
