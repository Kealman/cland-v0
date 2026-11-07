---
id: T-1743
kind: task
title: Launches placed on a pool's host
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1738
  - T-1739
  - T-1740
topic: null
branch: null
created: 2026-11-07T16:01:57.824Z
updated: 2026-11-07T16:02:05.552Z
---

## Summary

`session.launch` reads the role's `pool` at each launch. For a pool other than `local`, the scheduler places the session on a ready host of that pool, by weight, densely or spread, and the session row names the host. A launch for a role bound to a pool missing from `config.toml` is refused, naming the configured pools, before any reservation. The Coordinator and the Aide stay on `local` (`checkRoleHost`). An explicit `host` in the frame pins the launch to that host and bypasses the pool.

## What to build

The tracer bullet from roles to a running session on a pool's host. Until T-1744, a pool with no host that can take the launch refuses it with "no host in pool <pool>". An explicitly pinned host with no room refuses the launch; a pinned launch never waits. The pool runtime takes membership from the provision records and used weight from the process table. It uses T-1737's injected create seam, so placement is testable with provided fake Hosts.

## Acceptance criteria

- [ ] C1. With `[implementer.launch] pool = "agents"` and one ready fake host in `agents`, an Implementer launch runs on that host, and `cland session list` names it (test).
- [ ] C2. A role with no pool, or `pool = "local"`, launches on the local host as before (test).
- [ ] C3. With two ready hosts, successive launches go to the fuller host with room, and after `spread = true` is set they go to the emptiest (test).
- [ ] C4. A launch for a role bound to a pool missing from `config.toml` is refused naming the configured pools, with no role reserved and no spawn (test).
- [ ] C5. Changing a role's `pool` in `roles.toml` between two launches moves the second launch without a hub restart (test).
- [ ] C6. A launch with an explicit `host` runs on that host whatever the role's pool, and is refused when that host has no room (test).

## Blocked by

- T-1738
- T-1739
- T-1740

## Notes

- Hot files: `hub/src/adapters/sessions.ts` (launch host selection), `hub/src/host/pool-runtime.ts` (new), `hub/src/hub/daemon.ts` (wiring).
- Tests: new `hub/test/session-pool-placement.test.ts` (T2, provided fake Hosts tagged by pool); one case on the host-create fixture (T3).
- Serves epic C1 and C2.
