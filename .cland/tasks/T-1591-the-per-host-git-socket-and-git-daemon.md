---
id: T-1591
kind: task
title: The per-host git socket and git daemon --inetd
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1326
branch: t/T-1591-the-per-host-git-socket-and-git-daemon
created: 2026-11-02T03:33:53.201Z
updated: 2026-11-02T05:58:37.602Z
---

## Summary

For each host the hub listens on a per-host git socket at 0600. Each connection gets its own `git daemon --inetd` over the territory, with half-open sockets on both ends. The environment is explicit: no `CLAND_TERRITORY_WRITE`, `CLAND_PUSH_HOST=<host>`, and `receive.fsckObjects`, `receive.autogc=false`, `receive.denyDeletes=true` and a `receive.maxInputSize` cap through `GIT_CONFIG_COUNT`. The host-side git proxy (Node built-ins) joins git's stdin and stdout to `git.sock`.

Hot files: `hub/src/host/git-daemon.ts` (new), `hub/src/host/git-proxy.ts` (new), `hub/test/host-git-daemon.test.ts` (new)

## Acceptance criteria

- [x] C1. In a scratch territory, a client using the git proxy on the per-host socket as `core.gitProxy` clones, fetches and pushes a `t/` task branch, and a fetch of a large pack completes without "unexpected disconnect while reading sideband packet" (test).
  - done: impl-1591 · 2026-11-02T05:57:04.943Z
- [x] C2. The daemon's environment lacks `CLAND_TERRITORY_WRITE` even when the hub's own environment has it set to `1`, and carries `CLAND_PUSH_HOST` and the four `receive.*` settings (test).
  - done: impl-1591 · 2026-11-02T05:57:05.848Z
- [x] C3. A push to `dev` or to the default branch through the socket is refused by the territory's hook, and a branch deletion is refused (test).
  - done: impl-1591 · 2026-11-02T05:57:06.940Z
- [x] C4. The per-host socket is a Unix socket at 0600, and no TCP port is opened for git on the hub's side (test).
  - done: impl-1591 · 2026-11-02T05:57:07.736Z
- [x] C5. Each connection's daemon exit is logged with its host, duration and exit code, the log carries no environment values, and the listener caps concurrent daemons per host (test).
  - done: impl-1591 · 2026-11-02T05:57:11.618Z

## Notes

Shared files: the git daemon's environment (sole owner); `TERRITORY_HOOK` untouched here (owned by 11)

## Comments

### impl-1591 · 2026-11-02T05:43:29.971Z

Consumer inventory before implementation: rg of git daemon / git.sock / gitProxy / CLAND_PUSH_HOST in hub/src, hub/test, web, shared, nvim, docs, qa and .agents finds no existing production listener/proxy API. New exported listener/proxy are consumed initially by host-git-daemon.test.ts; future transport/bootstrap own integration. Existing TERRITORY_HOOK in territory.ts is consumed unchanged (T-1597 owns migration); no existing wire/list/schema changes. Daemon environment is owned here; no role permissions or CLI changes.

### impl-1591 · 2026-11-02T05:50:07.648Z

Implementation committed as ef66c4621; origin/dev fetched with --no-auto-maintenance, merge already up to date; merge-tree clean. Final refinement tracks/drains half-open sockets and joins identity probes at native close. Targeted native Git cases passed on macOS/Node 24.21.0 (no browser, provider, TCP or SSH); final lint found new file missing from tiers.json, now registered T3. Remaining final checks wait for required load <=10. No full suite run before source review.
