---
id: T-1719
kind: task
title: DigitalOcean pool images, and hosts created from them
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1715
  - T-1714
  - T-1716
  - T-1710
topic: null
branch: null
created: 2026-11-06T10:49:01.153Z
updated: 2026-11-06T10:49:01.153Z
---

## Summary

The DigitalOcean provider's prepare builds a pool image the way the executor builds its snapshot: a builder droplet runs the recipe with the agent-host part, then the provisioning hook as root, then `prepare` as `runner`. The image is snapshotted, transferred to the pool's region and tagged `cland`, project and pool. Prepare retires the previous pool image only after the new one is published, its deletion confirmed by a GET. A host create uses the current pool image and the prelude as user-data, and is refused with "run cland host prepare" when the pool's image is missing or stale.

Hot files: `hub/src/executor/droplet/prepare.ts` (`prepareSnapshot` takes the recipe, key, record path and tags), `hub/src/host/provider/digitalocean.ts`, `hub/test/fakes/digitalocean/fake-api.ts`, `hub/test/host-provider-digitalocean-prepare.test.ts` (new)

## What to build

A generalised `prepareSnapshot` that the executor keeps calling unchanged in behaviour, and DigitalOcean prepare and acquire over it. The builder lease, watchdog and spend come from the executor's existing builder path.

Decision (coord, open question 4): until E-1534's host lease, watchdog and `hosts` spend land, `host.create` on the `digitalocean` provider is refused outside the test environment, with a message naming the reason. `prepare` stays allowed, since it runs under the executor's builder lease, watchdog and spend. The provider contributes its own prelude steps (open question 10).

## Acceptance criteria

- [ ] C1. Against the fake API and the scripted machine, prepare runs the agent-host recipe, then the hook as root, then `prepare` as `runner`, and records a pool image tagged `cland`, the project tag and the pool tag in the pool's region (test).
- [ ] C2. A second prepare with an unchanged key makes no API call that creates anything and answers `current` (test).
- [ ] C3. A replaced pool image is deleted only after the new one is recorded, and a DELETE 404 with a live GET keeps it on the retirement record (test).
- [ ] C4. A host create sends the current pool image id and the rendered prelude as `user_data`, and with no current image it is refused naming `cland host prepare` before any POST (test).
- [ ] C5. The executor's prepare test files pass with no test edited.
- [ ] C6. Outside the test environment, `host.create` on the `digitalocean` provider is refused before any API call with a message naming the missing lease, watchdog and spend of E-1534 (test).
