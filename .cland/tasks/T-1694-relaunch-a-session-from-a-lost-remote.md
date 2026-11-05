---
id: T-1694
kind: task
title: "Relaunch a session from a lost remote host onto the hub's own machine (host: local)"
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-05T19:03:57.790Z
updated: 2026-11-05T19:03:57.790Z
---

## Summary

T-1614 lets a session whose remote host is down, gone or rebooted relaunch on another registered remote host. It refuses `host: local` (the hub's own machine) because the local clone, lease and worktree path differ from a host's. A relaunch from a lost remote host onto the hub's machine is a natural fallback for a single-machine user whose only remote host died.

## What to build

Extend the cross-host relaunch so the destination may be `local`. Steps:
- the hub fetches the pushed task branch from the territory into the local worktree;
- the branch lease moves from the remote host to local under the territory lock;
- the session starts a fresh native conversation with the brief and the relaunch note, as T-1614 does for remote destinations;
- the old generation stays a named obligation.

## Acceptance criteria

- [ ] C1. After `fake-host.ts gone f1`, a relaunch with `host: "local"` adds the local worktree at the territory's pushed tip, and the session runs locally (test).
- [ ] C2. The lease moves from f1 to local under the territory lock: f1's pushes to the branch are refused, and local pushes succeed (test).
