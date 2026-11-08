---
id: T-1756
kind: task
title: DigitalOcean host creation under the lease, the watchdog and the spend
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1747
  - T-1748
topic: null
branch: t/T-1756-digitalocean-host-creation-under-the
created: 2026-11-07T16:02:00.451Z
updated: 2026-11-08T20:38:49.557Z
---

## Summary

The DigitalOcean provider drops its blanket E-1534 refusal. A create proceeds when the hub's create path supplies its lease, armed watchdog and hosts reservation, and without them it is refused before any API call, naming what is missing. The SSH and readiness gate becomes provider-neutral: it takes the client key and the known-host material from the provision record, never from the fake host directory or `CLAND_FAKE_HOSTS`, so a DigitalOcean machine can reach it. Tests use the fake DigitalOcean API and a recording `ssh` only; no real droplet is created. A real droplet reaching `ready` stays with the live run of E-1539 (Release v0.4.0).

## What to build

Admission receipts from T-1747 and T-1748 passed through `createAdmission` and `acquire`. A provision record that carries the machine's SSH client identity and pinned host key, with the fake keeping its directory key through the same field. The provider-neutral watchdog of T-1748 deleting a DigitalOcean host through the provider. `docs/hub/host-providers.md` updated to drop the refusal.

## Acceptance criteria

- [ ] C1. Against the fake API, a DigitalOcean host create with its lease, armed watchdog and hosts reservation reaches the droplet create, with the pool image and the cland, project and pool tags (test).
- [ ] C2. A DigitalOcean create missing any of the three is refused before any API call, naming what is missing (test).
- [ ] C3. The SSH gate for a DigitalOcean machine uses the client key and known-host material from the provision record and the machine's address, and never reads a fake host directory or `CLAND_FAKE_HOSTS` (test).
- [ ] C4. With the hub stopped, the host watchdog deletes a DigitalOcean host's droplet and key through the fake API at the deadline, each confirmed by a GET (test).
- [ ] C5. The fake provider's create-to-ready tests pass through the same provision-record identity with no test edited.
- [ ] C6. No code, test or doc still names the E-1534 refusal.

## Blocked by

- T-1747
- T-1748

## Notes

- Hot files: `hub/src/host/provider/digitalocean.ts`, `hub/src/host/provider/provider.ts`, `hub/src/host/provision-host.ts`, `hub/src/host/provision-records.ts`, `docs/hub/host-providers.md`.
- Tests: `hub/test/host-create-admission.test.ts` and `hub/test/host-provider-digitalocean.test.ts` (T2, edit); fake DigitalOcean API only.
- Serves epic C5 and C7 (the production provider path). Its plan lane orders it after T-1752 and T-1753, because it shares `host-watchdog.ts` and `provision-records.ts` with them.
