---
id: T-1711
kind: task
title: Provider declarations and the billing minimum
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1707
topic: null
branch: null
created: 2026-11-06T10:48:10.742Z
updated: 2026-11-06T10:49:14.574Z
---

## Summary

Each provider declares its live and idle price per hour per size, whether a stopped machine bills compute (and so stopping destroys it), its billing granularity and minimum, its token confinement, its API pacing, its machine limit, its CPU architecture and any extra paid address its SSH needs, counted in the idle price. A pure policy function gives the earliest time a host may be stopped, which the scheduler's `idle_stop` (E-1534) must call.

Hot files: `hub/src/host/provider/provider.ts`, `hub/src/host/provider/declarations.ts` (new), `hub/src/host/provider/fake.ts`, `hub/test/host-provider-declarations.test.ts` (new)

## What to build

A validated declarations type, configurable on the fake provider, and `earliestStop` over the host's created time, its idle-since time, the pool's `idle_stop` and the declared minimum. The contract suite checks that every field is present and sane. Decision (coord, open question 6): `idle_stop` does not exist yet, so the criterion is met by `earliestStop` with a unit test; E-1534 calls it.

## Acceptance criteria

- [ ] C1. The contract suite fails a provider missing any declared field, a negative price, or a minimum that is not a multiple of its granularity (test).
- [ ] C2. An extra paid address is added to the declared idle price, and `stoppedBills = true` makes the declared stop action `destroy` (test).
- [ ] C3. `earliestStop` never returns a time before the created time plus the declared billing minimum, even with an `idle_stop` shorter than it (test).
