---
id: T-1696
kind: task
title: Adapters key transport and watch state by generation, with a no-signal handoff that releases an unreachable old generation (prefactor for T-1614)
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: null
branch: t/T-1696-adapters-key-transport-and-watch-state
created: 2026-11-05T19:05:29.327Z
updated: 2026-11-05T19:05:53.929Z
---

## Summary

T-1614 (relaunch elsewhere) starts a fresh native generation of a session on another host while keeping the same cland sessionId. The adapters key transport and in-flight state by the stable sessionId:
- OpenCode's `#connections` and `#forwards`, with `#connectTo` reusing a connection by URL alone;
- Codex's and Claude's watcher and in-flight maps.

A fresh launch on f2 can reuse f1's connection when the host-local URL matches. Cleanup of the old generation's forwards or watches can also race the new generation that shares the id. Found by impl-1614 before it touched adapter internals.

## What to build

Add a generation handoff to the adapter contract, used by T-1614:
- adapter transport, forward, watch and in-flight state is keyed by the generation (the launch generation or native identity), not by the sessionId alone;
- connection reuse requires the same generation, never the URL alone;
- an optional adapter hook releases an unreachable old generation: it drains and drops that generation's transport, forward, watch and in-flight work with no native signal and no Host call to the lost host, then reports what it dropped;
- the Sessions caller invokes the hook before starting the new generation and keeps the old generation's obligations (T-1613, T-1666) unchanged.

## Acceptance criteria

- [ ] C1. For each of OpenCode, Codex and Claude, a new generation with the same sessionId and the same host-local URL never reuses the old generation's connection, forward or watch (test).
- [ ] C2. Releasing an unreachable generation sends no signal and makes no Host call to its host, drops its transport, forward, watch and in-flight state, and cannot affect a running new generation with the same id (test, with a held old cleanup racing the new launch).
- [ ] C3. Same-host resume and the existing stop, settle and revoke behaviour are unchanged: the existing adapter and session tests pass with no test edited.
