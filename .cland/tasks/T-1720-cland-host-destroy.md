---
id: T-1720
kind: task
title: "`cland host destroy`"
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1718
topic: null
branch: null
created: 2026-11-06T10:49:05.400Z
updated: 2026-11-07T05:55:04.256Z
---

## Summary

`cland host destroy <id>` deletes a host at once, for a host the hub cannot reach too. The hub removes it from the running hub, so its sessions settle as the revoke path settles them. It then releases the machine and the host's SSH key through the provider, each deletion confirmed by a read and logged with that read. Finally it marks the host record destroyed. A deletion the provider cannot confirm leaves the host listed with that reason.

Hot files: `hub/src/host/provision-host.ts`, `hub/src/cli/host.ts`, `hub/src/hub/dispatch.ts` (`host.destroy`), `hub/test/host-destroy.test.ts` (new)

## What to build

The destroy sequence over the runtime host registry's `remove` (T-1706) and the provider's `release`, its `host-destroy` log events naming each confirming read, and the CLI with its help line.

## Acceptance criteria

- [ ] C1. On the fake provider, `cland host destroy <id>` ends the host's session as exited, removes the machine and its key, and the hub log holds one confirming read for each (test).
- [ ] C2. Destroying a host whose tunnel is down succeeds the same way (test).
- [ ] C3. When the provider's read still finds the machine, the host stays in `cland host list` with "deletion not confirmed", and a second destroy retries it (test).
- [ ] C4. An unknown id is refused, and `host.destroy` from a session or a remote is refused (test).
