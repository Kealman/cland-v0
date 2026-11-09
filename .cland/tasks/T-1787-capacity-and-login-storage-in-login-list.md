---
id: T-1787
kind: task
title: Capacity and login storage in `login list` and `host status`
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1784
topic: null
branch: null
created: 2026-11-09T12:44:11.318Z
updated: 2026-11-09T12:44:19.036Z
---

## Summary

`cland login list` ends with the capacity per pool and harness, min(`max_hosts`, free logins), and `cland host status` shows each host's logins in use. Each pool's month figure in `cland host status` adds the storage of its logins' volumes and snapshots at the provider's declared storage prices. Storage is shown but never reserved.

## What to build

The capacity uses T-1784's free-login count per pool region and harness; a non-exclusive or key login gives `max_hosts`. The harnesses listed are those of the roles bound to the pool and those with logins. Provider declarations gain `volumePerGiBMonth` and `snapshotPerGiBMonth`: 0 on the fake, and on DigitalOcean $0.10 and $0.06, under the declarations' check date. Accrued storage comes from the volume and snapshot lifetimes on the rows. It never enters a hosts reservation.

## Acceptance criteria

- [ ] C1. `cland login list` shows "capacity <pool>/<harness>: <n>" equal to min(`max_hosts`, free logins of that harness in the pool's region) for each pool and harness (test).
- [ ] C2. `cland host status` lists each host's bound logins by harness and name (test).
- [ ] C3. Each pool's month figure in `cland host status` adds the accrued storage of its logins' volumes and snapshots at the declared prices, and no hosts reservation includes storage (test).
- [ ] C4. A provider declaration without the storage prices is refused naming the keys, and the fake declares them as 0 (test).

## Blocked by

- T-1784

## Notes

- Hot files: `hub/src/cli/login.ts` (the capacity line), `hub/src/cli/host.ts`, `hub/src/host/provider/declarations.ts`, `hub/src/host/provider/fake.ts` and `hub/src/host/provider/digitalocean.ts` (declarations only). Registration point: `hub/src/hub/dispatch.ts` (`host.status`).
- Tests: `hub/test/host-status.test.ts` (T2, new cases); new `hub/test/login-capacity-list.test.ts` (T2).
- Serves epic C1 and C6. Spec §3.6 puts storage in the month figure; E-1534 left it to this epic (its decision 16). See question 17.
