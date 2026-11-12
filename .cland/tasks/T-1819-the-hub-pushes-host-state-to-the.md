---
id: T-1819
kind: task
title: The hub pushes host state to the workbenches
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by: []
topic: null
branch: null
created: 2026-11-12T10:07:19.308Z
updated: 2026-11-12T10:07:41.138Z
---

## Summary

The hub pushes a `hosts.state` frame to the workbenches on connect and on every change. It carries one line per pool, with its hosts, slots and logins in use, and the pool's host list. The frame marks a pool alerted the moment a host's tunnel drops or its provider fails, so the Hosts row can turn red at once rather than at General's 3-minute line.

## What to build

A client-safe projection of the pool and host records, pushed as `remote.state` is: in the featured sessions snapshot, as a standalone frame on a non-snapshot connect, and on every change, at most one push a second. Per pool:
- name, provider and region;
- the live hosts against `max_hosts`, and the slots in use against the slots of those hosts, in weight;
- per harness, the logins in use and the logins the pool can use (its provider and region), with the signed-out ones counted apart (question 10);
- an alert, or none: an unreachable host with the start of its outage, or a provider failure (a refused create or a rate-limit pause) with its reason (question 8);
- the hosts: id, size, region, state, creation time, the sessions on it, the declared price per hour and today's spend.

Changes come from the provision records, the host-health outage start and end, sessions placed on or leaving a host, login binding and state changes, pool configuration reloads and the pool runtime's create results. Spend is re-pushed at most once a minute while a host is live (question 7). The frame never carries an address, an SSH identity, a volume id or a token. The 3-minute `unreachable` state and General's line are unchanged. Clients speaking the previous wire shape ignore the frame.

## Acceptance criteria

- [ ] C1. A client receives `hosts.state` on connect and in the featured sessions snapshot, with per pool the live hosts against `max_hosts`, the slots in use against the total, and per harness the logins in use against the logins the pool can use (test).
- [ ] C2. Each host entry carries id, size, region, state, creation time, its sessions, the declared price per hour and today's spend, and the frame carries no address, SSH identity, volume id or token (test).
- [ ] C3. A session placed on a fake host, its exit, a login bound or signed out, and `cland config set hosts.<pool>.max_hosts` each push an updated frame within one second of hub-clock time, at most one push a second (test).
- [ ] C4. When a fake host's tunnel drops, the next frame marks its pool alerted with that host and the outage start, before the 3-minute `unreachable` state, and the alert clears when the tunnel returns (test).
- [ ] C5. A refused create or a rate-limit pause on the fake provider marks the pool alerted with the reason until a create succeeds (test).
- [ ] C6. A client speaking the previous wire shape connects and works unchanged, and a project with no `[hosts.<pool>]` table pushes an empty pool list (test).

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/host/hosts-state.ts` (new), `hub/src/host/host-health.ts` (the outage-start signal), `hub/src/hub/core.ts`, `hub/src/hub/snapshot.ts`. Registration points: `hub/src/protocol.ts`, `shared/wire/index.ts` and its conformance, `hub/src/hub/dispatch.ts` (the connect frame).
- Tests: new `hub/test/hosts-state.test.ts` (T2, `projectHub`, the fake host provider and the fake transport, the hub clock).
- Serves epic C1.
