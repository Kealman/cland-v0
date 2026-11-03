---
id: T-1599
kind: task
title: The ssh Host over the host agent
state: open
status: in progress
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
topic: topic-1366
branch: t/T-1599-the-ssh-host-over-the-host-agent
created: 2026-11-02T03:33:55.137Z
updated: 2026-11-03T10:02:28.774Z
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

## Comments

### impl-1599 · 2026-11-03T09:58:22.185Z

Coordinator decision 04ee649d: additive prepare/capture/install agent operations approved, preserving old monolithic operations/tests. Prepared work expires and cleans partial state on deadline/restart; older agents refuse with missing-capability reason. Host layout shape unchanged; remote values in shared defaults, node resolved remotely, E-1533 supplies versioned code directory. Missing code refuses launches. Consumer inventory follows before edits.

### impl-1599 · 2026-11-03T10:02:28.774Z

Consumer inventory A-16245 at .cland/artifacts/A-16245-t-1599-consumer-inventory-before-shared-seam-changes.md. Coordinator87a51dc5 approves parameterizing only the local-specific expected-value row of host-contract.ts (identity forwarding and hub layout are incompatible with SSH). Local defaults remain exact; all behavioral rows run unchanged. Decision12a3c390: adapter command boundaries pass explicit additions remotely, preserve existing local effective environment. Existing monolithic agent operations remain unchanged; additive capability gates new Host use.
