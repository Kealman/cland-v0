---
id: T-1613
kind: task
title: A rebooted host ends its sessions
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1612
topic: null
branch: null
created: 2026-11-02T03:33:58.539Z
updated: 2026-11-02T03:33:58.539Z
---

## Summary

The agent's hello carries its boot id. When a host comes back with a boot id other than the one its rows were recorded under, the hub marks those sessions exited, vacates their roles as for an exited local session, and bootstraps the host's supervisor again. `fake-host.ts reboot` ends all of a fake host's processes, clears its run directory and writes a new boot id.

Hot files: `hub/src/adapters/sessions.ts`, `hub/src/host/ssh-host.ts`, `hub/test/fakes/fake-host.ts`, `hub/test/host-reboot.test.ts` (new)

## Acceptance criteria

- [ ] C1. After `fake-host.ts reboot`, every session on that host reads `exited` and its role is vacated with the same notice as a local harness exit, while sessions on the other fake host are untouched (test).
- [ ] C2. The hub restarts the rebooted host's supervisor and agent and the tunnel is `up` again (test).
- [ ] C3. No stop or signal is sent for the exited rows to any host or to the hub's machine (test).

## Notes

Shared files: `hub/src/adapters/sessions.ts` (exit and vacate), the fake-host control script (adds reboot)
