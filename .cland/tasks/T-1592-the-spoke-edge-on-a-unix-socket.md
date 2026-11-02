---
id: T-1592
kind: task
title: The spoke edge on a Unix socket
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: null
branch: null
created: 2026-11-02T03:33:53.512Z
updated: 2026-11-02T03:34:41.573Z
---

## Summary

The hub listens for spokes on `.cland/run/spoke.sock`, mode 0600, beside its loopback port. It uses the same WebSocket protocol and the same bearer admission, so a spoke can dial `ws+unix:`. Local spokes and `hub.json` are unchanged.

Hot files: `hub/src/hub/server.ts`, `hub/src/hub/daemon.ts`, `hub/test/spoke-unix-edge.test.ts` (new)

## Acceptance criteria

- [ ] C1. A started hub binds `.cland/run/spoke.sock` at 0600 (with the short-path fallback), and a spoke connecting through `ws+unix:` with the project secret gets a welcome like one on the loopback port (test).
- [ ] C2. A connection there without the bearer secret, or with a wrong one, is refused and logged as on the loopback edge (test).
- [ ] C3. A stale socket file left by a dead hub is replaced at start, and a hub stop removes only the file it bound (test).
- [ ] C4. A client hello is refused on the Unix spoke edge exactly as on the spokes' WebSocket, and the spoke-reconnect and hub-socket test files pass with no test edited.

## Notes

Shared files: `hub/src/hub/daemon.ts` (edge startup; 13 and 26 later)
