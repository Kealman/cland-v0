---
id: T-1594
kind: task
title: The supervisor
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1593
topic: null
branch: null
created: 2026-11-02T03:33:54.007Z
updated: 2026-11-02T03:33:54.007Z
---

## Summary

A `setsid nohup` supervisor loop keeps `cland host serve` alive with no systemd: it starts once, refuses to run twice, ignores SIGHUP and restarts the agent within about 2 s after any exit. Harnesses the agent spawned are untouched by the agent's restart.

Hot files: `hub/src/host/agent/supervisor.sh` (new), `hub/src/host/agent/server.ts` (pid file, SIGHUP), `hub/test/fakes/fake-host.ts`, `hub/test/host-supervisor.test.ts` (new)

## Acceptance criteria

- [ ] C1. Started on a fake host, the supervisor runs the agent, and a second start while it lives exits without starting another (test).
- [ ] C2. After the agent is killed with SIGKILL, a new agent answers its hello within 3 s, and a process the old agent spawned is still alive with the same identity in the new agent's table (test).
- [ ] C3. The supervisor and the agent survive the end of the session that started them and a SIGHUP, and nothing in either calls `systemctl` or `systemd-run` (test).
- [ ] C4. `fake-host.ts kill-agent <host>` kills that host's agent and leaves the supervisor and harnesses running (test).

## Notes

Shared files: the fake-host control script (adds kill-agent)
