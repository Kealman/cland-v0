---
id: T-1595
kind: task
title: The transport layer and the ssh carrier's master
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1588
  - T-1589
  - T-1590
  - T-1594
topic: null
branch: null
created: 2026-11-02T03:33:54.197Z
updated: 2026-11-02T23:40:45.373Z
---

## Summary

A `Transport` interface separates carrying from providing, with `TransportKind` `ssh` only. The `ssh` carrier bootstraps a host over a one-shot connection (its script on stdin creates `~/.cland-host/run` at 0700, writes the per-host secret and starts the supervisor if it is not running), then keeps one hub-owned `ControlMaster` per host with the spec's options and the four forwards (`-R hub.sock`, `-R spoke.sock`, `-R git.sock`, `-L agent.sock`). Its own reconnect loop backs off from 1 s to 30 s with jitter, resets after 30 s up, retries at once on wake, runs `-O exit` and removes a stale control socket before each start, and probes end to end through `agent.sock` every 30 s, with each host's tunnel state shown in `hub.status`.

Hot files: `hub/src/transport/transport.ts` (new), `hub/src/transport/ssh.ts` (new), `hub/src/hub/dispatch.ts` (`hub.status` hosts), `hub/src/cli/hub.ts` (status print), `hub/test/transport-ssh.test.ts` (new)

## Acceptance criteria

- [ ] C1. The master's argv contains `-N`, `-a`, `-x`, `-F /dev/null`, `BatchMode=yes`, `IdentitiesOnly=yes`, `ExitOnForwardFailure=yes`, `ServerAliveInterval=15`, `ServerAliveCountMax=4`, `StrictHostKeyChecking=yes` and the host's own `UserKnownHostsFile`, and the four forwards, all Unix-socket paths with no port on any listening side (test).
- [ ] C2. Bootstrap passes the per-host secret only on stdin, never in argv, and a second bootstrap on a host whose supervisor lives starts nothing new (test).
- [ ] C3. With an injected clock, consecutive failures back off 1, 2, 4 … 30 s with jitter. A master that stayed up 30 s resets the backoff, and a wall-clock jump retries at once (test).
- [ ] C4. Before each start the carrier runs `-O exit` on the control path and removes a leftover control socket, and a new master after a SIGKILL multiplexes (`-O check` succeeds) (test).
- [ ] C5. On a fake host, a master killed with SIGKILL is back with all four forwards and a successful probe within 10 s (test).
- [ ] C6. The probe runs every 30 s through `agent.sock`, and `hub.status` and `cland hub status` show each host's tunnel state (`up`, `connecting`, `down`), its time since, its last probe and its reconnect count (test).
- [ ] C7. A host whose pinned key differs from the host's own is never connected, and the refusal is logged without key material (test).

## Notes

Shared files: `hub/src/transport/transport.ts` (sole owner; E-1538 adds kind validation and its contract test without changing members); `hub.status` `hosts` field (owned here)
