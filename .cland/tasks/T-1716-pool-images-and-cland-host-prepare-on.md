---
id: T-1716
kind: task
title: Pool images and `cland host prepare` on the fake provider
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1711
  - T-1709
topic: null
branch: null
created: 2026-11-06T10:48:40.049Z
updated: 2026-11-06T10:48:40.049Z
---

## Summary

A pool image is keyed from the Node version, the lockfile digest, the pool's harness versions and the provisioning hook's content. `cland host prepare [<pool>]` asks the pool's provider to build it when the key changed, and answers `current` or `prepared` with the parts that changed. On the fake provider the image is a record with its key and a configurable build time. The pool's provider, size, region and transport are read from `[hosts.<pool>]`, and the harness pins from `[hosts]`.

Hot files: `hub/src/host/provider/pool-image.ts` (new), `hub/src/host/provider/fake.ts`, `hub/src/host/transport-config.ts` (minimal pool reading), `hub/src/cli/host.ts`, `hub/src/cli/help.ts` (`HOST_USAGE`), `hub/src/hub/dispatch.ts` (`host.prepare`), `hub/src/hub/web-authority.ts`, `hub/test/host-prepare.test.ts` (new)

## What to build

- the pool image key and its per-pool record under `.cland/run/hosts/`;
- a `host.prepare` frame, refused off the local human CLI or Neovim as `host.revoke` is, and the CLI over it;
- prepare on the fake provider;
- the minimal pool reading. E-1534 owns the rest of the hosts table: slots, `min_hosts`, `max_hosts`, `idle_stop`, `spread`, hot reload and `cland config set`.

Decisions (coord, open questions 1, 7 and 9): E-1533 reads only `[hosts.<pool>]` provider, size, region and transport plus the `[hosts] harnesses` pins, validated and read per command. The key hashes the hook's content, which embeds the Neovim tag and digest. cland's own code is delivered at ready through the version handoff, not baked into the pool image; the boot-time target is measured in E-1539.

## Acceptance criteria

- [ ] C1. In a scratch project with a fake pool, `cland host prepare` prints `prepared` and then `current` (test).
- [ ] C2. Changing one harness pin, the lockfile or the provisioning hook makes the next `cland host prepare` print `prepared` and name that key part (test).
- [ ] C3. `cland host prepare` with no pool prepares every configured pool, and an unknown pool is refused naming the configured ones (test).
- [ ] C4. `host.prepare` from a session or a remote is refused as `host.revoke` is, and `cland host --help` lists `prepare` (test).
