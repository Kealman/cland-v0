---
id: T-1715
kind: task
title: DigitalOcean declarations and refused creates
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1711
  - T-1713
topic: null
branch: null
created: 2026-11-06T10:48:33.314Z
updated: 2026-11-06T20:34:08.856Z
---

## Summary

The DigitalOcean provider declares its prices from `/v2/sizes` (`price_hourly` live, 0 idle once destroyed), `stoppedBills = true`, per-second billing with a 60 s minimum, its token confinement, 250 requests a minute, the machine limit from `/account`, x86_64, and no extra address. A refused create (429, or 422 for the droplet limit) pauses creation with its retry time and retries once after it, with no cascade.

Hot files: `hub/src/host/provider/digitalocean.ts`, `hub/test/fakes/digitalocean/fake-api.ts`, `hub/test/host-provider-digitalocean.test.ts`

## What to build

Declarations read through the API, and a per-provider pause that holds every create until the retry time. A create refused during the pause is answered `refused` with that time and is not re-sent.

## Acceptance criteria

- [ ] C1. The declared live price per size equals the fake API's `price_hourly`, the machine limit equals its `/account` `droplet_limit`, and the declarations pass the contract suite (test).
- [ ] C2. A create answered 429 is reported `refused` with its retry time and succeeds on one retry after it (test).
- [ ] C3. While the pause holds, a second and a third create send no POST, and after it exactly one POST per create is sent (test).
- [ ] C4. A 422 droplet-limit refusal is paused and retried the same way, and the refusal text never carries the token (test).
