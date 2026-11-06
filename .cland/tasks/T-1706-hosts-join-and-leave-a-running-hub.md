---
id: T-1706
kind: task
title: Hosts join and leave a running hub (prefactor)
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
topic: topic-1400
branch: t/T-1706-hosts-join-and-leave-a-running-hub
created: 2026-11-06T10:47:42.499Z
updated: 2026-11-06T10:50:07.870Z
---

## Summary

Today the hub opens its SSH hosts once at start, and the sessions' host map is fixed at construction. This prefactor lets a host registered after start open its carrier, git daemon and Host and join the sessions' map without a restart. Removing a host takes it out through the existing revoke settlement. Behaviour for hosts present at start is unchanged.

Hot files: `hub/src/host/registry.ts`, `hub/src/adapters/sessions.ts` (`#hosts`), `hub/src/hub/daemon.ts`, `hub/test/host-runtime-join.test.ts` (new)

## What to build

An owner API on the project's SSH hosts, `add(record)` and `remove(id)`, used by the daemon and handed to the sessions. A host added while serving runs the same path as one opened at start: carrier start, git daemon, clone on first worktree add. A removed host is quiesced and closed in the same order as at hub stop. Its rows are settled the way `host.revoke` settles them, never left `running`.

Notes: `projectSshHosts` is owned here; the later create-to-ready and destroy tickets call `add` and `remove`.

## Acceptance criteria

- [ ] C1. A fake host registered on a running hub opens its tunnel and takes a `session.launch` with its `host` within the test budget, with no hub restart (test).
- [ ] C2. Removing that host stops its carrier and git daemon, and its running session rows settle through the revoke path, never staying `running` (test).
- [ ] C3. A host added at runtime is reopened at the next hub start like any registered host (test).
- [ ] C4. The existing host test files (`host-ssh-registry`, `host-relaunch`, `host-survival-native`) pass with no test edited.
