---
id: T-1717
kind: task
title: DigitalOcean volumes
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1712
  - T-1715
topic: null
branch: null
created: 2026-11-06T10:48:46.395Z
updated: 2026-11-06T20:34:09.136Z
---

## Summary

The DigitalOcean provider implements the volume operations on DigitalOcean Volumes. Create makes a 1 GiB volume, tagged like hosts, in the pool's region. Attach and detach are actions awaited to completion. Snapshot honours the one-per-10-minutes limit as a typed refusal with its retry time. Delete is confirmed by a GET, and list works by tag. The fake API gains volumes with one attachment at a time and the snapshot window.

Hot files: `hub/src/host/provider/digitalocean.ts`, `hub/src/executor/droplet/api.ts` (volume calls), `hub/test/fakes/digitalocean/fake-api.ts`, `hub/test/host-provider-digitalocean-volumes.test.ts` (new)

## What to build

Volume calls on `DigitalOceanApi`, volumes in the fake API, and the provider's volume operations against them.

## Acceptance criteria

- [ ] C1. Against the fake API, a volume created in lon1 with the `cland`, project and pool tags attaches to a droplet and detaches, each action awaited to `completed` (test).
- [ ] C2. An attach to a second droplet while the volume is attached is refused as `attached elsewhere` (test).
- [ ] C3. A second snapshot within 10 minutes is refused with its retry time, as the fake API's 429 says (test).
- [ ] C4. A volume DELETE answered 404 while its GET answers 200 is reported not deleted (test).
- [ ] C5. The volume cases of the contract suite pass against the fake API (test).
