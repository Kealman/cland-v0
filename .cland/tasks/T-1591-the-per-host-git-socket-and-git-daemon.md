---
id: T-1591
kind: task
title: The per-host git socket and git daemon --inetd
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: null
branch: null
created: 2026-11-02T03:33:53.201Z
updated: 2026-11-02T03:34:41.046Z
---

## Summary

For each host the hub listens on a per-host git socket at 0600. Each connection gets its own `git daemon --inetd` over the territory, with half-open sockets on both ends. The environment is explicit: no `CLAND_TERRITORY_WRITE`, `CLAND_PUSH_HOST=<host>`, and `receive.fsckObjects`, `receive.autogc=false`, `receive.denyDeletes=true` and a `receive.maxInputSize` cap through `GIT_CONFIG_COUNT`. The host-side git proxy (Node built-ins) joins git's stdin and stdout to `git.sock`.

Hot files: `hub/src/host/git-daemon.ts` (new), `hub/src/host/git-proxy.ts` (new), `hub/test/host-git-daemon.test.ts` (new)

## Acceptance criteria

- [ ] C1. In a scratch territory, a client using the git proxy on the per-host socket as `core.gitProxy` clones, fetches and pushes a `t/` task branch, and a fetch of a large pack completes without "unexpected disconnect while reading sideband packet" (test).
- [ ] C2. The daemon's environment lacks `CLAND_TERRITORY_WRITE` even when the hub's own environment has it set to `1`, and carries `CLAND_PUSH_HOST` and the four `receive.*` settings (test).
- [ ] C3. A push to `dev` or to the default branch through the socket is refused by the territory's hook, and a branch deletion is refused (test).
- [ ] C4. The per-host socket is a Unix socket at 0600, and no TCP port is opened for git on the hub's side (test).
- [ ] C5. Each connection's daemon exit is logged with its host, duration and exit code, the log carries no environment values, and the listener caps concurrent daemons per host (test).

## Notes

Shared files: the git daemon's environment (sole owner); `TERRITORY_HOOK` untouched here (owned by 11)
