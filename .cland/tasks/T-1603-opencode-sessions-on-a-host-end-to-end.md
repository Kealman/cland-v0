---
id: T-1603
kind: task
title: OpenCode sessions on a host, end to end
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1600
  - T-1601
  - T-1644
topic: null
branch: null
created: 2026-11-02T03:33:56.105Z
updated: 2026-11-03T22:00:57.575Z
---

## Summary

An OpenCode session launched with `host` naming a fake host starts `opencode serve` through that host's agent on a host loopback port. The hub's OpenCode client reaches it through the session's per-session forward on a hub-side Unix socket. Deliveries, state and stop work as on the local host, and the stop cancels the forward.

Hot files: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/server.ts`, `hub/src/adapters/opencode/client.ts`, `hub/test/opencode-remote.test.ts` (new)

## Acceptance criteria

- [ ] C1. Through the frame protocol, an OpenCode session launched on a fake host with the scripted OpenCode fake receives a delivery and reports `idle` after its turn (test).
- [ ] C2. The OpenCode client talks to the server only through the per-session forward's hub-side Unix socket, and no hub-side TCP connection to a host port exists (test).
- [ ] C3. The session's spoke runs on the fake host and connects through `spoke.sock` with the host's secret (test).
- [ ] C4. Stopping the session stops its server through the agent by identity and cancels its forward, and nothing on the hub's machine is signalled (test).
- [ ] C5. The opencode-adapter and opencode-native test files pass with no test edited.

## Notes

Shared files: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/server.ts`
