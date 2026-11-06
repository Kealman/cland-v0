---
id: T-1718
kind: task
title: A host from create to ready on the fake provider, and `cland host list`
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1706
  - T-1716
  - T-1710
topic: null
branch: null
created: 2026-11-06T10:48:53.045Z
updated: 2026-11-06T10:48:53.045Z
---

## Summary

`cland host create [<pool>]` (frame `host.create`) takes a host from create to ready. The pool's provider creates a machine from the current pool image, with the prelude as user-data. The hub waits for the pinned key to answer, as its provisioning gate bounded at 5 minutes. It then registers the host and adds it to the running hub, which starts the supervisor and the host agent, opens the tunnel and clones the territory. The host is the `ssh` Host of E-1532 on a provider's machine. `cland host list` shows each host with its pool, provider, size, region, state, uptime and declared price per hour.

Hot files: `hub/src/host/provision-host.ts` (new), `hub/src/host/provider/fake.ts` (the fake host takes its pinned key from the user-data), `hub/src/cli/host.ts`, `hub/src/cli/help.ts`, `hub/src/hub/dispatch.ts` (`host.create`, `host.list`), `hub/src/hub/web-authority.ts`, `hub/test/host-create-ready.test.ts` (new)

## What to build

The create-to-ready sequence with a state per step (`creating`, `booting`, `connecting`, `cloning`, `ready`, `failed`) and the host record's provider, pool, machine id and created time. The fake provider writes the public key from the rendered user-data as the fake host's key, so the pinned-key gate is real. Only the local human CLI or Neovim may call these frames.

Decisions (coord, open questions 3 and 5): `cland host create [<pool>]` stays a local-only command beside the scheduler, and declared prices show in `host list`; E-1534 owns `host status`.

## Acceptance criteria

- [ ] C1. On the fake provider, `cland host create agents` reaches `ready` with the tunnel up and the territory cloned, and a `session.launch` with that `host` runs an OpenCode session on it (test).
- [ ] C2. `cland host list` shows that host's id, pool, provider, size, region, state, uptime and the declared live price per hour (test).
- [ ] C3. A fake machine whose key differs from the one in its user-data is never connected, and after the bounded wait the create ends `failed` and releases the machine (test).
- [ ] C4. A create on a pool whose image is not current is refused naming `cland host prepare` (test).
- [ ] C5. `host.create` and `host.list` from a session or a remote are refused, and `cland host --help` lists `create` and `list` (test).
