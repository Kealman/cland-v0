---
id: T-1752
kind: task
title: Hub restart with hosts, and gone hosts' sessions exited
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1746
  - T-1748
topic: null
branch: null
created: 2026-11-07T16:01:59.635Z
updated: 2026-11-08T14:50:05.823Z
---

## Summary

At start, the hub restores its hosts:
- re-reads its leases and re-opens the tunnels of registered hosts;
- re-finds session rows;
- re-arms each lease's watchdog when it is gone;
- re-attaches each live host's renewal timer;
- asks each lease's provider for the machine.

A lease whose machine is gone ends its sessions as exited, vacates their roles, releases the lease and settles its spend. A session row whose host the hub no longer knows counts as gone, not alive. Re-found hosts count toward `min_hosts` and `max_hosts`, so no extra host starts.

## What to build

Start-time reconciliation over leases and provider status, with the `unknown host` state becoming exited. It reuses the confirmed-deletion settlement of `cland host destroy`. This ticket reads no shortened-timeout knob: its deadlines are `lease` and the renewal cadence, both real config. A host whose tunnel cannot be re-opened at start is handed to T-1753's outage clock, which honours `CLAND_TEST_HOST_UNREACHABLE_MS` and `CLAND_TEST_HOST_LOST_MS`.

## Acceptance criteria

- [ ] C1. A restart with two fake hosts, one deleted while the hub was stopped, keeps the live host's session running and ends the deleted host's session as exited, with its role vacated (test).
- [ ] C2. That deleted host's lease is released and its spend settled (test).
- [ ] C3. A session row whose host is unknown to the restarted hub reads exited, never running (test).
- [ ] C4. After a restart with `min_hosts = 1` and one live host, no further host is created (test).
- [ ] C5. At start, a lease whose watchdog is gone is re-armed, and a lease whose watchdog lives is not given a second one (test).
- [ ] C6. After a restart, a live host in use is renewed on the min(1 h, lease / 4) cadence (test).

## Blocked by

- T-1746
- T-1748

## Notes

- Hot files: `hub/src/hub/daemon.ts`, `hub/src/host/host-leases.ts`, `hub/src/host/host-watchdog.ts` (re-arm), `hub/src/host/registry.ts`, `hub/src/adapters/sessions.ts` (exited path generalised from `hostDeleted`).
- Tests: new `hub/test/host-restart.test.ts` (T3: two fake hosts, one deleted while the hub is stopped); T2 cases for the unknown-host rule.
- Serves epic C5 and C6.
