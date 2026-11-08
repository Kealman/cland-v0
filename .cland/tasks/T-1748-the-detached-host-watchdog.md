---
id: T-1748
kind: task
title: The detached host watchdog
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1747
topic: null
branch: null
created: 2026-11-07T16:01:58.814Z
updated: 2026-11-08T00:38:56.738Z
---

## Summary

At create, each host gets a detached watchdog process, with its pid identity recorded on the lease. At the deadline in the lease file, the watchdog deletes the host and its SSH key through the host's provider, each deletion confirmed by a read. It does so even when the hub is gone, then writes a receipt and settles the host's spend. A renewal moves its deadline, and a hub destroy stops it. Re-arming after a hub restart is T-1752's.

## What to build

A provider-neutral watchdog over `HostProviderRegistry` and `release`. It runs with the hub's environment and never puts a token in argv. Its pid-identity handling follows `executor/droplet/watchdog.ts` (arm, verify identity, stop with escalation).

## Acceptance criteria

- [ ] C1. A host create arms a detached watchdog whose pid identity is recorded on the host's lease (test).
- [ ] C2. With the hub stopped and a lease of 30 s, the watchdog deletes the fake machine and its key after the deadline, the provider confirms both absences, and a receipt is written (test).
- [ ] C3. A watchdog that deletes its host settles the host's spend under `hosts` (test).
- [ ] C4. After a renewal, the watchdog does not fire at the old deadline (test).
- [ ] C5. `cland host destroy` stops the host's watchdog after the confirmed deletion (test).

## Blocked by

- T-1747

## Notes

- Hot files: `hub/src/host/host-watchdog.ts` (new; reuses the executor's arm, identity and stop helpers), `hub/src/host/provision-host.ts` (arm at create, stop at destroy).
- Tests: new `hub/test/host-watchdog.test.ts` (T3, real detached process, fake provider); T1 cases with injected process probes, as `executor-watchdog.test.ts` does.
- Serves epic C5 and C7.
