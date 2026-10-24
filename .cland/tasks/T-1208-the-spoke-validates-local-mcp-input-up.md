---
id: T-1208
kind: task
title: The spoke validates local MCP input up to the SDK's 10 MiB before the hub's 1 MiB frame cap applies
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:48:03.158Z
updated: 2026-10-24T06:48:03.158Z
---

## Summary

impl-1189 inspected the validation boundaries during T-1189 (2026-10-24) and found a mismatch. The hub's WebSocket edges cap frames at 1 MiB, and its Unix and stdio line readers check the byte length before parsing. The local spoke (runSpoke) is different: it uses the MCP SDK's StdioServerTransport, whose default read buffer is 10 MiB, and it validates JSONRPCMessageSchema and CallToolRequestSchema before forwarding to the hub's 1 MiB cap. So a local MCP client can make the spoke parse and validate up to 10 MiB, ten times the hub's cap. Network clients cannot.

## What to build

Bound the spoke's stdio input to the hub's frame cap before it parses or validates. Reject an oversized message with a clear JSON-RPC error and no crash.

## Acceptance criteria

- [ ] C1. A stdio message over the hub's 1 MiB cap sent to the spoke is refused before schema validation, with a JSON-RPC error naming the cap, and the spoke stays up (test).
