---
id: T-1747
kind: task
title: The host lease in `hub.db`, its renewal and its spend reservation
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1737
  - T-1738
  - T-1742
topic: null
branch: null
created: 2026-11-07T16:01:58.643Z
updated: 2026-11-07T16:02:06.370Z
---

## Summary

Every host has a lease in `hub.db`, in its own table. The lease is written before the provider's create call, with a deadline of `[hosts] lease` (12 h by default), and is held until the host's deletion is confirmed. At create, the host reserves its price up to the deadline under the ledger's `hosts` category; a reservation the caps refuse stops the create before any provider call. While the host has sessions or is held by `min_hosts`, the lease is renewed to a full lease from now, and its reservation raised, every min(1 h, lease / 4). Deletion settles the cost on the real lifetime. A per-host lease file mirrors the deadline for the detached watchdog (T-1748).

## What to build

The lease table and a per-host renewal timer on the hub clock, armed at create, with a caller-supplied "in use" predicate. The reservation and settlement go through T-1742's API. The lease file is written after the database and never holds a later deadline than it; the watchdog never opens `hub.db`. There is no `daemon.ts` change: re-attaching renewal after a hub restart is T-1752's. Until then a restarted hub does not renew leases, which is acceptable on the fake provider, since DigitalOcean creation stays refused until T-1756.

## Acceptance criteria

- [ ] C1. A lease row with deadline create + `[hosts] lease` exists before the provider's acquire is called, and the hosts reservation is in the ledger with the host's pool (test).
- [ ] C2. A create whose reservation the hosts cap refuses makes no provider call and leaves no lease (test).
- [ ] C3. On the hub clock, a host with a session or held by `min_hosts` is renewed every min(1 h, lease / 4) to a full lease from now, with its reservation raised, and an empty host above `min_hosts` is not renewed (test).
- [ ] C4. The lease is released and the cost settled on the real lifetime only after the provider confirms deletion, and an unconfirmed deletion keeps both (test).
- [ ] C5. The lease file's deadline never runs later than the database's, including across a renewal (test).

## Blocked by

- T-1737
- T-1738
- T-1742

## Notes

- Hot files: `hub/src/host/host-leases.ts` (new), `hub/src/host/provision-host.ts` (lease and reservation before acquire, renewal timer, settle at confirmed release), `hub/src/host/provision-records.ts` (if the lease joins that store).
- Tests: new `hub/test/host-lease.test.ts` (T2, fake clock, fake provider, isolated `XDG_STATE_HOME`).
- Serves epic C5 and C7.
