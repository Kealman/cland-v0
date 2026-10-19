---
id: T-793
kind: task
title: The MCP verify tool publishes a generic object schema and refuses a missing field with only "invalid verify request"
state: open
status: planned
size: XS
labels:
  - ready-for-agent
  - v0.1.5
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-18T09:29:02.859Z
updated: 2026-10-19T10:25:17.109Z
---

## Summary

On 2026-10-18 impl-634 called the cland MCP `verify` tool with `{executor, report, to}` and got `{ok:false, error:"invalid verify request"}`. dispatch.ts `startSuite` requires a full `suite.start` client request (an absolute `cwd`, among others), but the tool's published schema is a generic key/value object, so an agent cannot discover the shape. impl-642's call with `cwd` set succeeded.

## Acceptance criteria

- [ ] C1. The MCP `verify` tool publishes its real input schema (cwd, mode, executor, report, to, occasion, dryRun, workers, size, fresh) with descriptions. `cwd` defaults to the caller's claimed item worktree when omitted.
- [ ] C2. A malformed request is refused with the names of the missing or invalid fields, not a generic message. A T2 test covers both.
