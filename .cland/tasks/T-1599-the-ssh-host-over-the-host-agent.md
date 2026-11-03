---
id: T-1599
kind: task
title: The ssh Host over the host agent
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1587
  - T-1593
  - T-1598
  - T-1657
topic: null
branch: null
created: 2026-11-02T03:33:55.137Z
updated: 2026-11-03T07:20:12.144Z
---

## Summary

The `ssh` Host implements every Host operation through its tunnel's agent client: spawn returns `exited` from `process-exited`, identity, alive and stop work by Linux identity, forward goes through the carrier, limitPolls is false, and its layout names the host's paths. The hub registers one for each host record and starts its tunnel. A spawn's environment is the agent's base environment plus the explicit additions, never the hub's own, with the deny-listed tokens dropped.

Hot files: `hub/src/host/ssh-host.ts` (new), `hub/src/adapters/index.ts`, `hub/src/hub/daemon.ts`, `hub/test/host-ssh-contract.test.ts` (new)

## Acceptance criteria

- [ ] C1. The Host contract suite passes on a fake host through the fake `ssh` stand-in (test).
- [ ] C2. A spawn on a fake host carries none of the hub's own environment, and `DIGITALOCEAN_TOKEN`, the remotes' tokens and the project secret never reach it even when the caller passes them (test).
- [ ] C3. With fake hosts registered, the registry holds `local` and one `ssh` Host per record, a launch with `host: "f1"` reaches f1's agent, and `CLAND_TEST_HOSTS` still works (test).
- [ ] C4. While a host's tunnel is down, its operations fail with a reason naming the host and the tunnel, and they never touch the hub's machine (test).
- [ ] C5. A row spawned on a fake host is alive only while its agent reports the recorded identity, and its stop signals only on that host (test).

## Notes

Shared files: `hub/src/adapters/index.ts` (registry), `hub/src/hub/daemon.ts`
