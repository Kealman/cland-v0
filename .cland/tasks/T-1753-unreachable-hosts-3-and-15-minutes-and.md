---
id: T-1753
kind: task
title: "Unreachable hosts: 3 and 15 minutes, and hosts destroyed by anyone"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1752
topic: null
branch: null
created: 2026-11-07T16:01:59.872Z
updated: 2026-11-08T14:50:06.108Z
---

## Summary

When a host's tunnel is lost, the reconnect loop runs while its sessions live on, and the hub asks the provider about the machine. A machine reported gone makes the host's sessions exited at once. After 3 minutes down, General gets one line, "host <id> unreachable", and the host's state reads `unreachable`; this is the red state that `cland host list` and `cland host status` show. Back within 15 minutes, the state clears and nothing more is posted. Not back within 15 minutes, its sessions become exited, their roles are vacated, and the hub destroys the host through the confirmed destroy path. The hub also pulls the lease file's deadline to now, so the watchdog is the backstop.

## What to build

Per-host outage timers on the hub clock fed by tunnel status, once-per-outage lines, the 15-minute teardown, and a rate-bounded provider status check on tunnel loss. The 3 and 15 minutes stay fixed constants. The test-only knobs `CLAND_TEST_HOST_UNREACHABLE_MS` and `CLAND_TEST_HOST_LOST_MS` shorten them only inside the fake-host fence (`CLAND_FAKE_HOST_ROOT` set), like `CLAND_TEST_DROPLET_*`. A host whose tunnel cannot be re-opened at hub start enters the same clock from the start.

## Acceptance criteria

- [ ] C1. A tunnel down for 3 minutes of hub-clock time posts exactly one General line "host <id> unreachable", and the host reads `unreachable` in `cland host list --json` (test).
- [ ] C2. A tunnel back within 15 minutes clears the state, keeps the sessions running, and posts no second line for that outage (test).
- [ ] C3. A tunnel down for 15 minutes ends the host's sessions as exited, vacates their roles, destroys the host with a confirmed deletion, and moves its lease file deadline to that moment (test).
- [ ] C4. A machine the provider reports gone while its tunnel is down ends its sessions as exited without waiting for the 15 minutes (test).
- [ ] C5. A host whose tunnel cannot be re-opened at hub start starts its outage clock from the start time (test).
- [ ] C6. `CLAND_TEST_HOST_UNREACHABLE_MS` and `CLAND_TEST_HOST_LOST_MS` shorten the clocks inside the fake-host fence and are ignored without `CLAND_FAKE_HOST_ROOT` (test).

## Blocked by

- T-1752

## Notes

- Hot files: `hub/src/host/host-health.ts` (new), `hub/src/host/registry.ts` (tunnel status feed), `hub/src/host/provision-records.ts` (the `unreachable` state), `hub/src/adapters/sessions.ts` (exited path).
- Tests: new `hub/test/host-unreachable.test.ts` (T2, fake transport status and fake clock).
- Serves epic C6.
