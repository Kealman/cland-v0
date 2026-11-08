---
id: T-1755
kind: task
title: "`cland host status` and `cland host stop`"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1738
  - T-1740
  - T-1742
  - T-1747
topic: null
branch: null
created: 2026-11-07T16:02:00.281Z
updated: 2026-11-08T14:50:07.207Z
---

## Summary

`cland host status` (frame `host.status`) shows two levels:
- **Per pool:** the hosts, the slots in use against the total, and today's and the month's spend.
- **Per host:** id, size, region, uptime, sessions, the declared price per hour and its state, so a host marked `unreachable` reads so.

`cland host stop <id>` (frame `host.stop`) ends the host's sessions as exited and stops the host, which on DigitalOcean and the fake means destroying it; E-1535 adds login release first. Both frames are for the local human CLI or Neovim only, like the other `host.*` frames.

## What to build

The status view over provision records, the process table with T-1740's weights, and T-1742's per-pool totals, with `--json`. Spend is settled costs of the period plus the accrued cost of live hosts (uptime × price), not reservations; storage arrives with logins. `host stop` goes through the confirmed destroy path, and the scheduler treats a stopped host like a destroyed one. `cland host create` stays as a manual add through the same lease, watchdog and spend admission, counted toward `max_hosts`.

## Acceptance criteria

- [ ] C1. `cland host status` shows, per pool, the number of hosts, the slots used of the total by weight, and today's and the month's spend from that pool's `hosts` ledger entries plus live hosts' accrued cost (test).
- [ ] C2. Each host line shows id, size, region, uptime, sessions, price per hour and state, and a host recorded `unreachable` reads `unreachable` (test).
- [ ] C3. `cland host stop <id>` ends that host's sessions as exited and destroys the host with confirmed reads (test).
- [ ] C4. `cland host create` at `max_hosts` is refused naming `max_hosts` (test).
- [ ] C5. `host.status` and `host.stop` from a session or a remote are refused, and `cland host --help` lists `status` and `stop` (test).

## Blocked by

- T-1738
- T-1740
- T-1742
- T-1747

## Notes

- Hot files: `hub/src/cli/host.ts`, `hub/src/cli/help.ts`, `hub/src/hub/dispatch.ts` (`host.status`, `host.stop`, the `host.create` limit), `hub/src/protocol.ts`, `hub/src/hub/web-authority.ts`.
- Tests: new `hub/test/host-status.test.ts` and `hub/test/host-stop.test.ts` (T2).
- Serves epic C8 and C4.
