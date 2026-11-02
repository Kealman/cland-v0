---
id: T-1617
kind: task
title: Hub start, stop, status, doctor and the orphan sweep read a foreign holder
state: open
status: planned
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by:
  - T-1615
topic: null
branch: null
created: 2026-11-02T03:34:16.800Z
updated: 2026-11-02T05:44:40.308Z
---

## Summary

Every reader of `.cland/hub.lock` outside the daemon understands a foreign holder. It names the holder's hostname and heartbeat age, treats a lapsed holder as startable, and never signals or matches a foreign pid on this machine.

Hot files: `hub/src/cli/hub.ts`, `hub/src/doctor/project.ts`, `hub/src/orphans.ts`, `hub/src/hub/lock.ts` (reader helpers only)

## Acceptance criteria

- [ ] C1. `cland hub start` against a fresh foreign lock exits with a message naming the holder's hostname, pid and heartbeat age, and leaves no second hub running (test).
- [ ] C2. `cland hub stop` against a foreign holder signals no local process, says the hub runs on another host, and leaves `hub.json` and the lock in place (test).
- [ ] C3. `cland hub status` and `cland doctor` report a fresh foreign holder with its hostname and heartbeat age, and a lapsed one as startable (test).
- [ ] C4. The orphan sweep never matches a foreign holder's pid against local process rows (test).
- [ ] C5. The existing `cland hub` CLI, doctor and orphan tests (`edges.test.ts`, `orphan-servers.test.ts`, `doctor.test.ts` and `doctor-cli.test.ts`) pass with no test edited.

- [ ] C6. `tracker/offline-migrate.ts`, which takes the hub lock, refuses while a foreign holder's heartbeat is fresh, naming the holder's host, and never signals its pid (test).
## Notes

Shared files: see Hot files
