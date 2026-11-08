---
id: T-1746
kind: task
title: Hosts started on demand, `min_hosts` kept, scaling with `cland config set`
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1745
  - T-1737
  - T-1738
topic: null
branch: null
created: 2026-11-07T16:01:58.402Z
updated: 2026-11-08T00:38:56.312Z
---

## Summary

The pool runtime creates hosts through the create path. It keeps `min_hosts` hosts per pool from hub start, and starts a further host for a waiting launch while ready plus booting hosts are below `max_hosts`. While that host boots, the launch's reason reads "waiting for host <id> to boot", and the launch is placed when the host is ready. A `max_hosts` raised with `cland config set` re-runs placement at once. Nothing raises `max_hosts` by itself.

## What to build

The scale-up half of the scheduler, over T-1740's decisions. It is driven by hub start, launches, readiness and configuration changes, with one in-flight create per decision. Several waiting launches that fit one new host start one host. Creation goes through T-1737's create seam, without editing `provision-host.ts`.

## Acceptance criteria

- [ ] C1. A hub starting with an empty `agents` pool of `min_hosts = 1` creates one fake host without any launch (test).
- [ ] C2. A launch with no room in a pool below `max_hosts` starts a host, waits as "waiting for host <id> to boot", and is placed when that host is ready (test).
- [ ] C3. With `max_hosts` reached, a launch waits as "waiting for a host", and `cland config set hosts.agents.max_hosts 2` starts a second host and places the launch without a hub restart (test).
- [ ] C4. Booting hosts count toward `max_hosts`, and two waiting launches that fit one new host start one host (test).
- [ ] C5. With more waiting launches than `max_hosts` hosts can hold, the pool never exceeds `max_hosts` (test).

## Blocked by

- T-1745
- T-1737
- T-1738

## Notes

- Hot files: `hub/src/host/pool-runtime.ts`, `hub/src/hub/daemon.ts` (start and config-apply hooks).
- Tests: new `hub/test/pool-scale.test.ts` (T2, injected create seam); one case on the host-create fixture (T3), in which a waiting launch starts a fake host and is placed on it.
- Serves epic C1, C3 and C4.
