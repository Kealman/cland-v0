---
id: T-1598
kind: task
title: Per-session forwards on the master
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1595
topic: null
branch: null
created: 2026-11-02T03:33:54.978Z
updated: 2026-11-02T03:33:54.978Z
---

## Summary

The carrier adds a per-session forward on the live master with `-O forward -L`. It runs from a hub-side Unix socket to a host Unix socket (Codex) or to a host loopback port (OpenCode), is cancelled with `-O cancel`, and is re-added with a short retry after every reconnect.

Hot files: `hub/src/transport/ssh.ts`, `hub/test/transport-forwards.test.ts` (new)

## Acceptance criteria

- [ ] C1. A forward to a host Unix socket and one to a host loopback port each give a hub-side Unix socket under the host's directory that reaches its target, and no hub-side TCP listener is created (test).
- [ ] C2. Cancelling a session's forwards removes them from the master and their hub-side socket files (test).
- [ ] C3. After a SIGKILLed master reconnects, every forward still recorded is back within the retry window, and one that keeps failing is logged once with its session and given up after the last retry (test).

## Notes

Shared files: `hub/src/transport/ssh.ts`
