---
id: T-1749
kind: task
title: Idle stop
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1746
topic: null
branch: null
created: 2026-11-07T16:01:59.051Z
updated: 2026-11-08T14:50:04.849Z
---

## Summary

The scheduler stops an empty host after the pool's `idle_stop` (20 minutes by default). It never stops one before the provider's billing minimum (`earliestStop`), never below `min_hosts`, and never a host with sessions. A host that gains a session during its idle wait restarts the wait. On DigitalOcean and on the fake, a stop destroys the host through the confirmed destroy path.

## What to build

The scale-down half of the scheduler. It uses `earliestStop` from `hub/src/host/provider/declarations.ts`, as `docs/hub/host-providers.md` requires of this epic. `idle_stop` is a real config key: tests and the QA demo shorten it in `config.toml`.

## Acceptance criteria

- [ ] C1. With `idle_stop = "1m"` on the hub clock, an emptied host above `min_hosts` is destroyed after one minute, and the pool's last host at `min_hosts` stays (test).
- [ ] C2. A host whose provider billing minimum has not passed is not stopped before `earliestStop` (test).
- [ ] C3. A host with a session is never stopped by idle stop, however long it runs (test).
- [ ] C4. A host that gains a session during its idle wait is not stopped at the old time (test).

## Blocked by

- T-1746

## Notes

- Hot files: `hub/src/host/pool-runtime.ts`, `hub/src/host/scheduler.ts` (stop decision).
- Tests: new `hub/test/pool-idle-stop.test.ts` (T2, fake clock).
- Serves epic C4.
