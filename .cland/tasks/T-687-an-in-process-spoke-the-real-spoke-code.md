---
id: T-687
kind: task
title: "An in-process spoke: the real spoke code over an in-memory MCP transport, connected to projectHub's real socket"
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: null
branch: null
created: 2026-10-16T19:59:28.543Z
updated: 2026-10-16T19:59:28.543Z
---

## Summary

`spawnSpoke` (`hub/test/harness.ts`) is a child process (`StdioClientTransport` on `bin/cland-spoke.ts`), called 614 times, mostly to obtain a role-bearing caller or an observer (memo §2.3 anti-pattern 6; report-slice1 opening finding; report-slice3 anti-pattern 2). T2 forbids spawned spokes, so T2 needs a spoke that runs in the test process and keeps the spoke's tool surface.

## What to build

- **A seam in `runSpoke`** (`hub/src/spoke/spoke.ts`): it accepts the MCP server transport and an exit callback, defaulting to stdio and `process.exit`, so an in-process caller supplies an in-memory transport and an exit that ends only that spoke.
- **`inProcessSpoke(t, options)`** in the harness, with the same options and the same returned `Session` shape as `spawnSpoke` (tool calls, channel events, waits). Its hub side is the real `HubClient` connecting to `projectHub`'s Unix socket or WebSocket as a spawned spoke does; teardown closes both sides and passes `projectHub`'s resource check.
- **First consumer.** `routing.test.ts` (3 tests, 4.3 s, three spoke children per test) moves to `inProcessSpoke`.

## Acceptance criteria

- [ ] C1. `inProcessSpoke` returns the `Session` API of `spawnSpoke`, and a T2 test calls `send` and `task.view` and receives channel events with no child process, proved by the test and the tier lint.
- [ ] C2. The in-process spoke's tool list and instructions equal a spawned spoke's, proved by a surface test.
- [ ] C3. Ending an in-process session never calls `process.exit` and leaves no handle behind `projectHub`'s resource check, proved by a test.
- [ ] C4. `routing.test.ts` runs on `inProcessSpoke`, is tagged T2, keeps its assertions' meaning (audit), and its manifest seconds fall from 4.3 s to under 2 s.
