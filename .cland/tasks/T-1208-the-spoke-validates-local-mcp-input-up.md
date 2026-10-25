---
id: T-1208
kind: task
title: The spoke validates local MCP input up to the SDK's 10 MiB before the hub's 1 MiB frame cap applies
state: open
status: in progress
size: S
labels:
  - needs-triage
assignee: null
parent: E-1284
blocked_by: []
topic: topic-1047
branch: t/T-1208-the-spoke-validates-local-mcp-input-up
created: 2026-10-24T06:48:03.158Z
updated: 2026-10-25T11:31:20.385Z
---

## Summary

impl-1189 inspected the validation boundaries during T-1189 (2026-10-24) and found a mismatch. The hub's WebSocket edges cap frames at 1 MiB, and its Unix and stdio line readers check the byte length before parsing. The local spoke (runSpoke) is different: it uses the MCP SDK's StdioServerTransport, whose default read buffer is 10 MiB, and it validates JSONRPCMessageSchema and CallToolRequestSchema before forwarding to the hub's 1 MiB cap. So a local MCP client can make the spoke parse and validate up to 10 MiB, ten times the hub's cap. Network clients cannot.

## What to build

Bound the spoke's stdio input to the hub's frame cap before it parses or validates. Reject an oversized message with a clear JSON-RPC error and no crash.

## Acceptance criteria

- [ ] C1. A stdio message over the hub's 1 MiB cap sent to the spoke is refused before schema validation, with a JSON-RPC error naming the cap, and the spoke stays up (test).

## Comments

### impl-1208 · 2026-10-25T11:31:20.385Z

Pre-change rule-20 inventory: searched production hub/src and hub/bin, shared, web, nvim, all hub/test tiers/fixtures/startup probes, qa, docs and shipped .agents skills for spoke.ts, StdioServerTransport, spawnSpoke, inProcessSpoke, SPOKE_ENTRY and cland-spoke. Full file/line inventory attached in this item's topic. Direct runtime owner is hub/bin/cland-spoke.ts; three harness adapters launch it. Existing T3 spawnSpoke/fake-binary/scenario consumers continue valid MCP lines unchanged; T2 inProcessSpoke uses injected InMemoryTransport and is unaffected. Web/Neovim communicate with hub protocol edges, not this MCP stdin. QA briefs only exercise valid tool calls; no persisted record shape, SDK request schema, tool schema, permission, hub frame or role clause changes. New refusal is only for >1 MiB local MCP input; no new field to migrate. Preserve previous wire shape with raw valid initialize/ping and schema-invalid under-cap regression alongside oversize refusal/recovery.
