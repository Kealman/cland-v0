---
id: T-1713
kind: task
title: The DigitalOcean host provider's machines
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1707
  - T-1708
topic: null
branch: null
created: 2026-11-06T10:48:21.140Z
updated: 2026-11-06T10:48:21.140Z
---

## Summary

The `digitalocean` provider creates a droplet per host from the hub's `DIGITALOCEAN_TOKEN`, as the executor reads it. Each droplet goes in the pool's region (lon1 by default; fra1 and ams3 allowed), is tagged `cland`, the project tag and a pool tag, and gets its own SSH key. Status reads the droplet. Release deletes the droplet and its key, each confirmed by a GET, so a DELETE 404 with a live GET is reported as not deleted. Reap deletes tagged droplets and prefixed keys that no host record owns.

Hot files: `hub/src/host/provider/digitalocean.ts` (new), `hub/src/host/provider/registry.ts`, `hub/test/fakes/digitalocean/fake-api.ts`, `hub/test/host-provider-digitalocean.test.ts` (new)

## What to build

The provider over `DigitalOceanApi`, reusing its confirmed delete and the executor's `projectTag`. The name and tags are written before the create call, so an ambiguous create is found by tag. Keys are named with the project-tag prefix, since DigitalOcean keys carry no tags. The token is never in argv, a log line, an error or a host's user-data.

## Acceptance criteria

- [ ] C1. A create against the fake API carries the region, size, image and tags `cland`, the project tag and `cland-pool-<pool>`, and a region outside lon1, fra1 and ams3 is refused before any call (test).
- [ ] C2. Release with the fake API answering DELETE 404 while GET answers 200 reports the droplet as not deleted; with GET 404 it reports `released` (test).
- [ ] C3. Reap deletes a droplet carrying the project and pool tags with no host record, and its prefixed key, each confirmed by a GET, and leaves droplets of other projects alone (test).
- [ ] C4. A create whose response is lost is found by its tags at the next reap, not left running (test).
- [ ] C5. With a sentinel token, no log line, error, user-data or child argv of the provider contains it (test).
- [ ] C6. The machine cases of the contract suite pass against the fake API (test).
